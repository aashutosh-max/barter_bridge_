import sqlite3, hashlib, json

def get_db():
    conn = sqlite3.connect('barter.db'); conn.row_factory = sqlite3.Row; return conn

def init_db():
    db = get_db(); c = db.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS users (
        username TEXT PRIMARY KEY, password TEXT, has_items TEXT, wants_items TEXT, 
        profile_pic TEXT, phone TEXT, email TEXT, address TEXT, website TEXT, lat REAL, lng REAL)''')
    c.execute('''CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT, sender TEXT, receiver TEXT, text TEXT, 
        type TEXT DEFAULT 'text', timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)''')
    
    def pic(name): return f"https://api.dicebear.com/7.x/pixel-art/svg?seed={name}&backgroundColor=1f2937"
    def hp(p): return hashlib.sha256(p.encode()).hexdigest()
    
    users = [
        ("Sarah", "sarahpass", ["Web Design", "Guitar"], ["Fresh Produce", "Apples"], "Kathmandu", "https://sarah-creations.com", 27.7172, 85.3240),
        ("Mike", "mikepass", ["Fresh Produce", "Apples"], ["Bicycle Repair", "Guitar"], "Pokhara", "https://mikes-farm.com", 28.2096, 83.9856),
        ("Joe", "joepass", ["Bicycle Repair"], ["Web Design"], "Lalitpur", "", 27.6588, 85.3247),
        ("Anna", "annapass", ["Tutoring"], ["Guitar", "Apples"], "Bhaktapur", "", 27.6710, 85.4298),
        ("Tom", "tompass", ["Web Design"], ["Tutoring"], "Kirtipur", "", 27.6786, 85.2776),
        ("Lisa", "lisapass", ["Paintings"], ["Web Design"], "Madhyapur Thimi", "https://lisa-art.com", 27.6822, 85.3818),
        ("David", "davidpass", ["Carpentry"], ["Baked Goods"], "Banepa", "", 27.6298, 85.5212),
        ("Emma", "emmapass", ["Knitting"], ["Carpentry"], "Panauti", "", 27.5879, 85.5154),
        ("Chris", "chrispass", ["Plumbing"], ["Knitting"], "Sankhu", "", 27.7210, 85.4230),
        ("Olivia", "oliviapass", ["Baked Goods"], ["Plumbing"], "Bungamati", "https://olivia-bakes.com", 27.6200, 85.3120),
        ("Ryan", "ryanpass", ["Car Repair"], ["Bicycle Repair"], "Changu Narayan", "", 27.7160, 85.4270),
        ("Sophie", "sophiepass", ["Apples"], ["Car Repair"], "Dhulikhel", "", 27.6210, 85.5620),
        ("James", "jamespass", ["Web Design"], ["Apples"], "Kakani", "", 27.7990, 85.2480),
        ("Mia", "miapass", ["Fresh Produce"], ["Paintings"], "Godavari", "", 27.6010, 85.3980),
        ("John", "johnpass", ["Bicycle Repair"], ["Knitting"], "Lubhu", "", 27.6550, 85.3520)
    ]
    for u in users:
        c.execute("INSERT OR IGNORE INTO users VALUES (?,?,?,?,?,?,?,?,?,?,?)", 
                  (u[0], hp(u[1]), json.dumps(u[2]), json.dumps(u[3]), pic(u[0]), "", "", u[4], u[5], u[6], u[7]))
    db.commit(); db.close()

init_db()
