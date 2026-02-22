import json
import os
from config.settings import supabase, SERP_KEY, gemini, model
from google.genai import types
from serpapi import GoogleSearch
from utils.gemini import build_comparison_query

COUNTRY_MAP = {
    "india": "in",
    "united states": "us",
    "usa": "us",
    "united kingdom": "uk",
    "canada": "ca",
    "australia": "au",
    "germany": "de",
    "france": "fr",
    "japan": "jp",
}


def get_location_codes(user_location):
    """Extracts the country from the location string and returns gl and hl codes."""
    country_name = user_location.split(",")[-1].strip().lower()
    gl_code = COUNTRY_MAP.get(country_name, "us")
    hl_code = "en"
    return gl_code, hl_code


def search_serp(query: str, user_location: str, fallback_query: str = None):
    """
    Searches Google Shopping via SerpAPI.
    Returns the list of shopping results (may be empty).
    Tries the primary query first, then an optional fallback.
    """
    gl_code, hl_code = get_location_codes(user_location)

    for attempt, q in enumerate([query, fallback_query], 1):
        if not q:
            continue

        print(f"🔍 SerpAPI attempt {attempt}: '{q}' (gl={gl_code})")

        params = {
            "engine": "google_shopping",
            "q": q,
            "hl": hl_code,
            "gl": gl_code,
            "api_key": SERP_KEY,
        }

        try:
            search = GoogleSearch(params)
            results = search.get_dict()
            shopping_results = results.get("shopping_results", [])
            print(f"🔍 SerpAPI returned {len(shopping_results)} results")
            if shopping_results:
                return shopping_results
        except Exception as e:
            print(f"SerpAPI error: {e}")

    print("🔍 SerpAPI: no results after all attempts")
    return []


def check_cache(product_data: dict, user_location: str, mode: str):
    """
    Checks the Supabase cache for a matching comparison result.
    """
    product_name = product_data.get("product_name", "").lower()
    brand = product_data.get("brand", "").lower()
    city = user_location.split(",")[0].strip()

    print(f"Checking cache for: {brand} {product_name} in {city}...")

    try:
        response = supabase.table('cached_products') \
            .select('*') \
            .ilike('city', city) \
            .ilike('brand', brand) \
            .ilike('product_name', product_name) \
            .execute()

        if response.data and len(response.data) > 0:
            hit = response.data[0]
            if hit.get("domestic_price"):
                print("Cache hit found (with comparison price)!")
                return hit
            print("Cache hit found but no comparison price — skipping.")

        print("No cache hit.")
        return None

    except Exception as e:
        print("Error checking cache:", e)
        return None


def add_to_cache(product_data: dict, user_location: str, user_price: float,
                 comparison_price: float, store_name: str = None, is_pink_tax: bool = False):
    """
    Adds a new entry to the cache in Supabase.
    Checks for duplicates before inserting.
    """
    if not comparison_price:
        print("No comparison price — skipping cache insert.")
        return

    product_name = product_data.get("product_name", "Unknown")
    brand = product_data.get("brand", "Unknown")

    location_parts = [part.strip() for part in user_location.split(",")]
    city = location_parts[0] if len(location_parts) > 0 else "Unknown"
    country = location_parts[-1] if len(location_parts) > 1 else "Unknown"

    # Duplicate check
    try:
        existing = supabase.table('cached_products') \
            .select('id') \
            .ilike('product_name', product_name) \
            .ilike('brand', brand) \
            .ilike('city', city) \
            .eq('domestic_price', comparison_price) \
            .limit(1) \
            .execute()

        if existing.data and len(existing.data) > 0:
            print(f"Duplicate already cached for {brand} {product_name} in {city} — skipping.")
            return
    except Exception as e:
        print("Error during duplicate check:", e)

    volume = product_data.get("volume", "")
    category = product_data.get("category", "")
    product_des = f"{volume} - {category}".strip(" -")

    payload = {
        "product_name": product_name,
        "product_price": user_price,
        "product_des": product_des if product_des else None,
        "pink_tax": is_pink_tax,
        "store_name": store_name,
        "city": city,
        "country": country,
        "domestic_price": comparison_price,
        "brand": brand,
    }

    try:
        supabase.table('cached_products').insert(payload).execute()
        print("Successfully added entry to cached_products.")
    except Exception as e:
        print("Error adding to cache:", e)


def pick_best_result(shopping_results: list, product_data: dict, mode: str) -> dict | None:
    """
    Picks the best matching product from SERP results.
    Filters out replacement parts, accessories, refurbished items, and other junk.
    Scores remaining results by title-word overlap with the original product.
    """
    if not shopping_results:
        return None

    product_name = (product_data.get("product_name") or "").lower()
    brand = (product_data.get("brand") or "").lower()

    # Words in SERP titles that signal the result is NOT the actual product
    NEGATIVE_KEYWORDS = [
        "replacement", "refurbished", "renewed", "used", "pre-owned",
        "open box", "case only", "for parts", "parts only",
        "repair", "compatible with", "compatible for",
        "skin", "cover", "protector", "silicone", "sleeve",
        "sticker", "decal", "screen protector", "tempered glass",
        "charger only", "charging case only", "ear tips", "ear pads",
        "knockoff", "generic", "third party", "3rd party",
    ]

    # Prefer real retailers over marketplace resellers
    PREFERRED_SOURCES = [
        "amazon", "walmart", "target", "best buy", "bestbuy",
        "costco", "staples", "b&h", "adorama", "newegg",
        "official", "apple", "samsung", "google store",
    ]

    filtered = []
    for result in shopping_results:
        title = (result.get("title") or "").lower()

        # Skip results with no price
        if not result.get("extracted_price"):
            continue

        # Skip results matching negative keywords
        if any(neg in title for neg in NEGATIVE_KEYWORDS):
            print(f"   ❌ Filtered out: '{result.get('title')}' (negative keyword)")
            continue

        filtered.append(result)

    # If everything got filtered, fall back to all priced results
    if not filtered:
        filtered = [r for r in shopping_results if r.get("extracted_price")]
        print("   ⚠️ All results filtered — falling back to unfiltered")

    if not filtered:
        return shopping_results[0] if shopping_results else None

    # Score each result by word overlap + source quality
    target_words = set(product_name.split()) | set(brand.split())
    # Remove tiny noise words
    target_words -= {"the", "a", "an", "and", "or", "for", "with", "in", "-", "&"}

    def score(result):
        title_words = set((result.get("title") or "").lower().split())
        overlap = len(target_words & title_words)
        source = (result.get("source") or "").lower()
        source_bonus = 2 if any(ps in source for ps in PREFERRED_SOURCES) else 0
        return overlap + source_bonus

    filtered.sort(key=score, reverse=True)
    best = filtered[0]
    print(f"   🎯 Best match (score {score(best)}): '{best.get('title')}' at ${best.get('extracted_price')} from {best.get('source')}")
    return best


def run_comparison_analysis(product_data: dict, user_price: float, mode: str, user_location: str) -> dict:
    """
    MASTER ORCHESTRATOR — New comparison-based pipeline.

    1. Check cache for existing comparison result
    2. Ask Gemini to generate the right comparison search query (mode-aware)
    3. SERP for the comparison product
    4. Compare prices
    5. Cache the result

    Returns dict with: comparison_price, comparable_product, source
    """
    print(f"\n🚀 Starting Comparison Analysis — mode={mode}, location={user_location}")
    print(f"📦 Product: {product_data.get('brand')} {product_data.get('product_name')}")
    print(f"💰 User price: {user_price}")

    # ── Step 1: Check cache ──────────────────────────────────────────
    cached = check_cache(product_data, user_location, mode)
    if cached:
        return {
            "comparison_price": float(cached.get("domestic_price", 0)),
            "comparable_product": cached.get("product_name", "Cached result"),
            "source": "cache",
        }

    # ── Step 2: Generate comparison search query via Gemini ──────────
    comparison_info = build_comparison_query(product_data, mode)
    search_query = comparison_info.get("search_query", "")
    comparable_desc = comparison_info.get("comparable_description", "")

    if not search_query:
        # Emergency fallback
        brand = product_data.get("brand", "")
        product_name = product_data.get("product_name", "")
        category = product_data.get("category", "")
        search_query = f"{brand} {product_name} {category}"

    # ── Step 3: SERP for the comparison product ──────────────────────
    # Build a broader fallback query
    brand = product_data.get("brand", "")
    category = product_data.get("category", "")
    gender = product_data.get("gender_marketing", "unisex")

    if mode == "travel" or mode == "general":
        fallback_query = f"{brand} {product_data.get('product_name', '')}".strip()
    else:
        target = "men" if gender == "women" else "women"
        fallback_query = f"{target} {category}".strip()

    shopping_results = search_serp(search_query, user_location, fallback_query)

    comparison_price = None
    comparable_product = comparable_desc or "No comparable product found"
    store_name = None

    if shopping_results:
        top = pick_best_result(shopping_results, product_data, mode)
        if top:
            comparison_price = top.get("extracted_price")
            comparable_product = top.get("title", comparable_desc or "Unknown")
            store_name = top.get("source")
            print(f"✅ Comparison product: '{comparable_product}' at ${comparison_price} from {store_name}")
        else:
            print("⚠️ All SERP results filtered out — no good match")
    else:
        print("⚠️ No comparison products found via SERP")

    # ── Step 4: Determine markup ─────────────────────────────────────
    is_pink_tax = False
    if comparison_price and user_price > float(comparison_price):
        is_pink_tax = True

    # ── Step 5: Cache the result ─────────────────────────────────────
    if comparison_price:
        add_to_cache(
            product_data=product_data,
            user_location=user_location,
            user_price=user_price,
            comparison_price=float(comparison_price),
            store_name=store_name,
            is_pink_tax=is_pink_tax,
        )

    return {
        "comparison_price": float(comparison_price) if comparison_price else 0,
        "comparable_product": comparable_product,
        "source": store_name or "none",
    }