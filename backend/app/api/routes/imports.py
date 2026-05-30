from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_account_id, get_session
from app.models.import_batch import ImportBatch, RawImportRow
from app.services.importer import import_file

router = APIRouter(tags=["imports"])


@router.post("/imports")
async def upload_import(
    file: UploadFile = File(...),
    db: Session = Depends(get_session),
    account_id: int = Depends(get_current_account_id),
):
    content = await file.read()
    try:
        result = import_file(db, file.filename or "unknown.xls", content, account_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {
        "batch_id": result.batch_id,
        "inserted": result.inserted,
        "skipped_dup": result.skipped_dup,
        "failed": result.failed,
    }


@router.get("/imports")
def list_imports(db: Session = Depends(get_session), account_id: int = Depends(get_current_account_id)):
    batches = db.query(ImportBatch).filter(
        ImportBatch.account_id == account_id
    ).order_by(ImportBatch.imported_at.desc()).all()
    return [
        {
            "id": b.id,
            "filename": b.filename,
            "period_start": b.period_start.isoformat() if b.period_start else None,
            "period_end": b.period_end.isoformat() if b.period_end else None,
            "row_count": b.row_count,
            "imported_at": b.imported_at.isoformat() if b.imported_at else None,
        }
        for b in batches
    ]


@router.get("/imports/{batch_id}/rows")
def get_import_rows(
    batch_id: int,
    db: Session = Depends(get_session),
    account_id: int = Depends(get_current_account_id),
):
    batch = db.query(ImportBatch).filter(
        ImportBatch.id == batch_id,
        ImportBatch.account_id == account_id,
    ).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    rows = db.query(RawImportRow).filter(RawImportRow.import_batch_id == batch_id).order_by(RawImportRow.row_no).all()
    return [
        {
            "id": r.id,
            "row_no": r.row_no,
            "raw_text": r.raw_text,
            "parsed": r.parsed,
            "error": r.error,
        }
        for r in rows
    ]
