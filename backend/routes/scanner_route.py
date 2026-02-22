from fastapi import APIRouter, Form, UploadFile, File, HTTPException
from typing import Optional
import io
from PIL import Image
from utils.gemini import build_prompt, analyze_image

router = APIRouter()

def optimize_image(pil_image: Image.Image, max_size: int = 1024) -> Image.Image:
    """
    Resize image to reduce token consumption while maintaining aspect ratio.
    Gemini handles up to 3072x3072, but 1024x1024 is usually plenty for OCR/product recognition
    and saves significantly on tokens/bandwidth.
    """
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

@router.post("/scan")
async def scan_endpoint(
    image: UploadFile = File(...),
    mode: str = Form(...),
    location: Optional[str] = Form(None),
    currency: Optional[str] = Form(None)
):
    image_bytes = await image.read()
    
    pil_image = Image.open(io.BytesIO(image_bytes))
    
    original_size = pil_image.size
    optimized_image = optimize_image(pil_image)
    
    try:
        prompt = build_prompt()
        analysis_result = analyze_image(optimized_image, prompt)
        
        return {
            "status": "success",
            "data": analysis_result
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error analyzing image: {str(e)}")