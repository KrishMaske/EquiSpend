import json
import os
from config.settings import supabase, SERP_KEY, gemini, model
from google.genai import types
from serpapi import GoogleSearch

COUNTRY_MAP = {
    "india": "in",
    "united states": "us",
    "usa": "us",
    "united kingdom": "uk", 
    "canada": "ca",
    "australia": "au",
    "germany": "de",
    "france": "fr",
    "japan": "jp"
}

def get_location_codes(user_location):
    """
    Extracts the country from the location string and returns the gl and hl codes.
    """
    country_name = user_location.split(",")[-1].strip().lower()
    
    gl_code = COUNTRY_MAP.get(country_name, "us")
    
    hl_code = "en" 
    
    return gl_code, hl_code


def check_cache(gemini_response, user_location):
    """
    Checks the Supabase cache for a matching product in the same city.
    """
    product_name = gemini_response.get("product_name", "").lower()
    brand = gemini_response.get("brand", "").lower()
    
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
            print("Cache hit found!")
            return response.data[0]
        
        print("No cache hit.")
        return None
    
    except Exception as e:
        print("Error checking cache:", e)
        return None

def check_serp(gemini_response, user_location):
    """
    Checks the SERP for the user's location.
    """
    product_name = gemini_response.get("product_name", "").lower()
    gl_code, hl_code = get_location_codes(user_location)
    
    params = {
        "engine": "google_shopping",
        "q": product_name,
        "location": user_location,
        "hl": hl_code,
        "gl": gl_code,
        "api_key": SERP_KEY
    }
    
    search = GoogleSearch(params)
    results = search.get_dict()
    shopping_results = results["shopping_results"] if "shopping_results" in results else []

    return shopping_results

def check_numbeo(gemini_response, user_location):
    """
    Checks Numbeo for cost of living data based on the user's location.
    """
    product_category = gemini_response.get("category_numbeo_csv")
    city = user_location.split(",")[0].strip()

    if not product_category:
        print("No Numbeo category mapped. Skipping cost-of-living check.")
        return None
        
    if not city:
        print("Missing city for Numbeo check.")
        return None

    print(f"Fetching local cost for '{product_category}' in {city}...")

    try:
        response = supabase.table('numbeo_scrape') \
            .select(product_category) \
            .ilike('city', city) \
            .execute()
            
        if len(response.data) > 0:
            local_cost = response.data[0].get(product_category)
            print(f"Numbeo Baseline Cost: ${local_cost}")
            return local_cost
        else:
            print("No Numbeo data found for this city.")
            return None
            
    except Exception as e:
        print("Error fetching Numbeo data:", e)
        return None

def check_gemini(gemini_response, user_location):
    """
    Tier 3 Failover: Checks Gemini for a price estimate if SerpAPI fails.
    """
    product_name = gemini_response.get("product_name")
    brand = gemini_response.get("brand", "")
    
    if not product_name:
        print("Missing product name for Gemini failover.")
        return None
        
    print(f"Search Failed. Asking Gemini to estimate price for {brand} {product_name} in {user_location}...")
    
    prompt_path = os.path.join(os.path.dirname(__file__), 'failover_prompt.json')
    with open(prompt_path, 'r') as f:
        prompts = json.load(f)
        
    system_prompt = prompts["system_prompt"].format(
        brand=brand,
        product_name=product_name,
        user_location=user_location
    )
    
    expected_format = json.dumps(prompts["expected_format"], indent=2)
    failover_prompt = f"{system_prompt}\n\nReturn ONLY a valid JSON object with no markdown formatting:\n{expected_format}"
    
    try:
        
        response = gemini.models.generate_content(
            model=model,
            contents=failover_prompt,
            config=types.GenerateContentConfig(
                temperature=0.2,
                response_mime_type="application/json",
            )
        )
        
        estimated_data = json.loads(response.text)
        
        print(f"Gemini Estimate: {estimated_data.get('estimated_price')} {estimated_data.get('currency')} (Confidence: {estimated_data.get('confidence')})")
        return estimated_data
        
    except Exception as e:
        print("Error during Gemini failover:", e)
        return None
    
def add_to_cache(gemini_response, user_location, product_price, domestic_price=None, store_name=None, is_pink_tax=False):
    """
    Adds a new entry to the cache in Supabase based on the exact table schema.
    """
    location_parts = [part.strip() for part in user_location.split(",")]
    city = location_parts[0] if len(location_parts) > 0 else "Unknown"
    country = location_parts[-1] if len(location_parts) > 1 else "Unknown"
    
    volume = gemini_response.get("volume", "")
    category = gemini_response.get("category_serpapi", "")
    product_des = f"{volume} - {category}".strip(" -")
    
    payload = {
        "product_name": gemini_response.get("product_name", "Unknown"),
        "product_price": product_price,
        "product_des": product_des if product_des else None,
        "pink_tax": is_pink_tax,
        "store_name": store_name,
        "city": city,
        "country": country,
        "domestic_price": domestic_price,
        "brand": gemini_response.get("brand", "Unknown")
    }
    
    try:
        supabase.table('cached_products').insert(payload).execute()
        print("Successfully added entry to cached_products.")
    except Exception as e:
        print("Error adding to cache:", e)
        
def run_equispend_analysis(gemini_vision_json, user_location):
    """
    MASTER ORCHESTRATOR: Runs the Equispend Waterfall Logic Flow.
    """
    print(f"\n🚀 Starting Equispend Analysis for {user_location}...")
    
    product_price = gemini_vision_json.get("price_found")
    
    cached_data = check_cache(gemini_vision_json, user_location)
    if cached_data:
        return {
            "status": "success",
            "source": "supabase_cache",
            "data": cached_data
        }

    print("🌐 Moving to Live Web Search...")
    market_price = None
    store_name = None
    
    shopping_results = check_serp(gemini_vision_json, user_location)
    
    if shopping_results and len(shopping_results) > 0:
        market_price = shopping_results[0].get("extracted_price")
        store_name = shopping_results[0].get("source")
        print(f"✅ SerpAPI found market price: ${market_price} at {store_name}")

    if not market_price:
        gemini_estimate = check_gemini(gemini_vision_json, user_location)
        if gemini_estimate:
            market_price = gemini_estimate.get("estimated_price")
            store_name = "Gemini AI Estimate"

    local_cost = check_numbeo(gemini_vision_json, user_location)
    is_pink_tax = False
    
    if product_price and market_price:
        if float(product_price) > float(market_price):
            is_pink_tax = True
            
    if product_price:
        add_to_cache(
            gemini_response=gemini_vision_json,
            user_location=user_location,
            product_price=product_price,
            domestic_price=market_price,
            store_name=store_name,
            is_pink_tax=is_pink_tax
        )
    else:
        print("⚠️ No shelf price found in the image. Skipping Cache Insert.")

    return {
        "status": "success",
        "source": "live_pipeline",
        "data": {
            "scanned_price": product_price,
            "domestic_market_price": market_price,
            "numbeo_local_cost": local_cost,
            "is_pink_tax": is_pink_tax,
            "store_match": store_name
        }
    }