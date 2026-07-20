from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import networkx as nx
import hashlib
import json
import os
import time
from database import get_db
from models import UserCreate, UserLogin, UserUpdate, MessageCreate

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

def hash_password(password: str):
    return hashlib.sha256(password.encode()).hexdigest()

@app.post("/api/register")
def register(user: UserCreate):
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT username FROM users WHERE username = ?", (user.username,))
    if c.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail="Username already taken")
    
    default_pic = f"https://api.dicebear.com/7.x/pixel-art/svg?seed={user.username}&backgroundColor=1f2937"
    c.execute("INSERT INTO users (username, password, has_items, wants_items, profile_pic, phone, email, address, website) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
              (user.username, hash_password(user.password), json.dumps(user.has_items), json.dumps(user.wants_items), default_pic, "", "", "", ""))
    conn.commit()
    conn.close()
    return {"message": "User registered successfully!", "user": {"name": user.username, "has_items": user.has_items, "wants_items": user.wants_items, "profile_pic": default_pic, "phone": "", "email": "", "address": "", "website": ""}}

@app.post("/api/login")
def login(user: UserLogin):
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT * FROM users WHERE username = ? AND password = ?", 
              (user.username, hash_password(user.password)))
    db_user = c.fetchone()
    conn.close()
    
    if not db_user:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    profile_pic = db_user["profile_pic"] or f"https://api.dicebear.com/7.x/pixel-art/svg?seed={db_user['username']}&backgroundColor=1f2937"
    
    return {
        "message": "Login successful!", 
        "user": {
            "name": db_user["username"], 
            "has_items": json.loads(db_user["has_items"]), 
            "wants_items": json.loads(db_user["wants_items"]), 
            "profile_pic": profile_pic,
            "phone": db_user["phone"],
            "email": db_user["email"],
            "address": db_user["address"],
            "website": db_user["website"]
        }
    }

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    contents = await file.read()
    if len(contents) > 64 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large (max 64MB)")
    
    file_extension = file.filename.split(".")[-1]
    unique_filename = f"{int(time.time())}_{file.filename}"
    file_location = f"uploads/{unique_filename}"
    
    with open(file_location, "wb") as f:
        f.write(contents)
        
    return {"url": f"http://localhost:8000/uploads/{unique_filename}"}

@app.get("/api/graph")
def get_graph():
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT username, has_items, wants_items, profile_pic, phone, email, address, website FROM users")
    users_rows = c.fetchall()
    conn.close()
    
    users = {}
    for row in users_rows:
        users[row["username"]] = {
            "name": row["username"], 
            "has_items": json.loads(row["has_items"]), 
            "wants_items": json.loads(row["wants_items"]), 
            "profile_pic": row["profile_pic"] if row["profile_pic"] else "",
            "phone": row["phone"],
            "email": row["email"],
            "address": row["address"],
            "website": row["website"]
        }
        
    trust_edges = []
    for u1, data1 in users.items():
        for u2, data2 in users.items():
            if u1 != u2 and set(data1["wants_items"]).intersection(set(data2["has_items"])):
                trust_edges.append([u1, u2])
                
    return {"users": users, "trust_edges": trust_edges}

# FIXED: Removed broken vouch check
@app.get("/api/direct-trades/{username}")
def get_direct_trades(username: str):
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT username, has_items, wants_items FROM users")
    users_rows = c.fetchall()
    conn.close()
    
    users = {row["username"]: {"has_items": json.loads(row["has_items"]), "wants_items": json.loads(row["wants_items"])} for row in users_rows}
    me = users.get(username)
    if not me: return []
    
    direct_matches = []
    for u, data in users.items():
        if u == username: continue
            
        i_give = list(set(me["has_items"]).intersection(set(data["wants_items"])))
        i_get = list(set(me["wants_items"]).intersection(set(data["has_items"])))
        
        if i_give and i_get:
            direct_matches.append({"name": u, "i_give": i_give, "i_get": i_get})
            
    return direct_matches

@app.get("/api/messages/{user1}/{user2}")
def get_messages(user1: str, user2: str):
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT * FROM messages WHERE (sender=? AND receiver=?) OR (sender=? AND receiver=?) ORDER BY timestamp ASC", 
              (user1, user2, user2, user1))
    rows = c.fetchall()
    conn.close()
    return [{"id": r["id"], "sender": r["sender"], "receiver": r["receiver"], "text": r["text"], "type": r["type"]} for r in rows]

@app.post("/api/send-message")
def send_message(msg: MessageCreate):
    conn = get_db()
    c = conn.cursor()
    c.execute("INSERT INTO messages (sender, receiver, text, type) VALUES (?, ?, ?, ?)", (msg.sender, msg.receiver, msg.text, msg.type))
    conn.commit()
    conn.close()
    return {"message": "Sent"}

@app.put("/api/profile")
def update_profile(user: UserUpdate):
    conn = get_db()
    c = conn.cursor()
    c.execute("UPDATE users SET has_items = ?, wants_items = ?, profile_pic = ?, phone = ?, email = ?, address = ?, website = ? WHERE username = ?", 
              (json.dumps(user.has_items), json.dumps(user.wants_items), user.profile_pic, user.phone, user.email, user.address, user.website, user.username))
    conn.commit()
    conn.close()
    return {"message": "Profile updated!", "user": {"name": user.username, "has_items": user.has_items, "wants_items": user.wants_items, "profile_pic": user.profile_pic, "phone": user.phone, "email": user.email, "address": user.address, "website": user.website}}

@app.get("/api/find-cycle")
def find_cycle():
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT username, has_items, wants_items FROM users")
    users_rows = c.fetchall()
    conn.close()
    
    G = nx.DiGraph()
    users = {}
    for row in users_rows:
        users[row["username"]] = {
            "has_items": json.loads(row["has_items"]), 
            "wants_items": json.loads(row["wants_items"])
        }
    
    for u1, data1 in users.items():
        for u2, data2 in users.items():
            if u1 != u2 and set(data1["wants_items"]).intersection(set(data2["has_items"])):
                G.add_edge(u1, u2)
                
    cycles = list(nx.simple_cycles(G))
    if cycles:
        return {"success": True, "cycle": cycles[0]}
    return {"success": False, "cycle": []}