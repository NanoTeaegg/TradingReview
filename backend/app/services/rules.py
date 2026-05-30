from sqlalchemy.orm import Session
from app.models.rule import RuleVersion


def get_current_rule(db: Session, account_id: int | None = None) -> RuleVersion | None:
    q = db.query(RuleVersion)
    if account_id is not None:
        q = q.filter(RuleVersion.account_id == account_id)
    return q.order_by(RuleVersion.id.desc()).first()


def save_rule(db: Session, content: str, summary: str | None = None, account_id: int | None = None) -> RuleVersion:
    if account_id is None:
        from app.api.deps import ensure_default_account
        account_id = ensure_default_account(db).id
    rv = RuleVersion(account_id=account_id, content=content, summary=summary)
    db.add(rv)
    db.commit()
    db.refresh(rv)
    return rv


def list_versions(db: Session, account_id: int | None = None) -> list[RuleVersion]:
    q = db.query(RuleVersion)
    if account_id is not None:
        q = q.filter(RuleVersion.account_id == account_id)
    return q.order_by(RuleVersion.id.desc()).all()


def restore_version(db: Session, version_id: int, account_id: int | None = None) -> RuleVersion:
    q = db.query(RuleVersion).filter(RuleVersion.id == version_id)
    if account_id is not None:
        q = q.filter(RuleVersion.account_id == account_id)
    old = q.first()
    if not old:
        raise ValueError(f"Version {version_id} not found")
    return save_rule(db, content=old.content, summary=f"还原自版本 {version_id}", account_id=old.account_id)
