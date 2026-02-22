import json
import os
import statistics
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

    MODE-AWARE LOCATION:
    - Pink Tax & General → search in the user's actual market (gl from location).
    - Tourist Tax → search in reference market (US) to get standard prices,
      since the user is at a tourist location and we want the normal retail price.
    """
    if mode == "travel":
        # Tourist Tax: always use US as the reference market
        gl_code = "us"
        hl_code = "en"
        print(f"🌍 Tourist Tax mode → forcing gl=us (reference market)")
    else:
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

    # Gender keywords for pink tax scoring
    FEMALE_KEYWORDS = ["women", "woman", "her", "ladies", "female", "girl", "venus", "she"]
    MALE_KEYWORDS = ["men", "man", "his", "male", "boy", "gentleman"]

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
        return (shopping_results[0], [shopping_results[0]]) if shopping_results else (None, [])

    # Score each result by word overlap + source quality + mode-specific logic
    target_words = set(product_name.split()) | set(brand.split()) | set(volume.split()) | set(category.split())
    target_words -= {"the", "a", "an", "and", "or", "for", "with", "in", "-", "&", ""}

    def score(result):
        title = (result.get("title") or "").lower()
        title_words = set(title.split())

        # Base: word overlap with original product
        overlap = len(target_words & title_words)

        # Bonus: preferred retailer
        source = (result.get("source") or "").lower()
        
        # --- FIX 1: Penalize 3rd party sellers ---
        # SerpAPI usually formats 3rd party sellers with a hyphen (e.g. "Walmart - Pharma Frills")
        is_third_party = "-" in source
        
        source_bonus = 0
        if any(ps in source for ps in PREFERRED_SOURCES):
            # Only give the +2 bonus if it's a 1st party seller
            source_bonus = 2 if not is_third_party else 0

        # Mode-specific scoring
        mode_bonus = 0

        if mode == "girl":
            # Pink Tax: we WANT the opposite-gender result
            if gender == "women":
                # Original is women's → we want men's results
                has_target = any(kw in title for kw in MALE_KEYWORDS)
                has_original = any(kw in title for kw in FEMALE_KEYWORDS)
            elif gender == "men":
                # Original is men's → we want women's results
                has_target = any(kw in title for kw in FEMALE_KEYWORDS)
                has_original = any(kw in title for kw in MALE_KEYWORDS)
            else:
                has_target = False
                has_original = False

            if has_target:
                mode_bonus += 3  # Boost: correct target gender
            if has_original:
                mode_bonus -= 3  # Penalize: same gender as original

            # Bonus: same brand for pink tax (same brand, different gender)
            if brand and brand in title:
                mode_bonus += 2

        else:
            # Tourist Tax / General: we want the EXACT same product
            # Bonus for brand match
            if brand and brand in title:
                mode_bonus += 3
            # Bonus for close product name match (high overlap)
            if overlap >= 3:
                mode_bonus += 2

        # --- NEW FIX: The Bulk/Bundle Penalty ---
        # If the listing implies multiple boxes, nuke its score so it drops to the bottom.
        bulk_penalty = 0
        bulk_red_flags = ["packs of", "pack of 2", "pack of 3", "pack of 4", "pack of 6", "bundle", "ct-total", "total"]
        
        if any(flag in title for flag in bulk_red_flags):
            bulk_penalty = -10  # Massive penalty to guarantee it doesn't get picked
            print(f"   📉 Penalized bulk listing: '{title}'")

        return overlap + source_bonus + mode_bonus + bulk_penalty

    # --- FIX 2: Tie-break by lowest price ---
    # Sort primarily by highest score (-score(r)), then secondarily by lowest price
    filtered.sort(key=lambda r: (-score(r), float(r.get("extracted_price", 9999))))
    
    best = filtered[0]
    best_score = score(best)
    
    # Find similar items (score within 2 of best) to calculate average market price
    similar_items = [r for r in filtered if score(r) >= best_score - 2][:15]
    
    print(f"   🎯 Best match ({mode}, score {best_score}): '{best.get('title')}' at ${best.get('extracted_price')} from {best.get('source')}")
    return best, similar_items


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
    # Temporarily disabled cache so we always get live images and links
    # cached = check_cache(product_data, user_location, mode)
    # if cached:
    #     return {
    #         "comparison_price": float(cached.get("domestic_price", 0)),
    #         "comparable_product": cached.get("product_name", "Cached result"),
    #         "source": "cache",
    #     }

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
            
            # --- FIX 1: The Anchor Filter ---
            # We trust 'top_price' because our previous fix guarantees it's a low-priced, 1st-party source.
            # If any "similar" item is more than 2.5x the top price, it is 100% a dropshipper 
            # or a bulk multipack (e.g., 12-count instead of 4-count). Drop it entirely.
            plausible_prices = [p for p in raw_prices if p <= (top_price * 2.5)]
            
            # --- FIX 2: Median over Mean ---
            # The median finds the exact middle of the plausible prices. 
            # It is practically immune to lingering right-skewed outliers.
            if plausible_prices:
                comparison_price = statistics.median(plausible_prices)
            else:
                comparison_price = top_price
            
            suggestion_price = top_price
            
            comparable_product = top.get("title", comparable_desc or "Unknown")
            store_name = top.get("source")
            suggestion_image = top.get("thumbnail")
            suggestion_link = top.get("link") or top.get("product_link")
            
            print(f"✅ Comparison product: '{comparable_product}' at ${suggestion_price} from {store_name}")
            print(f"📊 Median market price of {len(plausible_prices)} valid items: ${comparison_price:.2f}")
            if suggestion_image:
                print(f"🖼️  Thumbnail: {suggestion_image[:80]}...")
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
        "suggestion_price": float(suggestion_price) if suggestion_price else 0,
        "comparable_product": comparable_product,
        "source": store_name or "none",
        "suggestion_image": suggestion_image,
        "suggestion_link": suggestion_link,
    }