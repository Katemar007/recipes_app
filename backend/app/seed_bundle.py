"""Load and validate portable JSON seed bundles (`seed_data/*.json`)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

BACKEND_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SEED_BUNDLE_PATH = BACKEND_ROOT / "seed_data" / "demo_bundle.json"


def load_seed_bundle(path: Path | None = None) -> dict[str, Any]:
    """Read a seed bundle JSON (default: `seed_data/demo_bundle.json`)."""
    p = path or DEFAULT_SEED_BUNDLE_PATH
    if not p.is_file():
        raise FileNotFoundError(f"Seed bundle not found: {p}")
    data = json.loads(p.read_text(encoding="utf-8"))
    validate_seed_bundle(data)
    return data


def validate_seed_bundle(bundle: dict[str, Any]) -> None:
    if int(bundle.get("version", 0)) != 1:
        raise ValueError('Seed bundle "version" must be 1')
    sections = bundle.get("ingredient_sections")
    if not isinstance(sections, list) or not sections:
        raise ValueError("bundle.ingredient_sections must be a non-empty list")
    catalog_ids: set[int] = set()
    for s in sections:
        if not isinstance(s, dict):
            raise ValueError("Each ingredient_sections row must be an object")
        sid = int(s["id"])
        if sid in catalog_ids:
            raise ValueError(f"Duplicate ingredient_sections id: {sid}")
        catalog_ids.add(sid)
        t = str(s.get("title", "")).strip()
        if sid == 0:
            if t and t.casefold() != "ingredients":
                raise ValueError(
                    f'ingredient_sections id 0 must use an empty title or legacy "Ingredients" (got {t!r})'
                )
        elif not t:
            raise ValueError(f"ingredient_sections id {sid} needs a non-empty title")
    if 0 not in catalog_ids:
        raise ValueError(
            "ingredient_sections must include id 0 (default unnamed section)"
        )

    recipes = bundle.get("recipes")
    if not isinstance(recipes, list) or not recipes:
        raise ValueError("bundle.recipes must be a non-empty list")

    for r in recipes:
        if not isinstance(r, dict):
            raise ValueError("Each recipe must be an object")
        if not str(r.get("title", "")).strip():
            raise ValueError("Each recipe needs a non-empty title")
        secs = r.get("sections")
        ings = r.get("ingredients")
        if not isinstance(secs, list) or not secs:
            raise ValueError(f'Recipe {r["title"]!r} needs a non-empty "sections" list')
        if not isinstance(ings, list) or not ings:
            raise ValueError(f'Recipe {r["title"]!r} needs a non-empty "ingredients" list')
        key_to_sid: dict[str, int] = {}
        for s in secs:
            if not isinstance(s, dict):
                raise ValueError("Each section entry must be an object")
            key = str(s.get("key", "")).strip()
            if not key:
                raise ValueError("Section entry needs a non-empty key")
            sid = int(s["catalog_section_id"])
            if sid not in catalog_ids:
                raise ValueError(
                    f'Recipe {r["title"]!r}: unknown catalog_section_id {sid} for key {key!r}'
                )
            key_to_sid[key] = sid
        for ing in ings:
            if not isinstance(ing, dict):
                raise ValueError("Each ingredient must be an object")
            sk = str(ing.get("section_key", "")).strip()
            if sk not in key_to_sid:
                raise ValueError(
                    f'Recipe {r["title"]!r}: unknown section_key {sk!r} in ingredients'
                )
            if not str(ing.get("line", "")).strip():
                raise ValueError(
                    f'Recipe {r["title"]!r}: empty ingredient line for section {sk!r}'
                )
