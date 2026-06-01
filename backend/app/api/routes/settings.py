from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_account_id, get_session
from app.services.fee import (
    FeeConfig,
    get_fee_config,
    normalize_commission_rate,
    recalculate_trade_fees,
    save_fee_config,
)
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


class FeeSettings(BaseModel):
    commission_rate: Decimal
    commission_min_fee_exempt: bool = False


def _serialize_llm(config: LLMConfig) -> dict:
    return {
        "provider": config.provider,
        "base_url": config.base_url,
        "model": config.model,
        "api_key_masked": mask_api_key(config.api_key),
        "has_api_key": bool(config.api_key),
    }


def _serialize_fee(config: FeeConfig, recalculated_count: int | None = None) -> dict:
    payload = {
        "commission_rate": str(config.commission_rate),
        "commission_min_fee_exempt": config.commission_min_fee_exempt,
        "regulatory_fee_rate": str(config.regulatory_fee_rate),
        "exchange_handling_fee_rate": str(config.exchange_handling_fee_rate),
        "transfer_fee_rate": str(config.transfer_fee_rate),
        "stamp_tax_rate": str(config.stamp_tax_rate),
    }
    if recalculated_count is not None:
        payload["recalculated_count"] = recalculated_count
    return payload


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


@router.get("/settings/fee")
def get_fee_settings(
    db: Session = Depends(get_session),
    account_id: int = Depends(get_current_account_id),
):
    try:
        return _serialize_fee(get_fee_config(db, account_id))
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.put("/settings/fee")
def update_fee_settings(
    body: FeeSettings,
    db: Session = Depends(get_session),
    account_id: int = Depends(get_current_account_id),
):
    try:
        commission_rate = normalize_commission_rate(body.commission_rate)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    try:
        config = save_fee_config(
            db,
            account_id,
            commission_rate,
            body.commission_min_fee_exempt,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    recalculated_count = recalculate_trade_fees(db, account_id, config)
    return _serialize_fee(config, recalculated_count=recalculated_count)


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
