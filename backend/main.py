import os
import io
import json
import sqlite3
from typing import Optional
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from google import genai
from PIL import Image

# =======================================================================
#  1. Configuration — load API key from .env
# =======================================================================
load_dotenv(Path(__file__).resolve().parent / ".env")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise RuntimeError(
        "GEMINI_API_KEY is not set. "
        "Create a backend/.env file with:  GEMINI_API_KEY=your_key_here"
    )

client = genai.Client(api_key=GEMINI_API_KEY)

app = FastAPI(title="EquiSpend API")

# Currency code -> symbol mapping (shared between prompt builder and response)
CURRENCY_SYMBOLS: dict[str, str] = {
    'USD': '$', 'EUR': '\u20ac', 'GBP': '\u00a3', 'INR': '\u20b9',
    'JPY': '\u00a5', 'CNY': '\u00a5', 'CAD': 'C$', 'AUD': 'A$',
    'CHF': 'Fr', 'SGD': 'S$', 'MXN': '$', 'BRL': 'R$',
    'KRW': '\u20a9', 'AED': '\u062f.\u0625', 'SAR': '\ufdfc',
    'THB': '\u0e3f', 'IDR': 'Rp', 'TRY': '\u20ba', 'ZAR': 'R', 'SEK': 'kr',
}

# Allow the Expo frontend (web + mobile) to reach the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =======================================================================
#  2. Database Setup
# =======================================================================
DB_PATH = Path(__file__).resolve().parent / "equispend.db"


def setup_db():
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS scans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            mode TEXT,
            product_name TEXT,
            price_scanned REAL,
            fair_price REAL,
            equity_gap REAL,
            manual_price REAL,
            currency TEXT DEFAULT 'USD',
            latitude REAL,
            longitude REAL,
            city TEXT,
            country TEXT,
            raw_gemini_response TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    # Add columns to existing DBs if they don't exist yet
    for col, defn in [('manual_price', 'REAL'), ('currency', "TEXT DEFAULT 'USD'")]:
        try:
            cursor.execute(f"ALTER TABLE scans ADD COLUMN {col} {defn}")
        except Exception:
            pass  # Column already exists
    conn.commit()
    conn.close()


setup_db()

# =======================================================================
#  3. Extensible Data-Source Registry
#     -----------------------------------------------------------------
#     Each mode can have CSV / API data sources plugged in later.
#     Register a callable   (product_name: str) -> dict | None
#     in the appropriate list.
# =======================================================================
DATA_SOURCES: dict[str, list] = {
    "girl": [],      # future: Open Beauty Facts, SerpApi, gendered-pricing CSVs
    "travel": [],    # future: Numbeo CSV, regional MRP databases, SerpApi
}


def query_data_sources(mode: str, product_name: str) -> Optional[dict]:
    """Run registered data-source hooks.  Returns the first hit or None."""
    for source_fn in DATA_SOURCES.get(mode, []):
        try:
            result = source_fn(product_name)
            if result is not None:
                return result
        except Exception:
            continue
    return None


# =======================================================================
#  4. Build Prompts (location-aware)
# =======================================================================
def build_prompt(
    mode: str,
    city: Optional[str],
    country: Optional[str],
    manual_price: Optional[float] = None,
    currency: str = 'USD',
) -> str:
    currency_sym = CURRENCY_SYMBOLS.get(currency, currency)
    location_context = ""
    if city and country:
        location_context = (
            f"\nThe user is currently in {city}, {country}. "
            "Use this location to give more accurate local pricing.\n"
        )
    elif country:
        location_context = (
            f"\nThe user is currently in {country}. "
            "Use this location to give more accurate local pricing.\n"
        )
    elif city:
        location_context = (
            f"\nThe user is currently in {city}. "
            "Use this location to give more accurate local pricing.\n"
        )

    price_override = ""
    if manual_price is not None:
        price_override = (
            f"\nIMPORTANT: The user has manually entered the price as "
            f"{currency_sym}{manual_price:.2f} {currency}. "
            f"Use this as the price_scanned value exactly — do NOT estimate it from the image.\n"
        )

    if mode == "girl":
        return f"""\
Analyze this product image carefully.
{location_context}{price_override}
1. Identify the product name and brand.
2. {'Use the price provided above as price_scanned.' if manual_price else 'Estimate its current retail price (the price a woman would pay).'}
3. Estimate the price of a generic or male-equivalent version of this product.
4. Calculate the 'Pink Tax' — the price difference between the female-marketed
   version and the male/generic equivalent.

Return ONLY a valid JSON object (no markdown, no explanation) with these keys:
  "product_name"   (string)
  "price_scanned"  (number — the female-marketed price, in {currency})
  "fair_price"     (number — the male/generic equivalent price, in {currency})
  "equity_gap"     (number — price_scanned minus fair_price)
"""

    else:  # travel
        return f"""\
Analyze this product or receipt image carefully.
{location_context}{price_override}
1. Identify the item name.
2. {'Use the price provided above as price_scanned.' if manual_price else 'Estimate the listed / visible price.'}
3. Estimate the fair local price for this item — what a resident of
   {city or 'a standard city'} would normally pay (not in a tourist area).
4. Calculate the 'Tourist Tax' — the difference between the listed price
   and the fair local price.

Return ONLY a valid JSON object (no markdown, no explanation) with these keys:
  "product_name"   (string)
  "price_scanned"  (number — the price shown to a tourist, in {currency})
  "fair_price"     (number — the fair local price, in {currency})
  "equity_gap"     (number — price_scanned minus fair_price)
"""


# =======================================================================
#  5. Core Analysis Function
# =======================================================================
async def _run_analysis(
    mode: str,
    pil_image: Image.Image,
    city: Optional[str] = None,
    country: Optional[str] = None,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    manual_price: Optional[float] = None,
    currency: str = 'USD',
) -> dict:
    """Run Gemini analysis for a single mode and return the parsed result."""
    prompt = build_prompt(mode, city, country, manual_price, currency)

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=[prompt, pil_image],
    )

    clean_text = response.text.replace("```json", "").replace("```", "").strip()
    scan_data = json.loads(clean_text)

    if manual_price is not None:
        scan_data['price_scanned'] = manual_price
        scan_data['equity_gap'] = round(manual_price - scan_data.get('fair_price', 0), 2)

    # Echo back the currency symbol so the frontend can display it
    scan_data['currency_symbol'] = CURRENCY_SYMBOLS.get(currency, currency)

    # --- Data-source enrichment (future CSV / API hooks) ----------------
    ds_result = query_data_sources(mode, scan_data.get('product_name', ''))
    if ds_result and "fair_price" in ds_result:
        scan_data["fair_price"] = ds_result["fair_price"]
        scan_data["equity_gap"] = round(
            scan_data.get("price_scanned", 0) - ds_result["fair_price"], 2
        )
        scan_data["data_source"] = ds_result.get("source", "external")

    # --- Persist to database --------------------------------------------
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO scans
            (mode, product_name, price_scanned, fair_price, equity_gap,
             manual_price, currency,
             latitude, longitude, city, country, raw_gemini_response)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        mode,
        scan_data.get('product_name'),
        scan_data.get('price_scanned'),
        scan_data.get('fair_price'),
        scan_data.get('equity_gap'),
        manual_price,
        currency,
        latitude,
        longitude,
        city,
        country,
        clean_text,
    ))
    conn.commit()
    conn.close()

    return scan_data


# =======================================================================
#  6. API Endpoints
# =======================================================================
@app.post("/scan")
async def scan_product(
    mode: str = Form(...),
    image: UploadFile = File(...),
    latitude: Optional[str] = Form(None),
    longitude: Optional[str] = Form(None),
    city: Optional[str] = Form(None),
    country: Optional[str] = Form(None),
    manual_price: Optional[str] = Form(None),
    currency: str = Form('USD'),
):
    """
    Scan a product image for pricing inequity.

    Parameters
    ----------
    mode :         "girl" | "travel" | "both"
    image :        the product / receipt image
    latitude :     optional GPS latitude  (string, will be parsed to float)
    longitude :    optional GPS longitude (string, will be parsed to float)
    city :         optional reverse-geocoded city
    country :      optional reverse-geocoded country
    manual_price : optional user-provided price (overrides image detection)
    currency :     ISO 4217 currency code (default: USD)
    """
    try:
        image_bytes = await image.read()
        pil_image = Image.open(io.BytesIO(image_bytes))

        lat = float(latitude) if latitude else None
        lng = float(longitude) if longitude else None
        mprice = float(manual_price) if manual_price else None

        if mode == "both":
            girl_data = await _run_analysis("girl", pil_image, city, country, lat, lng, mprice, currency)
            travel_data = await _run_analysis("travel", pil_image, city, country, lat, lng, mprice, currency)
            return JSONResponse(content={
                "status": "success",
                "mode": "both",
                "data": {"girl": girl_data, "travel": travel_data},
                "location": {
                    "city": city, "country": country,
                    "latitude": lat, "longitude": lng,
                },
                "message": "Successfully processed in both modes.",
            })

        if mode not in ("girl", "travel"):
            return JSONResponse(
                content={"status": "error", "message": f"Unknown mode: {mode}"},
                status_code=400,
            )

        scan_data = await _run_analysis(mode, pil_image, city, country, lat, lng, mprice, currency)

        return JSONResponse(content={
            "status": "success",
            "data": scan_data,
            "location": {
                "city": city, "country": country,
                "latitude": lat, "longitude": lng,
            },
            "message": f"Successfully processed in {mode} mode.",
        })

    except Exception as e:
        return JSONResponse(
            content={"status": "error", "message": str(e)},
            status_code=500,
        )


@app.get("/health")
async def health():
    """Simple health-check endpoint."""
    return {"status": "ok"}