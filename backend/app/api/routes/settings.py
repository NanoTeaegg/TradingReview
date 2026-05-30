from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_session
from app.services.llm import (
    LLMConfig,
    get_llm_config,
    mask_api_key,
    ping_llm,
    save_llm_config,
    set_setting,
    OLLAMA_BASE_URL_KEY,
    OLLAMA_MODEL_KEY,
)

router = APIRouter(tags=["settings"])


class OllamaSettings(BaseModel):
    base_url: str
    model: str


class LLMSettings(BaseModel):
    provider: str
    base_url: str
    model: str
    api_key: str | None = None


def _serialize_llm(config: LLMConfig) -> dict:
    return {
        "provider": config.provider,
        "base_url": config.base_url,
        "model": config.model,
        "api_key_masked": mask_api_key(config.api_key),
        "has_api_key": bool(config.api_key),
    }


@router.get("/settings/llm")
def get_llm_settings(db: Session = Depends(get_session)):
    return _serialize_llm(get_llm_config(db))


@router.put("/settings/llm")
def update_llm_settings(body: LLMSettings, db: Session = Depends(get_session)):
    if body.provider not in {"ollama", "openai_compatible"}:
        raise HTTPException(status_code=400, detail="provider must be ollama or openai_compatible")
    if not body.base_url.strip():
        raise HTTPException(status_code=400, detail="base_url is required")
    if not body.model.strip():
        raise HTTPException(status_code=400, detail="model is required")

    old = get_llm_config(db)
    config = LLMConfig(
        provider=body.provider,
        base_url=body.base_url.strip(),
        model=body.model.strip(),
        api_key=body.api_key if body.api_key is not None else old.api_key,
    )
    save_llm_config(db, config)
    return _serialize_llm(get_llm_config(db))


@router.post("/settings/llm/ping")
async def ping_llm_settings(db: Session = Depends(get_session)):
    return await ping_llm(db)


@router.get("/settings/ollama")
def get_ollama_settings(db: Session = Depends(get_session)):
    config = get_llm_config(db)
    return {
        "base_url": config.base_url,
        "model": config.model,
    }


@router.put("/settings/ollama")
def update_ollama_settings(body: OllamaSettings, db: Session = Depends(get_session)):
    set_setting(db, OLLAMA_BASE_URL_KEY, body.base_url)
    set_setting(db, OLLAMA_MODEL_KEY, body.model)
    save_llm_config(db, LLMConfig(provider="ollama", base_url=body.base_url, model=body.model))
    return {"base_url": body.base_url, "model": body.model}


@router.post("/settings/ollama/ping")
async def ping_ollama(db: Session = Depends(get_session)):
    return await ping_llm(db)
