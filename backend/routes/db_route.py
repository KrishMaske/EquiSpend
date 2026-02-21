from fastapi import APIRouter
from data.queries import get_all_cities

router = APIRouter()

@router.get("/api/cities")
def cities():
    cities = get_all_cities()
    return {"cities": cities}