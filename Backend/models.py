from pydantic import BaseModel
from typing import List

class UserBase(BaseModel):
    username: str
    has_items: List[str] = []
    wants_items: List[str] = []

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

class UserUpdate(UserBase):
    profile_pic: str = ""
    phone: str = ""
    email: str = ""
    address: str = ""
    website: str = ""
    lat: float = 27.7172
    lng: float = 85.3240

class MessageCreate(BaseModel):
    sender: str
    receiver: str
    text: str
    type: str = "text"