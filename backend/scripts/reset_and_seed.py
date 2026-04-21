#!/usr/bin/env python3
"""
Wipe application tables and re-import `seed_data/demo_bundle.json`.

Uses `DATABASE_URL` / `.env` like the API (`app.config.settings`). Safe order:
create_all (current models only) → wipe → seed bundle → `ingredients_json` backfill → demo images.

Run from repo root or backend:

  cd backend && python3 scripts/reset_and_seed.py

Optional:

  python3 scripts/reset_and_seed.py --bundle path/to/custom_bundle.json
  python3 scripts/reset_and_seed.py --remove-sqlite-file
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_ROOT))

from app import db_models  # noqa: F401 — register models
from app.config import settings
from app.database import Base, SessionLocal, engine
from app.recipe_db_service import (
    apply_seed_bundle,
    backfill_recipe_ingredients_json,
    sync_demo_recipe_images,
    wipe_all_application_data,
)
from app.seed_bundle import DEFAULT_SEED_BUNDLE_PATH, load_seed_bundle


def _maybe_remove_sqlite_file() -> None:
    url = settings.database_url
    if not url.startswith("sqlite:///"):
        return
    path = Path(url.replace("sqlite:///", "", 1))
    if path.name == ":memory:" or not path.is_file():
        return
    path.unlink()
    print(f"Removed SQLite file: {path}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--bundle",
        type=Path,
        default=None,
        help=f"Seed JSON (default: {DEFAULT_SEED_BUNDLE_PATH})",
    )
    parser.add_argument(
        "--remove-sqlite-file",
        action="store_true",
        help="Delete the SQLite database file before create_all (sqlite URLs only).",
    )
    args = parser.parse_args()

    if args.remove_sqlite_file:
        _maybe_remove_sqlite_file()

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        wipe_all_application_data(db)
        db.commit()
        bundle = load_seed_bundle(args.bundle)
        apply_seed_bundle(db, bundle)
        backfill_recipe_ingredients_json(db)
        sync_demo_recipe_images(db)
    finally:
        db.close()

    print("Reset and seed complete.")
    print(f"Database: {settings.database_url}")
    print(f"Bundle: {args.bundle or DEFAULT_SEED_BUNDLE_PATH}")


if __name__ == "__main__":
    main()
