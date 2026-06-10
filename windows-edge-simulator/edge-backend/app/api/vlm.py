from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.config import HISTORY_DIR
import base64
import os
import requests

router = APIRouter()

OLLAMA_URL = os.getenv("AOI_EDGE_OLLAMA_URL", "http://host.docker.internal:11434").rstrip("/")
OLLAMA_MODEL = os.getenv("AOI_EDGE_VLM_MODEL", "qwen3.5:9b")


class VlmAnalyzeRequest(BaseModel):
    image_url: str
    prompt: str | None = None


def _image_bytes_from_url(image_url: str) -> bytes:
    if image_url.startswith("/data/history/"):
        relative_path = image_url.removeprefix("/data/history/").replace("/", os.sep)
        image_path = os.path.abspath(os.path.join(str(HISTORY_DIR), relative_path))
        history_root = os.path.abspath(str(HISTORY_DIR))
        if not image_path.startswith(history_root + os.sep):
            raise HTTPException(status_code=400, detail="Invalid image path")
        if not os.path.exists(image_path):
            raise HTTPException(status_code=404, detail="Image not found")
        with open(image_path, "rb") as image_file:
            return image_file.read()

    if image_url.startswith("/sim-camera/"):
        frontend_base_url = os.getenv("AOI_EDGE_FRONTEND_BASE_URL", "http://edge-frontend").rstrip("/")
        response = requests.get(f"{frontend_base_url}{image_url}", timeout=10)
        response.raise_for_status()
        return response.content

    raise HTTPException(status_code=400, detail="Only /data/history or /sim-camera images are allowed")


@router.post("/analyze")
async def analyze_image(payload: VlmAnalyzeRequest):
    prompt = payload.prompt or (
        "你是 PCB AOI 視覺檢查助手，只針對 PCB 邊緣與金手指/導體邊緣檢查。"
        "請檢查圖片中是否存在「毛絲」或「殘肉」："
        "毛絲是邊緣伸出的細小絲狀、毛邊、銅絲或纖維狀異物；"
        "殘肉是邊緣多餘殘留的塊狀、片狀、凸出物或未清除材料。"
        "請不要把正常的金手指齒狀排列、正常銅箔紋理、反光、陰影、灰塵或影像模糊直接判定為缺陷。"
        "請用繁體中文依固定格式回答："
        "1. 判定：OK 或 NG；"
        "2. 是否疑似毛絲：是/否，信心 0-100；"
        "3. 是否疑似殘肉：是/否，信心 0-100；"
        "4. 可疑位置：用上/下/左/右/中央與接近第幾個金手指描述；"
        "5. 理由：簡短說明觀察依據；"
        "6. 不確定因素：若無請寫無。"
    )

    try:
        image_b64 = base64.b64encode(_image_bytes_from_url(payload.image_url)).decode("ascii")
        response = requests.post(
            f"{OLLAMA_URL}/api/generate",
            json={
                "model": OLLAMA_MODEL,
                "prompt": prompt,
                "images": [image_b64],
                "stream": False,
            },
            timeout=180,
        )
        response.raise_for_status()
        data = response.json()
        return {
            "model": data.get("model", OLLAMA_MODEL),
            "response": data.get("response", ""),
            "total_duration": data.get("total_duration"),
            "eval_count": data.get("eval_count"),
        }
    except HTTPException:
        raise
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail=f"Ollama request failed: {exc}") from exc
