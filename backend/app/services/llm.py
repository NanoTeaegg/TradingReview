from dataclasses import dataclass
from typing import Optional

import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.setting import AppSetting

LLM_PROVIDER_KEY = "llm_provider"
LLM_BASE_URL_KEY = "llm_base_url"
LLM_MODEL_KEY = "llm_model"
LLM_API_KEY_KEY = "llm_api_key"
OLLAMA_BASE_URL_KEY = "ollama_base_url"
OLLAMA_MODEL_KEY = "ollama_model"


@dataclass
class LLMConfig:
    provider: str
    base_url: str
    model: str
    api_key: str = ""


def get_setting(db: Session, key: str, default: str = "") -> str:
    row = db.query(AppSetting).filter(AppSetting.key == key).first()
    return row.value if row else default


def set_setting(db: Session, key: str, value: str) -> None:
    row = db.query(AppSetting).filter(AppSetting.key == key).first()
    if row:
        row.value = value
    else:
        db.add(AppSetting(key=key, value=value))


def mask_api_key(api_key: str) -> Optional[str]:
    if not api_key:
        return None
    if len(api_key) <= 8:
        return "****"
    return f"{api_key[:3]}****{api_key[-4:]}"


def get_llm_config(db: Session) -> LLMConfig:
    old_base = get_setting(db, OLLAMA_BASE_URL_KEY, settings.OLLAMA_BASE_URL)
    old_model = get_setting(db, OLLAMA_MODEL_KEY, settings.OLLAMA_MODEL)
    return LLMConfig(
        provider=get_setting(db, LLM_PROVIDER_KEY, "ollama"),
        base_url=get_setting(db, LLM_BASE_URL_KEY, old_base),
        model=get_setting(db, LLM_MODEL_KEY, old_model),
        api_key=get_setting(db, LLM_API_KEY_KEY, ""),
    )


def save_llm_config(db: Session, config: LLMConfig) -> None:
    set_setting(db, LLM_PROVIDER_KEY, config.provider)
    set_setting(db, LLM_BASE_URL_KEY, config.base_url.rstrip("/"))
    set_setting(db, LLM_MODEL_KEY, config.model)
    if config.api_key:
        set_setting(db, LLM_API_KEY_KEY, config.api_key)
    db.commit()


async def ping_llm(db: Session) -> dict:
    config = get_llm_config(db)
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            if config.provider == "ollama":
                resp = await client.get(f"{config.base_url.rstrip('/')}/api/tags")
                resp.raise_for_status()
                data = resp.json()
                models = [m.get("name") for m in data.get("models", [])]
                return {"ok": True, "provider": config.provider, "models": models, "base_url": config.base_url}

            headers = {"Authorization": f"Bearer {config.api_key}"} if config.api_key else {}
            resp = await client.get(f"{config.base_url.rstrip('/')}/models", headers=headers)
            resp.raise_for_status()
            data = resp.json()
            models = [m.get("id") for m in data.get("data", []) if isinstance(m, dict)]
            return {"ok": True, "provider": config.provider, "models": models, "base_url": config.base_url}
    except Exception as e:
        return {"ok": False, "provider": config.provider, "error": str(e), "base_url": config.base_url}
