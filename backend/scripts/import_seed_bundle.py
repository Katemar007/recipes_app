#!/usr/bin/env python3
"""
Import a portable seed bundle into the configured database (local or remote).

Set `DATABASE_URL` before running for Postgres, e.g.:

  export DATABASE_URL='postgresql+psycopg2://user:pass@host:5432/dbname'
  cd backend && python3 scripts/import_seed_bundle.py

Default bundle: `seed_data/demo_bundle.json`.

Options:
  --wipe-all   Clear shopping lists, recipes, categories, and section catalog first
               (same destructive wipe as reset_and_seed before re-import).
  --bundle PATH   Alternate JSON file.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_ROOT))

from sqlalchemy import func

from app import db_models  # noqa: F401
from app.config import settings
from app.database import Base, SessionLocal, engine
from app.db_models import RecipeRow
from app.recipe_db_service import (
    apply_seed_bundle,
    backfill_recipe_ingredients_json,
    sync_demo_recipe_images,
    wipe_all_application_data,
)
from app.seed_bundle import DEFAULT_SEED_BUNDLE_PATH, load_seed_bundle


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--bundle",
        type=Path,
        default=None,
        help=f"Seed JSON (default: {DEFAULT_SEED_BUNDLE_PATH})",
    )
    parser.add_argument(
        "--wipe-all",
        action="store_true",
        help="Delete existing app data before import (destructive).",
    )
    args = parser.parse_args()

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        existing = db.query(func.count(RecipeRow.id)).scalar() or 0
        if existing > 0 and not args.wipe_all:
            parser.error(
                "Database already contains recipes. Pass --wipe-all to replace everything, "
                "or use scripts/reset_and_seed.py for a full local reset."
            )
        if args.wipe_all:
            wipe_all_application_data(db)
            db.commit()
        bundle = load_seed_bundle(args.bundle)
        apply_seed_bundle(db, bundle)
        backfill_recipe_ingredients_json(db)
        sync_demo_recipe_images(db)
    finally:
        db.close()

    print("Import complete.")
    print(f"Database: {settings.database_url}")


if __name__ == "__main__":
    main()
