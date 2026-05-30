from datetime import date, datetime
from typing import Optional
from sqlalchemy import String, Integer, Date, DateTime, ForeignKey, Boolean, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class ImportBatch(Base):
    __tablename__ = "import_batches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    period_start: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    period_end: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    row_count: Mapped[int] = mapped_column(Integer, default=0)
    imported_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    raw_rows: Mapped[list["RawImportRow"]] = relationship(
        "RawImportRow", back_populates="batch", cascade="all, delete-orphan"
    )


class RawImportRow(Base):
    __tablename__ = "raw_import_rows"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    import_batch_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("import_batches.id", ondelete="CASCADE"), nullable=False
    )
    row_no: Mapped[int] = mapped_column(Integer, nullable=False)
    raw_text: Mapped[str] = mapped_column(String, nullable=False)
    parsed: Mapped[bool] = mapped_column(Boolean, default=False)
    error: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    batch: Mapped["ImportBatch"] = relationship("ImportBatch", back_populates="raw_rows")
