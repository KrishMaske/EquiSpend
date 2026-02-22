from fastapi import APIRouter, Form, UploadFile, File, HTTPException
from typing import Optional
import io
from PIL import Image
from utils.gemini import build_prompt, analyze_image
from utils.logic import run_equispend_analysis

router = APIRouter()

CURRENCY_SYMBOLS = {
    "USD": "$", "EUR": "€", "GBP": "£", "INR": "₹", "JPY": "¥",
    "CNY": "¥", "CAD": "C$", "AUD": "A$", "CHF": "Fr", "SGD": "S$",
    "MXN": "$", "BRL": "R$", "KRW": "₩", "AED": "د.إ", "SAR": "﷼",
    "THB": "฿", "IDR": "Rp", "TRY": "₺", "ZAR": "R", "SEK": "kr",
}


def optimize_image(pil_image: Image.Image, max_size: int = 1024) -> Image.Image:
    """
    Resize image to reduce token consumption while maintaining aspect ratio.
    """
    if pil_image.mode in ('RGBA', 'P'):
        pil_image = pil_image.convert('RGB')

    width, height = pil_image.size
    if width > max_size or height > max_size:
        if width > height:
            new_width = max_size
            new_height = int(max_size * (height / width))
        else:
            new_height = max_size
            new_width = int(max_size * (width / height))

        pil_image = pil_image.resize((new_width, new_height), Image.Resampling.LANCZOS)

    return pil_image


def build_location_string(city: str | None, state: str | None, country: str | None) -> str:
    parts = [p for p in [city, state, country] if p]
    return ", ".join(parts) if parts else "Unknown"


def format_result(gemini_data: dict, pipeline_result: dict, currency_symbol: str) -> dict:
    """Transform pipeline output into the shape the frontend expects."""
    product_name = gemini_data.get("product_name", "Unknown Product")

    if pipeline_result.get("source") == "supabase_cache":
        cached = pipeline_result["data"]
        price_scanned = float(cached.get("product_price") or 0)
        fair_price = float(cached.get("domestic_price") or price_scanned)
    else:
        data = pipeline_result.get("data", {})
        price_scanned = float(data.get("scanned_price") or 0)
        fair_price = float(data.get("domestic_market_price") or price_scanned)

    equity_gap = round(max(0, price_scanned - fair_price), 2)

    return {
        "product_name": product_name,
        "price_scanned": price_scanned,
        "fair_price": fair_price,
        "equity_gap": equity_gap,
        "currency_symbol": currency_symbol,
    }


@router.post("/scan")
async def scan_endpoint(
    image: UploadFile = File(...),
    mode: str = Form(...),
    city: Optional[str] = Form(None),
    state: Optional[str] = Form(None),
    country: Optional[str] = Form(None),
    latitude: Optional[str] = Form(None),
    longitude: Optional[str] = Form(None),
    currency: Optional[str] = Form("USD"),
    manual_price: Optional[str] = Form(None),
    location: Optional[str] = Form(None),  # backward compat
):
    image_bytes = await image.read()
    pil_image = Image.open(io.BytesIO(image_bytes))
    optimized_image = optimize_image(pil_image)

    user_location = build_location_string(city, state, country)
    currency_symbol = CURRENCY_SYMBOLS.get(currency or "USD", currency or "$")

    try:
        # Step 1: Single Gemini vision call (same for all modes)
        prompt = build_prompt(mode)
        gemini_data = analyze_image(optimized_image, prompt)

        # Override price if manual price was provided
        if manual_price:
            try:
                gemini_data["price_found"] = float(manual_price)
            except (ValueError, TypeError):
                pass

        # Step 2: Single pipeline run (cache → SERP → Numbeo)
        pipeline_result = run_equispend_analysis(gemini_data, user_location)

        # Step 3: Format for frontend
        formatted = format_result(gemini_data, pipeline_result, currency_symbol)

        if mode == "both":
            # Same scan data shown under both pink tax & travel cards
            return {"status": "success", "data": {"girl": formatted, "travel": formatted}}
        else:
            return {"status": "success", "data": formatted}

    except Exception as e:
        print(f"Scan error: {e}")
        raise HTTPException(status_code=500, detail=f"Error analyzing image: {str(e)}")