import sqlite3, hashlib, json

def get_db():
    conn = sqlite3.connect('barter.db'); conn.row_factory = sqlite3.Row; return conn

def init_db():
    db = get_db(); c = db.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS users (
        username TEXT PRIMARY KEY, password TEXT, has_items TEXT, wants_items TEXT, 
        profile_pic TEXT, phone TEXT, email TEXT, address TEXT, website TEXT, lat REAL, lng REAL,
        role TEXT DEFAULT 'Individual', org_name TEXT DEFAULT '')''')
    c.execute('''CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT, sender TEXT, receiver TEXT, text TEXT, 
        type TEXT DEFAULT 'text', timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)''')
    
    def pic(name): return f"https://api.dicebear.com/7.x/pixel-art/svg?seed={name}&backgroundColor=1f2937"
    def hp(p): return hashlib.sha256(p.encode()).hexdigest()
    def logo(emoji): return f"data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' fill='%231f2937'/><text x='50' y='50' font-size='50' text-anchor='middle' dominant-baseline='central'>{emoji}</text></svg>"
    
    users = [
        ("HopeNGO", "hopengopass", ["Volunteers", "Food"], ["800 Blankets", "Medical Supplies"], "Kathmandu", "https://hopengo.org", 27.7100, 85.3100, "Organization", "Hope Foundation Nepal", logo("🤝")),
        ("CityHospital", "hospitalpass", ["800 Blankets", "Medical Supplies"], ["Volunteers", "Food"], "Lalitpur", "https://cityhospital.com", 27.6700, 85.3300, "Organization", "City Hospital", logo("🏥"))
    ]
    for u in users:
        c.execute("INSERT OR IGNORE INTO users VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", 
                  (u[0], hp(u[1]), json.dumps(u[2]), json.dumps(u[3]), u[10], "", "", u[4], u[5], u[6], u[7], u[8], u[9]))
    db.commit(); db.close()

init_db()