from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from config.settings import supabase

router = APIRouter(prefix="/auth", tags=["Authentication"])

class UserCredentials(BaseModel):
    email: str
    password: str

@router.post("/signup")
async def signup(credentials: UserCredentials):
    try:
        response = supabase.auth.sign_up({
            "email": credentials.email,
            "password": credentials.password
        })
        return {"message": "User created successfully", "user": response.user}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/login")
async def login(credentials: UserCredentials):
    try:
        response = supabase.auth.sign_in_with_password({
            "email": credentials.email,
            "password": credentials.password
        })
        return {"access_token": response.session.access_token, "user": response.user}
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid email or password")
