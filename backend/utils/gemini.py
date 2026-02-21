from config.settings import gemini, model
from google.genai import types
from PIL import Image
import json
import os

def build_prompt() -> str:
    """
    Builds the prompt for Gemini using prompt.json.
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