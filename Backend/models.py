from pydantic import BaseModel
from typing import List

class UserCreate(BaseModel):
    username: str
    password: str
    has_items: List[str] = []
    wants_items: List[str] = []

class UserLogin(BaseModel):
    username: str
    password: str

class UserUpdate(BaseModel):
    username: str
    has_items: List[str] = []
    wants_items: List[str] = []
    profile_pic: str = ""
    phone: str = ""
    email: str = ""
    address: str = ""
    website: str = ""

class MessageCreate(BaseModel):
    sender: str
    receiver: str
    text: str
    type: str = "text"