from config.settings import gemini, model
from google.genai import types
from PIL import Image
import json
import os


def build_identify_prompt() -> str:
    """
    Builds the product-identification-only prompt from prompt.json.
    No mode-specific logic — just detect what the product is.
    """
    prompt_path = os.path.join(os.path.dirname(__file__), 'prompt.json')
    with open(prompt_path, 'r') as f:
        prompts = json.load(f)

    system_prompt = prompts["system_prompt"]
    expected_format = json.dumps(prompts["expected_format"], indent=2)

    return f"{system_prompt}\n\nExpected JSON Format:\n{expected_format}"


def analyze_image(image: Image.Image, prompt: str) -> dict:
    """
    Sends the image and prompt to Gemini for analysis and returns a parsed JSON dictionary.
    """
    try:
        response = gemini.models.generate_content(
            model=model,
            contents=[image, prompt],
            config=types.GenerateContentConfig(
                temperature=0.2,
                response_mime_type="application/json",
            )
        )

        return json.loads(response.text)

    except Exception as e:
        print(f"Error calling Gemini API: {e}")
        raise e


def build_comparison_query(product_data: dict, mode: str) -> dict:
    """
    Uses Gemini to generate a smart SERP search query for the comparison product.

    - Pink Tax mode   → find the SAME brand, type, size — opposite-gender version.
    - Tourist Tax mode → find the SAME exact product at standard US/home-market retailers.
    - General mode     → find the SAME exact product at any major online retailer.
    """
    brand = product_data.get("brand", "")
    product_name = product_data.get("product_name", "")
    category = product_data.get("category", "")
    volume = product_data.get("volume", "")
    gender = product_data.get("gender_marketing", "unisex")

    if mode == "girl":
        if gender == "women":
            target_gender = "men's"
            original_gender = "women's"
        elif gender == "men":
            target_gender = "women's"
            original_gender = "men's"
        else:
            target_gender = "unisex"
            original_gender = "unisex"

        prompt = (
            f"I'm detecting the Pink Tax. I have a {original_gender} product and "
            f"need to find its {target_gender} equivalent for price comparison.\n\n"
            f"Original product:\n"
            f"  Brand: {brand}\n"
            f"  Product: {product_name}\n"
            f"  Category: {category}\n"
            f"  Volume/Size: {volume}\n"
            f"  Gender Marketing: {gender}\n\n"
            f"RULES for generating the search query:\n"
            f"1. SAME brand ('{brand}') — always keep the brand.\n"
            f"2. SAME product type (e.g. razor→razor, shampoo→shampoo).\n"
            f"3. SAME or closest size/volume ('{volume}'). CRITICAL: Use 'count' or 'ct' instead of 'pack' (e.g., use '3 ct' instead of '3-pack') to avoid triggering bulk bundle listings.\n"
            f"4. DIFFERENT gender: find the {target_gender} version.\n"
            f"5. If the brand doesn't make a {target_gender} version, search for "
            f"the most popular {target_gender} {category} in the same size.\n"
            f"6. Do NOT add words like 'bundle', 'bulk', or 'packs of' to the query.\n\n"
            f"Example: 'Venus Women's Razor 4-pack' → search 'Gillette men razor 4 ct'\n"
            f"Example: 'Dove Men+Care Body Wash 18oz' → search 'Dove body wash women 18oz'\n\n"
            f"Return ONLY a JSON object with:\n"
            f"- 'search_query': the Google Shopping search string\n"
            f"- 'comparable_description': what you're searching for "
            f"(e.g., \"Men's Gillette razor, 4-pack\")\n"
            f"No markdown."
        )

    elif mode == "travel":
        prompt = (
            f"I'm detecting the Tourist Tax — a traveler bought a product at a "
            f"tourist-area shop and I need to find its STANDARD retail price at "
            f"major US retailers to see if they were overcharged.\n\n"
            f"Product:\n"
            f"  Brand: {brand}\n"
            f"  Product: {product_name}\n"
            f"  Category: {category}\n"
            f"  Volume/Size: {volume}\n\n"
            f"RULES:\n"
            f"1. Search for the EXACT same product (same brand, name, size).\n"
            f"2. Target standard retailers: Amazon, Walmart, Target, etc.\n"
            f"3. Do NOT add location-specific terms — I want the standard US price.\n"
            f"4. Include the brand, full product name, and volume in the query.\n\n"
            f"Return ONLY a JSON object with one key 'search_query' containing "
            f"the search string. No markdown."
        )

    else:
        prompt = (
            f"I'm checking for price gouging. A customer bought a product at a "
            f"local store and I need to find its fair online price to see if "
            f"they were overcharged.\n\n"
            f"Product:\n"
            f"  Brand: {brand}\n"
            f"  Product: {product_name}\n"
            f"  Category: {category}\n"
            f"  Volume/Size: {volume}\n\n"
            f"RULES:\n"
            f"1. Search for the EXACT same product (same brand, name, size).\n"
            f"2. Include brand, full product name, and volume in the query.\n"
            f"3. Aim for the standard online retail price.\n\n"
            f"Return ONLY a JSON object with one key 'search_query' containing "
            f"the search string. No markdown."
        )

    try:
        response = gemini.models.generate_content(
            model=model,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.3,
                response_mime_type="application/json",
            )
        )

        result = json.loads(response.text)
        print(f"🔎 Gemini comparison query ({mode}): {result}")
        return result

    except Exception as e:
        print(f"Error generating comparison query: {e}")
        if mode == "girl":
            target = "men" if gender == "women" else "women"
            return {
                "search_query": f"{brand} {target} {category} {volume}",
                "comparable_description": f"{target.title()}'s {brand} {category}",
            }
        else:
            return {"search_query": f"{brand} {product_name} {volume}"}