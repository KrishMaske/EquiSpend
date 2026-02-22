import json
import os
import statistics
import urllib.request
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


def search_serp(query: str, user_location: str, mode: str = "general", fallback_query: str = None):
    """
    Searches Google Shopping via SerpAPI.
    Returns the list of shopping results (may be empty).
    Tries the primary query first, then an optional fallback.

    All modes search in the user's actual market (gl from location).
    Tourist Tax: compares the local online market price against the inflated price the tourist paid.
    """
    gl_code, hl_code = get_location_codes(user_location)
    print(f"🌍 Mode={mode} → searching gl={gl_code} (user's market)")

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
                 comparison_price: float, store_name: str = None, is_pink_tax: bool = False,
                 comparable_item_name: str = None, item_link: str = None, image_link: str = None,
                 serp_currency: str = None):
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
        "comparable_item_name": comparable_item_name,
        "item_link": item_link,
        "image_link": image_link,
        "serp_currency": serp_currency,
    }

    try:
        supabase.table('cached_products').insert(payload).execute()
        print(f"Successfully added entry to cached_products (currency={serp_currency}).")
    except Exception as e:
        print("Error adding to cache:", e)


def pick_best_result(shopping_results: list, product_data: dict, mode: str) -> tuple[dict | None, list]:
    """
    Picks the best matching product from SERP results and returns similar items.
    Filters out replacement parts, accessories, refurbished items, and other junk.

    MODE-AWARE SCORING:
    - Pink Tax  → boost results that mention the TARGET gender; penalize same-gender results.
    - Tourist/General → boost results that closely match the exact product name + brand.
    """
    if not shopping_results:
        return None, []

    product_name = (product_data.get("product_name") or "").lower()
    brand = (product_data.get("brand") or "").lower()
    gender = (product_data.get("gender_marketing") or "unisex").lower()
    volume = (product_data.get("volume") or "").lower()
    category = (product_data.get("category") or "").lower()

    NEGATIVE_KEYWORDS = [
        "replacement", "refurbished", "renewed", "used", "pre-owned",
        "open box", "case only", "for parts", "parts only",
        "repair", "compatible with", "compatible for",
        "skin", "cover", "protector", "silicone", "sleeve",
        "sticker", "decal", "screen protector", "tempered glass",
        "charger only", "charging case only", "ear tips", "ear pads",
        "knockoff", "generic", "third party", "3rd party",
    ]

    PREFERRED_SOURCES = [
        "amazon", "walmart", "target", "best buy", "bestbuy",
        "costco", "staples", "b&h", "adorama", "newegg",
        "official", "apple", "samsung", "google store",
    ]

    FEMALE_KEYWORDS = ["women", "woman", "her", "ladies", "female", "girl", "venus", "she"]
    MALE_KEYWORDS = ["men", "man", "his", "male", "boy", "gentleman"]

    filtered = []
    for result in shopping_results:
        title = (result.get("title") or "").lower()

        if not result.get("extracted_price"):
            continue

        if any(neg in title for neg in NEGATIVE_KEYWORDS):
            print(f"   ❌ Filtered out: '{result.get('title')}' (negative keyword)")
            continue

        filtered.append(result)

    if not filtered:
        filtered = [r for r in shopping_results if r.get("extracted_price")]
        print("   ⚠️ All results filtered — falling back to unfiltered")

    if not filtered:
        return (shopping_results[0], [shopping_results[0]]) if shopping_results else (None, [])

    target_words = set(product_name.split()) | set(brand.split()) | set(volume.split()) | set(category.split())
    target_words -= {"the", "a", "an", "and", "or", "for", "with", "in", "-", "&", ""}

    def score(result):
        title = (result.get("title") or "").lower()
        title_words = set(title.split())

        overlap = len(target_words & title_words)

        source = (result.get("source") or "").lower()
        
        is_third_party = "-" in source
        
        source_bonus = 0
        if any(ps in source for ps in PREFERRED_SOURCES):
            source_bonus = 4 if not is_third_party else 0

        delivery_apps = ["instacart", "doordash", "uber eats", "shipt", "gopuff", "walgreens delivery"]
        if any(app in source for app in delivery_apps):
            source_bonus -= 5
            print(f"   📉 Penalized delivery app: {source}")

        mode_bonus = 0

        if mode == "girl":
            if gender == "women":
                has_target = any(kw in title for kw in MALE_KEYWORDS)
                has_original = any(kw in title for kw in FEMALE_KEYWORDS)
            elif gender == "men":
                has_target = any(kw in title for kw in FEMALE_KEYWORDS)
                has_original = any(kw in title for kw in MALE_KEYWORDS)
            else:
                has_target = False
                has_original = False

            if has_target:
                mode_bonus += 3
            if has_original:
                mode_bonus -= 3

            if brand and brand in title:
                mode_bonus += 2

        else:
            if brand and brand in title:
                mode_bonus += 3
            if overlap >= 3:
                mode_bonus += 2

        bulk_penalty = 0
        bulk_red_flags = ["packs of", "pack of 2", "pack of 3", "pack of 4", "pack of 6", "bundle", "ct-total", "total"]
        
        if any(flag in title for flag in bulk_red_flags):
            bulk_penalty = -10
            print(f"   📉 Penalized bulk listing: '{title}'")

        return overlap + source_bonus + mode_bonus + bulk_penalty

    filtered.sort(key=lambda r: (-score(r), float(r.get("extracted_price", 9999))))
    
    best = filtered[0]
    best_score = score(best)
    
    similar_items = [r for r in filtered if score(r) >= best_score - 2][:15]
    
    print(f"   🎯 Best match ({mode}, score {best_score}): '{best.get('title')}' at ${best.get('extracted_price')} from {best.get('source')}")
    return best, similar_items


def run_comparison_analysis(product_data: dict, user_price: float, mode: str, user_location: str, user_currency: str = "USD") -> dict:
    """
    MASTER ORCHESTRATOR — New comparison-based pipeline.

    1. Check cache for existing comparison result
    2. Ask Gemini to generate the right comparison search query (mode-aware)
    3. SERP for the comparison product
    4. Compare prices
    5. Cache the result

    Returns dict with: comparison_price, comparable_product, source
    """
    print(f"\n🚀 Starting Comparison Analysis — mode={mode}, location={user_location}, currency={user_currency}")
    print(f"📦 Product: {product_data.get('brand')} {product_data.get('product_name')}")
    print(f"💰 User price: {user_price}")

    gl_code, _ = get_location_codes(user_location)
    
    GL_CURRENCY_MAP = {
        "us": "USD", "in": "INR", "uk": "GBP", "ca": "CAD",
        "au": "AUD", "de": "EUR", "fr": "EUR", "jp": "JPY"
    }
    serp_currency = GL_CURRENCY_MAP.get(gl_code, "USD")
    
    exchange_rate = 1.0
    if serp_currency != user_currency:
        try:
            url = f"https://open.er-api.com/v6/latest/{serp_currency}"
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=5) as response:
                data = json.loads(response.read().decode())
                exchange_rate = data.get("rates", {}).get(user_currency, 1.0)
                print(f"💱 Currency conversion: 1 {serp_currency} = {exchange_rate} {user_currency}")
        except Exception as e:
            print(f"⚠️ Error fetching exchange rate: {e}")
    else:
        print(f"💱 No conversion needed — SERP and user both use {user_currency}")

    cached = check_cache(product_data, user_location, mode)
    if cached:
        cached_currency = cached.get("serp_currency") or None
        if cached_currency == user_currency:
            comp_price = float(cached.get("domestic_price", 0))
            print(f"✅ Cache hit — price already in {user_currency}")
            return {
                "comparison_price": comp_price,
                "suggestion_price": comp_price,
                "comparable_product": cached.get("comparable_item_name") or cached.get("product_name", "Cached result"),
                "source": cached.get("store_name") or "cache",
                "suggestion_image": cached.get("image_link"),
                "suggestion_link": cached.get("item_link"),
            }
        else:
            print(f"⚠️ Cache hit but currency mismatch (cached={cached_currency}, need={user_currency}) — skipping")

    comparison_info = build_comparison_query(product_data, mode)
    search_query = comparison_info.get("search_query", "")
    comparable_desc = comparison_info.get("comparable_description", "")

    if not search_query:
        brand = product_data.get("brand", "")
        product_name = product_data.get("product_name", "")
        category = product_data.get("category", "")
        search_query = f"{brand} {product_name} {category}"

    brand = product_data.get("brand", "")
    category = product_data.get("category", "")
    gender = product_data.get("gender_marketing", "unisex")

    if mode == "travel" or mode == "general":
        fallback_query = f"{brand} {product_data.get('product_name', '')}".strip()
    else:
        target = "men" if gender == "women" else "women"
        fallback_query = f"{brand} {target} {category}".strip()

    shopping_results = search_serp(search_query, user_location, mode, fallback_query)

    comparison_price = None
    suggestion_price = None
    comparable_product = comparable_desc or "No comparable product found"
    store_name = None
    suggestion_image = None
    suggestion_link = None

    if shopping_results:
        top, similar_items = pick_best_result(shopping_results, product_data, mode)
        if top:
            top_price = float(top.get("extracted_price"))
            raw_prices = sorted([float(r.get("extracted_price")) for r in similar_items])
            
            plausible_prices = [p for p in raw_prices if p <= (top_price * 2.5)]
            
            if plausible_prices:
                median_price = statistics.median(plausible_prices)
                
                closest_item = min(
                    [item for item in similar_items if float(item.get("extracted_price")) in plausible_prices],
                    key=lambda x: abs(float(x.get("extracted_price")) - median_price)
                )
                
                comparison_price = float(closest_item.get("extracted_price"))
            else:
                comparison_price = top_price
                closest_item = top
            
            suggestion_price = comparison_price
            
            comparable_product = closest_item.get("title", comparable_desc or "Unknown")
            store_name = closest_item.get("source")
            suggestion_image = closest_item.get("thumbnail")
            suggestion_link = closest_item.get("link") or closest_item.get("product_link")
            
            print(f"✅ Comparison product: '{comparable_product}' at ${suggestion_price} from {store_name}")
            print(f"📊 Median market price of {len(plausible_prices)} valid items: ${median_price:.2f}")
            print(f"🎯 Selected closest item price: ${comparison_price:.2f}")
            if suggestion_image:
                print(f"🖼️  Thumbnail: {suggestion_image[:80]}...")
        else:
            print("⚠️ All SERP results filtered out — no good match")
    else:
        print("⚠️ No comparison products found via SERP")

    is_pink_tax = False
    converted_comparison_price = None
    converted_suggestion_price = None
    
    if comparison_price:
        converted_comparison_price = float(comparison_price) * exchange_rate
        converted_suggestion_price = float(suggestion_price) * exchange_rate
        if user_price > converted_comparison_price:
            is_pink_tax = True

    if converted_comparison_price:
        add_to_cache(
            product_data=product_data,
            user_location=user_location,
            user_price=user_price,
            comparison_price=converted_comparison_price,
            store_name=store_name,
            is_pink_tax=is_pink_tax,
            comparable_item_name=comparable_product,
            item_link=suggestion_link,
            image_link=suggestion_image,
            serp_currency=user_currency,
        )

    return {
        "comparison_price": converted_comparison_price if converted_comparison_price else 0,
        "suggestion_price": converted_suggestion_price if converted_suggestion_price else 0,
        "comparable_product": comparable_product,
        "source": store_name or "none",
        "suggestion_image": suggestion_image,
        "suggestion_link": suggestion_link,
    }