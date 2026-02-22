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
    Checks if the Gemini response contains a cache hit for the user's location.
    """
    # Example: Check for a 'cache_hit' field in the response
    product_name = gemini_response.get("product_name", "").lower()
    brand = gemini_response.get("brand", "").lower()
    
    print(f"Checking cache for: {brand} {product_name} in {user_location}...")
    
    try:
        response = supabase.table('cached_products') \
            .select('*') \
            .eq('location', user_location) \
            .eq('brand', brand) \
            .eq('product_name', product_name) \
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