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
    return {r["username"]: {"name": r["username"], "has_items": json.loads(r["has_items"]), "wants_items": json.loads(r["wants_items"]), "profile_pic": r["profile_pic"], "phone": r["phone"], "email": r["email"], "address": r["address"], "website": r["website"], "lat": r["lat"], "lng": r["lng"]} for r in c.execute("SELECT * FROM users").fetchall()}

@app.post("/api/register")
def register(user: UserCreate):
    db = get_db(); c = db.cursor()
    if c.execute("SELECT 1 FROM users WHERE username=?", (user.username,)).fetchone(): raise HTTPException(400, "Username taken")
    pic = f"https://api.dicebear.com/7.x/pixel-art/svg?seed={user.username}&backgroundColor=1f2937"
    c.execute("INSERT INTO users VALUES (?,?,?,?,?,?,?,?,?,?,?)", (user.username, hp(user.password), json.dumps(user.has_items), json.dumps(user.wants_items), pic, "", "", "", "", 27.7172, 85.3240))
    db.commit(); db.close()
    return {"user": {"name": user.username, "has_items": user.has_items, "wants_items": user.wants_items, "profile_pic": pic}}

@app.post("/api/login")
def login(user: UserLogin):
    db = get_db(); c = db.cursor()
    r = c.execute("SELECT * FROM users WHERE username=? AND password=?", (user.username, hp(user.password))).fetchone()
    db.close()
    if not r: raise HTTPException(401, "Invalid credentials")
    return {"user": get_all_users(c)[user.username]}

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
    return [{"name": u, "i_give": list(set(me["has_items"]) & set(d["wants_items"])), "i_get": list(set(me["wants_items"]) & set(d["has_items"]))} for u, d in users.items() if u != username and (set(me["has_items"]) & set(d["wants_items"])) and (set(me["wants_items"]) & set(d["has_items"]))]

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
    c.execute("UPDATE users SET has_items=?, wants_items=?, profile_pic=?, phone=?, email=?, address=?, website=?, lat=?, lng=? WHERE username=?",
              (json.dumps(user.has_items), json.dumps(user.wants_items), user.profile_pic, user.phone, user.email, user.address, user.website, user.lat, user.lng, user.username))
    db.commit(); db.close()
    return {"status": "updated"}

@app.get("/api/find-cycle")
def find_cycle():
    db = get_db(); c = db.cursor(); users = get_all_users(c); db.close()
    G = nx.DiGraph()
    for u1, d1 in users.items():
        for u2, d2 in users.items():
            if u1 != u2 and set(d1["wants_items"]) & set(d2["has_items"]): G.add_edge(u1, u2)
    cycles = list(nx.simple_cycles(G))
    if not cycles: return {"success": False, "cycle": []}
    cycles.sort(key=lambda cy: sum(haversine(users[cy[i]]["lat"], users[cy[i]]["lng"], users[cy[(i+1)%len(cy)]]["lat"], users[cy[(i+1)%len(cy)]]["lng"]) for i in range(len(cy))))
    return {"success": True, "cycle": cycles[0]}