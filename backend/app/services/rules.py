from sqlalchemy.orm import Session
from app.models.rule import RuleVersion


def get_current_rule(db: Session) -> RuleVersion | None:
    return db.query(RuleVersion).order_by(RuleVersion.id.desc()).first()


def save_rule(db: Session, content: str, summary: str | None = None) -> RuleVersion:
    rv = RuleVersion(content=content, summary=summary)
    db.add(rv)
    db.commit()
    db.refresh(rv)
    return rv


def list_versions(db: Session) -> list[RuleVersion]:
    return db.query(RuleVersion).order_by(RuleVersion.id.desc()).all()


def restore_version(db: Session, version_id: int) -> RuleVersion:
    old = db.query(RuleVersion).filter(RuleVersion.id == version_id).first()
    if not old:
        raise ValueError(f"Version {version_id} not found")
    return save_rule(db, content=old.content, summary=f"还原自版本 {version_id}")
