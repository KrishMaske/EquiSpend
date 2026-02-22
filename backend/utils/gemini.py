from config.settings import gemini, model
from google.genai import types
from PIL import Image
import json
import os

def build_prompt(mode: str = "girl") -> str:
    """
    Builds the prompt for Gemini using prompt.json.
    Appends mode-specific instructions for pink-tax vs tourist-tax detection.
    """
    prompt_path = os.path.join(os.path.dirname(__file__), 'prompt.json')
    with open(prompt_path, 'r') as f:
        prompts = json.load(f)
        
    system_prompt = prompts["system_prompt"]
    expected_format = json.dumps(prompts["expected_format"], indent=2)

    if mode == "travel":
        mode_instruction = (
            "\n\n### MODE: TOURIST TAX DETECTION\n"
            "Focus on identifying whether this product is priced higher than its "
            "standard retail price for the local market. "
            "For 'search_query', generate a search to find the standard domestic "
            "retail price of this exact product (same brand, same size). "
            "Do NOT search for gendered equivalents."
        )
    else:
        mode_instruction = (
            "\n\n### MODE: PINK TAX DETECTION\n"
            "Focus on identifying gender-based pricing disparities. "
            "For 'search_query', generate an optimized search string for Google "
            "Shopping to find the 'male' or 'neutral' equivalent of this product."
        )

    return f"{system_prompt}{mode_instruction}\n\nExpected JSON Format:\n{expected_format}"

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