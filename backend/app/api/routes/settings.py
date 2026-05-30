from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_session
from app.models.setting import AppSetting

router = APIRouter(tags=["settings"])

OLLAMA_BASE_URL_KEY = "ollama_base_url"
OLLAMA_MODEL_KEY = "ollama_model"


def _get_setting(db: Session, key: str, default: str = "") -> str:
    row = db.query(AppSetting).filter(AppSetting.key == key).first()
    return row.value if row else default


def _set_setting(db: Session, key: str, value: str) -> None:
    row = db.query(AppSetting).filter(AppSetting.key == key).first()
    if row:
        row.value = value
    else:
        db.add(AppSetting(key=key, value=value))
    db.commit()


class OllamaSettings(BaseModel):
    base_url: str
    model: str


@router.get("/settings/ollama")
def get_ollama_settings(db: Session = Depends(get_session)):
    from app.core.config import settings as app_settings
    return {
        "base_url": _get_setting(db, OLLAMA_BASE_URL_KEY, app_settings.OLLAMA_BASE_URL),
        "model": _get_setting(db, OLLAMA_MODEL_KEY, app_settings.OLLAMA_MODEL),
    }


@router.put("/settings/ollama")
def update_ollama_settings(body: OllamaSettings, db: Session = Depends(get_session)):
    _set_setting(db, OLLAMA_BASE_URL_KEY, body.base_url)
    _set_setting(db, OLLAMA_MODEL_KEY, body.model)
    return {"base_url": body.base_url, "model": body.model}


@router.post("/settings/ollama/ping")
async def ping_ollama(db: Session = Depends(get_session)):
    from app.core.config import settings as app_settings
    base_url = _get_setting(db, OLLAMA_BASE_URL_KEY, app_settings.OLLAMA_BASE_URL)
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{base_url}/api/tags")
            resp.raise_for_status()
            data = resp.json()
            models = [m.get("name") for m in data.get("models", [])]
            return {"ok": True, "models": models, "base_url": base_url}
    except Exception as e:
        return {"ok": False, "error": str(e), "base_url": base_url}
