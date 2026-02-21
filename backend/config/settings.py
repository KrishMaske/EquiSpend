import os
from dotenv import load_dotenv
from supabase import create_client

from google import genai
from google.genai import types

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

gemini = genai.Client(api_key=GEMINI_API_KEY)
model = "gemini-2.5-flash"