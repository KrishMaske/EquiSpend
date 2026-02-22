from fastapi import APIRouter, Form, UploadFile, File, HTTPException
from typing import Optional
import io
from PIL import Image
from utils.gemini import build_identify_prompt, analyze_image
from utils.logic import run_comparison_analysis

router = APIRouter()

CURRENCY_SYMBOLS = {
    "USD": "$", "EUR": "€", "GBP": "£", "INR": "₹", "JPY": "¥",
    "CNY": "¥", "CAD": "C$", "AUD": "A$", "CHF": "Fr", "SGD": "S$",
    "MXN": "$", "BRL": "R$", "KRW": "₩", "AED": "د.إ", "SAR": "﷼",
    "THB": "฿", "IDR": "Rp", "TRY": "₺", "ZAR": "R", "SEK": "kr",
}


def optimize_image(pil_image: Image.Image, max_size: int = 1024) -> Image.Image:
    """Resize image to reduce token consumption while maintaining aspect ratio."""
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


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# ENDPOINT 1: Identify the product (Gemini vision only)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
@router.post("/scan/identify")
async def identify_endpoint(
    image: UploadFile = File(...),
):
    """
    Accepts a product image and returns the identified product info.
    The user will verify this and then manually input their price.
    """
    image_bytes = await image.read()
    pil_image = Image.open(io.BytesIO(image_bytes))
    optimized_image = optimize_image(pil_image)

    try:
        prompt = build_identify_prompt()
        product_data = analyze_image(optimized_image, prompt)

        return {
            "status": "success",
            "data": {
                "brand": product_data.get("brand", "Unknown"),
                "product_name": product_data.get("product_name", "Unknown"),
                "category": product_data.get("category", "Unknown"),
                "volume": product_data.get("volume", ""),
                "gender_marketing": product_data.get("gender_marketing", "unisex"),
                "description": product_data.get("description", ""),
            }
        }

    except Exception as e:
        print(f"Identify error: {e}")
        raise HTTPException(status_code=500, detail=f"Error identifying product: {str(e)}")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# ENDPOINT 2: Analyze (compare pricing)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
@router.post("/scan/analyze")
async def analyze_endpoint(
    mode: str = Form(...),
    brand: str = Form(...),
    product_name: str = Form(...),
    category: str = Form(...),
    volume: Optional[str] = Form(""),
    gender_marketing: Optional[str] = Form("unisex"),
    user_price: str = Form(...),
    city: Optional[str] = Form(None),
    state: Optional[str] = Form(None),
    country: Optional[str] = Form(None),
    currency: Optional[str] = Form("USD"),
):
    """
    Accepts confirmed product data + user-entered price + mode.
    Runs the comparison pipeline:
      - Pink Tax: finds comparable opposite-gender product, compares prices
      - Tourist Tax: finds same product domestic price, compares
    """
    currency_symbol = CURRENCY_SYMBOLS.get(currency or "USD", currency or "$")
    parts = [p for p in [city, state, country] if p]
    user_location = ", ".join(parts) if parts else "Unknown"

    try:
        price = float(user_price)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid price value")

    product_data = {
        "brand": brand,
        "product_name": product_name,
        "category": category,
        "volume": volume or "",
        "gender_marketing": gender_marketing or "unisex",
    }

    try:
        def format_result(res, label_price):
            return {
                "product_name": product_name,
                "price_scanned": price,
                "fair_price": res.get("comparison_price", 0),
                "suggestion_price": res.get("suggestion_price", 0),
                "equity_gap": round(max(0, price - (res.get("comparison_price") or 0)), 2),
                "currency_symbol": currency_symbol,
                "comparable_product": res.get("comparable_product", ""),
                "source": res.get("source", ""),
                "suggestion_image": res.get("suggestion_image"),
                "suggestion_link": res.get("suggestion_link"),
            }

        if mode == "both":
            # ── Run TWO separate analyses: Pink Tax + Tourist Tax ──
            print("🔀 Both mode: running Pink Tax analysis...")
            girl_result = run_comparison_analysis(product_data, price, "girl", user_location, currency or "USD")
            girl_formatted = format_result(girl_result, price)

            print("🔀 Both mode: running Tourist Tax analysis...")
            travel_result = run_comparison_analysis(product_data, price, "travel", user_location, currency or "USD")
            travel_formatted = format_result(travel_result, price)

            return {"status": "success", "data": {"girl": girl_formatted, "travel": travel_formatted}}

        elif mode == "general":
            result = run_comparison_analysis(product_data, price, mode, user_location, currency or "USD")
            formatted = format_result(result, price)
            return {"status": "success", "data": {"general": formatted}}

        else:
            # Single mode: 'girl' or 'travel'
            result = run_comparison_analysis(product_data, price, mode, user_location, currency or "USD")
            formatted = format_result(result, price)
            return {"status": "success", "data": formatted}

    except Exception as e:
        print(f"Analyze error: {e}")
        raise HTTPException(status_code=500, detail=f"Error analyzing product: {str(e)}")