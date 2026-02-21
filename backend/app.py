from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes.db_route import router as db_router
from routes.scanner_route import router as scanner

app = FastAPI()

app.include_router(db_router)
app.include_router(scanner)

@app.get("/")
def root():
    return {"message": "Hello World"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)