import sqlite3
import hashlib
import json

def hash_password(password: str):
    return hashlib.sha256(password.encode()).hexdigest()

def get_db():
    conn = sqlite3.connect('barter.db')
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS users (
            username TEXT PRIMARY KEY,
            password TEXT,
            has_items TEXT,
            wants_items TEXT,
            profile_pic TEXT,
            phone TEXT,
            email TEXT,
            address TEXT,
            website TEXT
        )
    ''')
    
    c.execute('''
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sender TEXT,
            receiver TEXT,
            text TEXT,
            type TEXT DEFAULT 'text',
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    def get_pixel_art(name):
        return f"https://api.dicebear.com/7.x/pixel-art/svg?seed={name}&backgroundColor=1f2937"
    
    users_to_add = [
        ("Sarah", hash_password("sarahpass"), json.dumps(["Web Design", "Guitar"]), json.dumps(["Fresh Produce", "Apples"]), get_pixel_art("Sarah"), "555-0101", "sarah@barter.com", "123 Farm St", "https://sarah-creations.com"),
        ("Mike", hash_password("mikepass"), json.dumps(["Fresh Produce", "Apples"]), json.dumps(["Bicycle Repair", "Guitar"]), get_pixel_art("Mike"), "555-0102", "mike@barter.com", "456 Orchard Rd", "https://mikes-farm.com"),
        ("Joe", hash_password("joepass"), json.dumps(["Bicycle Repair"]), json.dumps(["Web Design"]), get_pixel_art("Joe"), "555-0103", "joe@barter.com", "789 Cycle Ln", ""),
        ("Anna", hash_password("annapass"), json.dumps(["Tutoring"]), json.dumps(["Guitar", "Apples"]), get_pixel_art("Anna"), "555-0104", "anna@barter.com", "101 Edu Blvd", ""),
        ("Tom", hash_password("tompass"), json.dumps(["Web Design"]), json.dumps(["Tutoring"]), get_pixel_art("Tom"), "555-0105", "tom@barter.com", "202 Code St", ""),
        ("Lisa", hash_password("lisapass"), json.dumps(["Paintings"]), json.dumps(["Web Design"]), get_pixel_art("Lisa"), "555-0106", "lisa@barter.com", "303 Art Ave", "https://lisa-art.com"),
        ("David", hash_password("davidpass"), json.dumps(["Carpentry"]), json.dumps(["Baked Goods"]), get_pixel_art("David"), "555-0107", "david@barter.com", "404 Wood Way", ""),
        ("Emma", hash_password("emmapass"), json.dumps(["Knitting"]), json.dumps(["Carpentry"]), get_pixel_art("Emma"), "555-0108", "emma@barter.com", "505 Yarn St", ""),
        ("Chris", hash_password("chrispass"), json.dumps(["Plumbing"]), json.dumps(["Knitting"]), get_pixel_art("Chris"), "555-0109", "chris@barter.com", "606 Pipe Pl", ""),
        ("Olivia", hash_password("oliviapass"), json.dumps(["Baked Goods"]), json.dumps(["Plumbing"]), get_pixel_art("Olivia"), "555-0110", "olivia@barter.com", "707 Bakery Rd", "https://olivia-bakes.com"),
        ("Ryan", hash_password("ryanpass"), json.dumps(["Car Repair"]), json.dumps(["Bicycle Repair"]), get_pixel_art("Ryan"), "555-0111", "ryan@barter.com", "808 Garage Ln", ""),
        ("Sophie", hash_password("sophiepass"), json.dumps(["Apples"]), json.dumps(["Car Repair"]), get_pixel_art("Sophie"), "555-0112", "sophie@barter.com", "909 Mechanic St", ""),
        ("James", hash_password("jamespass"), json.dumps(["Web Design"]), json.dumps(["Apples"]), get_pixel_art("James"), "555-0113", "james@barter.com", "111 Apple Way", ""),
        ("Mia", hash_password("miapass"), json.dumps(["Fresh Produce"]), json.dumps(["Paintings"]), get_pixel_art("Mia"), "555-0114", "mia@barter.com", "222 Gallery Dr", ""),
        ("John", hash_password("johnpass"), json.dumps(["Bicycle Repair"]), json.dumps(["Knitting"]), get_pixel_art("John"), "555-0115", "john@barter.com", "333 Knit Ct", "")
    ]
    for user in users_to_add:
        c.execute("INSERT OR IGNORE INTO users (username, password, has_items, wants_items, profile_pic, phone, email, address, website) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", user)
    
    conn.commit()
    conn.close()

init_db()