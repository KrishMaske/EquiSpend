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


def build_comparison_query(product_data: dict, mode: str) -> str:
    """
    Uses Gemini to generate a smart SERP search query for the comparison product.

    - Pink Tax mode  → find the opposite-gender/neutral equivalent product.
    - Tourist Tax mode → find the same product's standard domestic retail price.
    """
    brand = product_data.get("brand", "")
    product_name = product_data.get("product_name", "")
    category = product_data.get("category", "")
    volume = product_data.get("volume", "")
    gender = product_data.get("gender_marketing", "unisex")

    if mode == "travel":
        # For tourist tax, search for the exact same product
        prompt = (
            f"Generate a concise Google Shopping search query to find the standard "
            f"retail price of this exact product:\n"
            f"Brand: {brand}\nProduct: {product_name}\nCategory: {category}\n"
            f"Volume: {volume}\n\n"
            f"Return ONLY a JSON object with one key 'search_query' containing "
            f"the search string. No markdown."
        )
    elif mode == "general":
        # For general price gouging, search for the exact same product online
        prompt = (
            f"Generate a concise Google Shopping search query to find the fair "
            f"online retail price of this exact product to detect price gouging:\n"
            f"Brand: {brand}\nProduct: {product_name}\nCategory: {category}\n"
            f"Volume: {volume}\n\n"
            f"Return ONLY a JSON object with one key 'search_query' containing "
            f"the search string. No markdown."
        )
    else:
        # For pink tax, search for comparable opposite-gender product
        if gender == "women":
            target_gender = "men's"
        elif gender == "men":
            target_gender = "women's"
        else:
            target_gender = "unisex"

        prompt = (
            f"I need to find a COMPARABLE product for price comparison.\n\n"
            f"Original product:\n"
            f"Brand: {brand}\nProduct: {product_name}\nCategory: {category}\n"
            f"Volume: {volume}\nGender Marketing: {gender}\n\n"
            f"Generate a Google Shopping search query to find a {target_gender} "
            f"equivalent of this product. It should be the SAME type of product "
            f"(same category, similar volume/size) but marketed to {target_gender}. "
            f"For example, if the original is 'Venus Women's Razor 4-pack', "
            f"search for 'men razor 4 pack'.\n\n"
            f"Return ONLY a JSON object with two keys:\n"
            f"- 'search_query': the Google Shopping search string\n"
            f"- 'comparable_description': a short description of what you're "
            f"searching for (e.g., 'Men\\'s equivalent razor, 4-pack')\n"
            f"No markdown."
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
        print(f"🔎 Gemini comparison query: {result}")
        return result

    except Exception as e:
        print(f"Error generating comparison query: {e}")
        # Fallback: build a simple query
        if mode == "travel" or mode == "general":
            return {"search_query": f"{brand} {product_name} {volume}"}
        else:
            target = "men" if gender == "women" else "women"
            return {"search_query": f"{target} {category} {volume}"}