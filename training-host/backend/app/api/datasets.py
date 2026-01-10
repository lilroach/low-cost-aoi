from fastapi import APIRouter, UploadFile, File, HTTPException
import shutil
import os
from pathlib import Path
from typing import List

router = APIRouter(prefix="/datasets", tags=["datasets"])

DATA_DIR = Path("/app/data")
RAW_DIR = DATA_DIR / "raw"

# Ensure directories exist
RAW_DIR.mkdir(parents=True, exist_ok=True)

@router.post("/upload")
async def upload_images(files: List[UploadFile] = File(...)):
    """
    Upload PCB images to the raw dataset folder.
    """
    uploaded_files = []
    
    for file in files:
        if not file.filename.lower().endswith(('.png', '.jpg', '.jpeg', '.bmp')):
            continue
            
        file_path = RAW_DIR / file.filename
        
        # Save file
        try:
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            uploaded_files.append(file.filename)
        except Exception as e:
            print(f"Error saving {file.filename}: {e}")
            
    return {"uploaded": uploaded_files, "failed": []}

@router.delete("/{filename}")
async def delete_image(filename: str):
    file_path = RAW_DIR / filename
    if file_path.exists():
        os.remove(file_path)
        return {"message": f"Deleted {filename}"}
    raise HTTPException(status_code=404, detail="File not found")

@router.get("/")
async def list_images():
    """
    List all uploaded images.
    """
    if not RAW_DIR.exists():
        return []
        
    images = [f.name for f in RAW_DIR.iterdir() if f.is_file()]
    return {"count": len(images), "images": images}
