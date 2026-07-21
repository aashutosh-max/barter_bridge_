from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import networkx as nx, hashlib, json, os, time, math
from database import get_db
from models import UserCreate, UserLogin, UserUpdate, MessageCreate

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

API_BASE = "https://barter-bridge-api.onrender.com" if os.environ.get("RENDER") else "http://localhost:8000"

def hp(p): return hashlib.sha256(p.encode()).hexdigest()
def haversine(la1, lo1, la2, lo2):
    R=6371.0; dLat=math.radians(la2-la1); dLon=math.radians(lo2-lo1)
    a=math.sin(dLat/2)**2+math.cos(math.radians(la1))*math.cos(math.radians(la2))*math.sin(dLon/2)**2
    return R*2*math.atan2(math.sqrt(a), math.sqrt(1-a))

def get_all_users(c):
    return {r["username"]: {"name": r["username"], "has_items": json.loads(r["has_items"]), "wants_items": json.loads(r["wants_items"]), "profile_pic": r["profile_pic"], "phone": r["phone"], "email": r["email"], "address": r["address"], "website": r["website"], "lat": r["lat"], "lng": r["lng"], "role": r["role"], "org_name": r["org_name"]} for r in c.execute("SELECT * FROM users").fetchall()}

@app.post("/api/register")
def register(user: UserCreate):
    db = get_db(); c = db.cursor()
    if c.execute("SELECT 1 FROM users WHERE username=?", (user.username,)).fetchone(): raise HTTPException(400, "Username taken")
    
    if user.role == "Organization":
        pic = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' fill='%231f2937'/><text x='50' y='50' font-size='50' text-anchor='middle' dominant-baseline='central'>🏢</text></svg>"
    else:
        pic = f"https://api.dicebear.com/7.x/pixel-art/svg?seed={user.username}&backgroundColor=1f2937"
        
    c.execute("INSERT INTO users VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", (user.username, hp(user.password), json.dumps(user.has_items), json.dumps(user.wants_items), pic, "", "", "", "", 27.7172, 85.3240, user.role, user.org_name))
    db.commit(); db.close()
    return {"user": {"name": user.username, "has_items": user.has_items, "wants_items": user.wants_items, "profile_pic": pic, "role": user.role, "org_name": user.org_name}}

@app.post("/api/login")
def login(user: UserLogin):
    db = get_db(); c = db.cursor()
    r = c.execute("SELECT * FROM users WHERE username=? AND password=?", (user.username, hp(user.password))).fetchone()
    if not r:
        db.close()
        raise HTTPException(401, "Invalid credentials")
    users = get_all_users(c)
    db.close()
    return {"user": users[user.username]}

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    contents = await file.read()
    if len(contents) > 64 * 1024 * 1024: raise HTTPException(413, "Too large")
    fn = f"{int(time.time())}_{file.filename}"
    with open(f"uploads/{fn}", "wb") as f: f.write(contents)
    return {"url": f"{API_BASE}/uploads/{fn}"}

@app.get("/api/graph")
def get_graph():
    db = get_db(); c = db.cursor(); users = get_all_users(c); db.close()
    edges = [[u1, u2] for u1, d1 in users.items() for u2, d2 in users.items() if u1 != u2 and set(d1["wants_items"]) & set(d2["has_items"])]
    return {"users": users, "trust_edges": edges}

@app.get("/api/direct-trades/{username}")
def get_direct_trades(username: str):
    db = get_db(); c = db.cursor(); users = get_all_users(c); db.close()
    me = users.get(username)
    if not me: return []
    return [{"name": u, "i_give": list(set(me["has_items"]) & set(d["wants_items"])), "i_get": list(set(me["wants_items"]) & set(d["has_items"])), "role": d["role"], "org_name": d["org_name"]} for u, d in users.items() if u != username and (set(me["has_items"]) & set(d["wants_items"])) and (set(me["wants_items"]) & set(d["has_items"]))]

@app.get("/api/messages/{u1}/{u2}")
def get_messages(u1: str, u2: str):
    db = get_db(); c = db.cursor()
    msgs = c.execute("SELECT * FROM messages WHERE (sender=? AND receiver=?) OR (sender=? AND receiver=?) ORDER BY timestamp ASC", (u1, u2, u2, u1)).fetchall()
    db.close()
    return [{"id": m["id"], "sender": m["sender"], "receiver": m["receiver"], "text": m["text"], "type": m["type"]} for m in msgs]

@app.post("/api/send-message")
def send_message(msg: MessageCreate):
    db = get_db(); c = db.cursor()
    c.execute("INSERT INTO messages (sender, receiver, text, type) VALUES (?,?,?,?)", (msg.sender, msg.receiver, msg.text, msg.type))
    db.commit(); db.close()
    return {"status": "ok"}

@app.put("/api/profile")
def update_profile(user: UserUpdate):
    db = get_db(); c = db.cursor()
    c.execute("UPDATE users SET has_items=?, wants_items=?, profile_pic=?, phone=?, email=?, address=?, website=?, lat=?, lng=?, role=?, org_name=? WHERE username=?",
              (json.dumps(user.has_items), json.dumps(user.wants_items), user.profile_pic, user.phone, user.email, user.address, user.website, user.lat, user.lng, user.role, user.org_name, user.username))
    db.commit(); db.close()
    return {"status": "updated"}

@app.get("/api/ai-draft/{sender}/{receiver}")
def ai_draft_message(sender: str, receiver: str):
    db = get_db(); c = db.cursor(); users = get_all_users(c); db.close()
    s_user = users.get(sender); r_user = users.get(receiver)
    if not s_user or not r_user: raise HTTPException(404, "User not found")

    s_name = s_user["org_name"] if s_user["role"] == "Organization" else sender
    r_name = r_user["org_name"] if r_user["role"] == "Organization" else receiver

    i_give = list(set(s_user["has_items"]) & set(r_user["wants_items"]))
    i_get = list(set(s_user["wants_items"]) & set(r_user["has_items"]))

    draft = f"Hello {r_name}, I am BarterAI, your automated matchmaking assistant. 🤖\n\n"
    draft += f"My analysis shows a perfect match between {s_name} and {r_name}.\n\n"
    draft += f"📋 Trade Details:\n"
    draft += f"- {s_name} will provide: {', '.join(i_give)}\n"
    draft += f"- {r_name} will provide: {', '.join(i_get)}\n\n"
    draft += f"Please use this chat to coordinate logistics, delivery, or schedules to finalize this barter. Thank you!"

    db = get_db(); c = db.cursor()
    c.execute("INSERT INTO messages (sender, receiver, text, type) VALUES (?,?,?,?)", ("BarterAI", receiver, draft, "text"))
    db.commit(); db.close()
    return {"status": "Message sent by AI."}

@app.get("/api/find-cycle/{username}")
def find_cycle(username: str):
    db = get_db(); c = db.cursor(); users = get_all_users(c); db.close()
    G = nx.DiGraph()
    for u1, d1 in users.items():
        for u2, d2 in users.items():
            if u1 != u2 and set(d1["wants_items"]) & set(d2["has_items"]): G.add_edge(u1, u2)
    
    cycles = list(nx.simple_cycles(G))
    my_cycles = [cy for cy in cycles if username in cy]
    
    if not my_cycles: return {"success": False, "cycle": []}
    
    my_cycles.sort(key=lambda cy: sum(haversine(users[cy[i]]["lat"], users[cy[i]]["lng"], users[cy[(i+1)%len(cy)]]["lat"], users[cy[(i+1)%len(cy)]]["lng"]) for i in range(len(cy))))
    return {"success": True, "cycle": my_cycles[0]}