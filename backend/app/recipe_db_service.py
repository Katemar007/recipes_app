from __future__ import annotations

import base64
import json
import re
import shutil
import uuid
from pathlib import Path
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import delete, func, text
from sqlalchemy.orm import Session, selectinload

from .config import settings
from .db_models import (
    CategoryRow,
    IngredientSectionRow,
    RecipeCategoryLinkRow,
    RecipeIngredientRow,
    RecipeRow,
    ShoppingListItemRow,
    ShoppingListRow,
)
from .schemas import RecipeIngredientLineCreate

DEMO_USER = "demo-user"

DEFAULT_INGREDIENT_SECTION_ID = 0
DEFAULT_INGREDIENT_SECTION_TITLE = ""


def _norm_section_title_key(title: str) -> str:
    return (title or "").strip().casefold()


def ensure_default_ingredient_section(db: Session) -> None:
    """Reserved catalog id 0 = unnamed default section (shared across recipes)."""
    row = db.get(IngredientSectionRow, DEFAULT_INGREDIENT_SECTION_ID)
    if row is None:
        db.add(
            IngredientSectionRow(
                id=DEFAULT_INGREDIENT_SECTION_ID,
                title=DEFAULT_INGREDIENT_SECTION_TITLE,
                position=0,
            )
        )
        db.flush()
    elif _norm_section_title_key(row.title) != "":
        row.title = DEFAULT_INGREDIENT_SECTION_TITLE
        db.flush()


def get_or_create_ingredient_section_catalog_id(db: Session, title: str) -> int:
    """
    Return a catalog `ingredient_sections.id` for this title.

    Empty title and legacy ``Ingredients`` (any casing) map to id 0. Other titles
    reuse an existing row with the same case-insensitive title or allocate a new id.
    """
    ensure_default_ingredient_section(db)
    t = (title or "").strip()
    if _norm_section_title_key(t) in ("", "ingredients"):
        return DEFAULT_INGREDIENT_SECTION_ID
    existing = (
        db.query(IngredientSectionRow)
        .filter(func.lower(IngredientSectionRow.title) == t.casefold())
        .first()
    )
    if existing:
        return int(existing.id)
    nid = _max_int_pk(db, IngredientSectionRow) + 1
    if nid <= DEFAULT_INGREDIENT_SECTION_ID:
        nid = DEFAULT_INGREDIENT_SECTION_ID + 1
    sec = IngredientSectionRow(id=nid, title=t, position=0)
    db.add(sec)
    db.flush()
    return nid


def _max_int_pk(db: Session, model: type[Any]) -> int:
    """Largest existing integer-like primary key for a model (digits or ``r1``/``s2``-style ids)."""
    best = 0
    for (pk,) in db.query(model.id).all():
        if pk is None:
            continue
        if isinstance(pk, int):
            best = max(best, pk)
            continue
        s = str(pk).strip()
        if s.isdigit():
            best = max(best, int(s))
            continue
        m = re.match(r"^([rsi])(\d+)$", s, re.IGNORECASE)
        if m:
            best = max(best, int(m.group(2)))
    return best


def _max_category_numeric_id(db: Session) -> int:
    """Categories may use UUID strings; only consider integer-like ids when allocating."""
    best = 0
    for (pk,) in db.query(CategoryRow.id).all():
        if pk is None:
            continue
        if isinstance(pk, int):
            best = max(best, pk)
            continue
        s = str(pk).strip()
        if s.isdigit():
            best = max(best, int(s))
    return best


# Demo images keyed by recipe title (stable across integer PKs).
DEMO_RECIPE_IMAGE_BY_TITLE: dict[str, str] = {
    "Weekend Pancakes": "recipe-seed/weekend-pancakes.jpg",
    "Lentil Soup": "recipe-seed/Greek_lentil_soup_04.jpg",
    "Herb-Roasted Chicken Thighs": "recipe-seed/baked-chicken-thighs.jpg",
    "Citrus Salmon with Greens": "recipe-seed/citrus-grilled-salmon.jpg",
}


def find_category_by_exact_name(db: Session, name: str) -> CategoryRow | None:
    """Return a category row only when `name` matches the stored title exactly (after strip)."""
    t = name.strip()
    if not t:
        return None
    return db.query(CategoryRow).filter(CategoryRow.name == t).first()


def get_or_create_category(db: Session, name: str) -> CategoryRow:
    t = name.strip()
    if not t:
        raise ValueError("Category name cannot be empty")
    existing = find_category_by_exact_name(db, t)
    if existing:
        return existing
    cid = _max_category_numeric_id(db) + 1
    row = CategoryRow(id=cid, name=t)
    db.add(row)
    db.flush()
    return row


def apply_recipe_category_links(
    db: Session,
    recipe: RecipeRow,
    *,
    category_ids: list[int],
    names: list[str],
) -> list[CategoryRow]:
    """
    Set `recipe_categories` via existing category ids and/or names.

    Does not change `recipes.category` (set once in `create_recipe` from the first link).

    - `category_ids`: link rows by primary key (must exist in `categories`).
    - `names`: for each non-empty stripped string, `get_or_create_category` (exact name match
      reuses the same row; otherwise a new category is created).

    Order is preserved: all ids in given order first, then names in given order.
    De-duplication is by category id only (exact string duplicates in `names` collapse
    to one row; same id listed twice is kept once).

    Returns linked categories in that order (first = creation-time primary).
    """
    cats: list[CategoryRow] = []
    seen_id: set[int] = set()

    for cid in category_ids:
        row = db.get(CategoryRow, cid)
        if row is None:
            raise ValueError(f"Unknown category id: {cid}")
        if cid not in seen_id:
            seen_id.add(cid)
            cats.append(row)

    for raw in names:
        n = raw.strip()
        if not n:
            continue
        row = get_or_create_category(db, n)
        if row.id not in seen_id:
            seen_id.add(row.id)
            cats.append(row)

    recipe.category_links.clear()
    db.flush()
    for cat in cats:
        recipe.category_links.append(RecipeCategoryLinkRow(category_id=cat.id))
    db.flush()
    return cats


def set_recipe_categories_from_names(
    db: Session, recipe: RecipeRow, names: list[str]
) -> None:
    """Link categories by name only (exact match reuses table rows)."""
    apply_recipe_category_links(db, recipe, category_ids=[], names=names)


def sync_recipe_denormalized_category_from_links(db: Session) -> None:
    """
    Clear `recipes.category` when a recipe has no category links (e.g. CASCADE delete).

    Does not rewrite `recipes.category` when links exist — that string is the name
    chosen at recipe creation (first category_id, else first name in payload order).
    """
    rows = (
        db.query(RecipeRow)
        .options(selectinload(RecipeRow.category_links))
        .all()
    )
    changed = False
    for r in rows:
        if r.category_links:
            continue
        if (r.category or "").strip():
            r.category = ""
            changed = True
    if changed:
        db.commit()


def ensure_recipe_category_non_null(db: Session) -> None:
    db.execute(text("UPDATE recipes SET category = '' WHERE category IS NULL"))
    db.commit()


def list_categories(db: Session) -> list[dict[str, Any]]:
    rows = db.query(CategoryRow).order_by(CategoryRow.name.asc()).all()
    return [{"id": r.id, "name": r.name} for r in rows]


def flatten_ingredient_section_tuples(
    sections: list[tuple[str, str]],
) -> list[str]:
    """Importer helper: (section_title, newline_body) -> flat trimmed lines."""
    lines: list[str] = []
    for _title, body in sections:
        for raw in (body or "").splitlines():
            s = raw.strip()
            if s:
                lines.append(s)
    return lines


def _ingredient_lines_fallback_from_orm(r: RecipeRow) -> list[str]:
    def _sec_pos(ing: RecipeIngredientRow) -> int:
        return int(ing.section_position or 0)

    def _ing_pos(ing: RecipeIngredientRow) -> int:
        return int(ing.position or 0)

    ings = sorted(r.ingredients, key=lambda i: (_sec_pos(i), _ing_pos(i)))
    out: list[str] = []
    for ing in ings:
        ln = (getattr(ing, "line", None) or "").strip()
        if ln:
            out.append(ln)
    return out


def decode_recipe_ingredients_list(r: RecipeRow) -> list[str]:
    """
    Ingredient lines for API `ingredients[]` from `recipe_ingredients.line` only.

    `ingredients_json` is a denormalized mirror updated on write and via
    `backfill_recipe_ingredients_json`.
    """
    return _ingredient_lines_fallback_from_orm(r)


def _write_ingredients_json_mirror(recipe: RecipeRow, lines: list[str]) -> None:
    """Keep `recipes.ingredients_json` aligned with the relational graph (export only)."""
    cleaned = [ln.strip() for ln in lines if ln.strip()]
    recipe.ingredients_json = json.dumps(cleaned)


def backfill_recipe_ingredients_json(db: Session) -> None:
    """Rewrite `ingredients_json` from the relational graph only (denormalized mirror)."""
    rows = (
        db.query(RecipeRow)
        .options(
            selectinload(RecipeRow.ingredients).selectinload(
                RecipeIngredientRow.section
            ),
        )
        .all()
    )
    changed = False
    for r in rows:
        lines = _ingredient_lines_fallback_from_orm(r)
        dumped = json.dumps(lines)
        if getattr(r, "ingredients_json", None) != dumped:
            r.ingredients_json = dumped
            changed = True
    if changed:
        db.commit()


def _ensure_section_catalog_row_for_write(
    db: Session, section_id: int, section_title: str | None
) -> None:
    row = db.get(IngredientSectionRow, section_id)
    if row is not None:
        st = (section_title or "").strip()
        if st:
            if _norm_section_title_key(row.title) != _norm_section_title_key(st):
                raise ValueError(
                    f"section_id {section_id} exists with title {row.title!r}, "
                    f"not {st!r}."
                )
        return
    if int(section_id) == DEFAULT_INGREDIENT_SECTION_ID:
        ensure_default_ingredient_section(db)
        return
    st = (section_title or "").strip()
    if not st:
        raise ValueError(
            f"Unknown section_id {section_id}. Pass section_title to register "
            "this catalog id, or use section_id 0 for the default unnamed section."
        )
    db.add(IngredientSectionRow(id=int(section_id), title=st, position=0))
    db.flush()


def _resolved_section_id_for_ingredient_line(
    db: Session,
    li: RecipeIngredientLineCreate,
    *,
    title_cache: dict[str, int],
) -> int:
    """
    Map this line to a catalog ``ingredient_sections.id``.

    Non-empty ``section_title`` (except legacy default ``Ingredients``) always goes
    through ``get_or_create_ingredient_section_catalog_id`` so the client ``section_id``
    cannot collide with another title.
    """
    st = (li.section_title or "").strip()
    if st and _norm_section_title_key(st) not in ("", "ingredients"):
        key = _norm_section_title_key(st)
        if key not in title_cache:
            title_cache[key] = get_or_create_ingredient_section_catalog_id(db, st)
        return title_cache[key]
    return int(li.section_id)


def _rebuild_ingredient_graph_from_detail(
    db: Session,
    recipe: RecipeRow,
    rows: list[RecipeIngredientLineCreate],
    *,
    allow_client_ingredient_ids: bool,
) -> None:
    if not rows:
        raise ValueError("ingredients_detail must be non-empty.")
    packed: list[tuple[RecipeIngredientLineCreate, str, int, int]] = []
    title_cache: dict[str, int] = {}
    for orig_i, li in enumerate(rows):
        ln = li.line.strip()
        if not ln:
            continue
        rid = li.recipe_id
        if rid is not None and int(rid) != int(recipe.id):
            raise ValueError(
                f"recipe_id {rid} does not match target recipe id {recipe.id}."
            )
        if not allow_client_ingredient_ids and li.ingredient_id is not None:
            raise ValueError("ingredient_id must be omitted when creating a new recipe.")
        resolved_sid = _resolved_section_id_for_ingredient_line(
            db, li, title_cache=title_cache
        )
        packed.append((li, ln, orig_i, resolved_sid))
    if not packed:
        raise ValueError("Add at least one non-empty ingredient line.")

    for li, _ln, _o, resolved_sid in packed:
        st = (li.section_title or "").strip()
        uses_title = bool(st) and _norm_section_title_key(st) not in (
            "",
            "ingredients",
        )
        if uses_title:
            continue
        _ensure_section_catalog_row_for_write(db, resolved_sid, li.section_title)

    ordered = sorted(
        packed,
        key=lambda t: (int(t[0].section_position), int(t[0].position), t[2]),
    )

    reserved_ids: set[int] = set()
    nid = _max_int_pk(db, RecipeIngredientRow) + 1

    def pick_ingredient_id(client_id: int | None) -> int:
        nonlocal nid
        if allow_client_ingredient_ids and client_id is not None:
            cid = int(client_id)
            if cid in reserved_ids:
                raise ValueError(f"Duplicate ingredient_id in payload: {cid}")
            existing = db.get(RecipeIngredientRow, cid)
            if existing is not None:
                raise ValueError(
                    f"ingredient_id {cid} is already in use; choose a free id or omit it."
                )
            reserved_ids.add(cid)
            return cid
        while db.get(RecipeIngredientRow, nid) is not None or nid in reserved_ids:
            nid += 1
        chosen = nid
        nid += 1
        reserved_ids.add(chosen)
        return chosen

    for li, ln, _o, resolved_sid in ordered:
        iid = pick_ingredient_id(li.ingredient_id)
        db.add(
            RecipeIngredientRow(
                id=iid,
                recipe_id=recipe.id,
                section_id=resolved_sid,
                section_position=int(li.section_position),
                position=int(li.position),
                line=ln,
            )
        )
    mirror_lines = [ln for _li, ln, _o, _sid in ordered]
    _write_ingredients_json_mirror(recipe, mirror_lines)


def _ingredient_section_refs_api(r: RecipeRow) -> list[dict[str, Any]]:
    """
    One entry per (section_id, section_position) block used by this recipe.
    Titles live here instead of repeating on every `ingredients_detail` line.
    """
    seen: set[tuple[int | None, int]] = set()
    refs: list[dict[str, Any]] = []
    for ing in r.ingredients:
        sid = ing.section_id
        sp = int(ing.section_position or 0)
        key = (sid, sp)
        if key in seen:
            continue
        seen.add(key)
        title = (ing.section.title or "") if ing.section is not None else ""
        refs.append(
            {"section_id": sid, "section_position": sp, "title": title},
        )
    refs.sort(
        key=lambda d: (
            d["section_position"],
            d["section_id"] if d["section_id"] is not None else 10**9,
        )
    )
    return refs


def _ingredients_detail_api(r: RecipeRow) -> list[dict[str, Any]]:
    def sec_pos(ing: RecipeIngredientRow) -> int:
        return int(ing.section_position or 0)

    def ing_pos(ing: RecipeIngredientRow) -> int:
        return int(ing.position or 0)

    ings = sorted(r.ingredients, key=lambda i: (sec_pos(i), ing_pos(i), i.id))
    out: list[dict[str, Any]] = []
    for ing in ings:
        line = (ing.line or "").strip()
        out.append(
            {
                "line": line,
                "ingredient_id": ing.id,
                "section_id": ing.section_id,
                "section_position": ing.section_position,
                "position": ing.position,
            }
        )
    return out


def list_ingredient_sections_catalog(db: Session) -> list[dict[str, Any]]:
    ensure_default_ingredient_section(db)
    rows = (
        db.query(IngredientSectionRow)
        .order_by(
            func.lower(func.coalesce(IngredientSectionRow.title, "")).asc(),
            IngredientSectionRow.id.asc(),
        )
        .all()
    )
    return [{"id": r.id, "title": r.title} for r in rows]


def _rebuild_ingredient_graph_from_lines(
    db: Session, recipe: RecipeRow, lines: list[str]
) -> None:
    cleaned = [ln.strip() for ln in lines if ln.strip()]
    if not cleaned:
        raise ValueError("Add at least one non-empty ingredient line.")
    ensure_default_ingredient_section(db)
    sid = DEFAULT_INGREDIENT_SECTION_ID
    ing_base = _max_int_pk(db, RecipeIngredientRow)
    for idx, line in enumerate(cleaned):
        iid = ing_base + idx + 1
        db.add(
            RecipeIngredientRow(
                id=iid,
                recipe_id=recipe.id,
                section_id=sid,
                section_position=0,
                position=idx,
                line=line,
            )
        )
    _write_ingredients_json_mirror(recipe, cleaned)


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _nutrition_payload_to_json(
    nutrition: dict[str, Any] | None,
) -> str | None:
    if not nutrition:
        return None
    out = {k: v for k, v in nutrition.items() if v is not None}
    if not out:
        return None
    return json.dumps(out)


def recipe_row_to_api(r: RecipeRow) -> dict[str, Any]:
    try:
        raw_kw = json.loads(r.keywords_json or "[]")
        keywords = raw_kw if isinstance(raw_kw, list) else []
    except json.JSONDecodeError:
        keywords = []
    keywords = [str(x) for x in keywords if x is not None]

    nutrition: dict[str, Any] | None = None
    if r.nutrition_json:
        try:
            parsed = json.loads(r.nutrition_json)
            if isinstance(parsed, dict):
                nutrition = parsed
        except json.JSONDecodeError:
            nutrition = None

    links = sorted(
        r.category_links,
        key=lambda L: (
            (L.category.name or "").lower() if L.category is not None else "",
            L.id,
        ),
    )
    linked_names: set[str] = set()
    for L in links:
        if L.category is None:
            continue
        n = (L.category.name or "").strip()
        if n:
            linked_names.add(n)
    rc = (r.category or "").strip()
    if linked_names:
        primary = (
            rc
            if rc in linked_names
            else sorted(linked_names, key=str.lower)[0]
        )
    elif links:
        # Join rows exist but categories did not resolve — keep denormalized label.
        primary = rc
    else:
        # No links: do not surface orphaned `recipes.category` text as a real category.
        primary = ""
    return {
        "id": r.id,
        "user_id": r.user_id,
        "title": r.title,
        "description": r.description,
        "directions": r.directions,
        "notes": r.notes,
        "image_url": r.image_url,
        "source_url": r.source_url,
        "category": primary,
        "categories": [
            {
                "link_id": L.id,
                "id": L.category.id,
                "name": (L.category.name or "").strip(),
            }
            for L in links
            if L.category is not None
        ],
        "keywords": keywords,
        "prep_time_min": r.prep_time_min,
        "cook_time_min": r.cook_time_min,
        "servings": r.servings,
        "status": r.status,
        "created_at": r.created_at,
        "nutrition": nutrition,
        "ingredients": decode_recipe_ingredients_list(r),
        "ingredient_section_refs": _ingredient_section_refs_api(r),
        "ingredients_detail": _ingredients_detail_api(r),
    }


def ensure_demo_recipe_seed_files() -> None:
    backend_root = Path(__file__).resolve().parent.parent
    src = backend_root / "seed_assets" / "recipe-seed"
    if not src.is_dir():
        return
    dest = settings.uploads_dir.parent / "recipe-seed"
    dest.mkdir(parents=True, exist_ok=True)
    for f in src.iterdir():
        if not f.is_file():
            continue
        target = dest / f.name
        if not target.exists() or target.stat().st_mtime < f.stat().st_mtime:
            shutil.copy2(f, target)


def _demo_image_url_for_title(title: str) -> str | None:
    rel = DEMO_RECIPE_IMAGE_BY_TITLE.get(title)
    if not rel:
        return None
    path = settings.uploads_dir.parent / rel
    if not path.is_file():
        return None
    return f"/static/{rel}"


def sync_demo_recipe_images(db: Session) -> None:
    changed = False
    for title, rel in DEMO_RECIPE_IMAGE_BY_TITLE.items():
        url = _demo_image_url_for_title(title)
        if not url:
            continue
        row = db.query(RecipeRow).filter(RecipeRow.title == title).first()
        if row is not None and row.image_url != url:
            row.image_url = url
            changed = True
    if changed:
        db.commit()


def wipe_all_application_data(db: Session) -> None:
    """
    Remove shopping lists, recipes, categories, and ingredient section catalog rows.

    Intended for local reset or staging re-import; caller commits afterward.
    """
    db.execute(delete(ShoppingListItemRow))
    db.execute(delete(ShoppingListRow))
    db.execute(delete(RecipeIngredientRow))
    db.execute(delete(RecipeCategoryLinkRow))
    db.execute(delete(RecipeRow))
    db.execute(delete(CategoryRow))
    db.execute(delete(IngredientSectionRow))
    db.flush()


def replace_ingredient_sections_catalog(
    db: Session, sections: list[dict[str, Any]]
) -> None:
    """Replace all `ingredient_sections` rows with the bundle definitions (explicit ids)."""
    db.execute(delete(IngredientSectionRow))
    db.flush()
    for s in sorted(sections, key=lambda x: int(x["id"])):
        sid = int(s["id"])
        raw = str(s.get("title", "")).strip()
        title = "" if sid == DEFAULT_INGREDIENT_SECTION_ID else raw
        db.add(
            IngredientSectionRow(
                id=sid,
                title=title,
                position=int(s.get("position") or 0),
            )
        )
    db.flush()


def insert_recipe_from_bundle_dict(
    db: Session, row: dict[str, Any], *, now: str
) -> None:
    """Insert one recipe + `recipe_ingredients` from a validated bundle recipe object."""
    nutrition = row.get("nutrition")
    title = str(row["title"]).strip()
    seed_lines = [str(ing["line"]).strip() for ing in row["ingredients"]]
    rid = _max_int_pk(db, RecipeRow) + 1
    recipe = RecipeRow(
        id=rid,
        user_id=DEMO_USER,
        title=title,
        description=row.get("description"),
        directions=row.get("directions"),
        notes=row.get("notes"),
        image_url=_demo_image_url_for_title(title),
        source_url=None,
        category=row.get("category") or "",
        keywords_json=json.dumps(row.get("keywords") or []),
        prep_time_min=row.get("prep_time_min"),
        cook_time_min=row.get("cook_time_min"),
        servings=float(row.get("servings", 1)),
        status=row.get("status", "library"),
        nutrition_json=json.dumps(nutrition) if nutrition else None,
        created_at=now,
    )
    db.add(recipe)
    db.flush()

    key_to_section: dict[str, tuple[int, int]] = {}
    for s in row["sections"]:
        sid = int(s["catalog_section_id"])
        key_to_section[str(s["key"]).strip()] = (sid, int(s["position"]))

    ing_base = _max_int_pk(db, RecipeIngredientRow)
    for j, ing in enumerate(row["ingredients"]):
        sk = str(ing["section_key"]).strip()
        pair = key_to_section.get(sk)
        if not pair:
            sid = DEFAULT_INGREDIENT_SECTION_ID
            sec_pos = 0
        else:
            sid, sec_pos = pair
        db.add(
            RecipeIngredientRow(
                id=ing_base + j + 1,
                recipe_id=recipe.id,
                section_id=sid,
                section_position=sec_pos,
                position=int(ing["position"]),
                line=str(ing["line"]).strip(),
            )
        )
    db.flush()
    cat_names = row.get("categories")
    if cat_names:
        set_recipe_categories_from_names(db, recipe, cat_names)
    elif row.get("category"):
        set_recipe_categories_from_names(db, recipe, [str(row["category"]).strip()])
    _write_ingredients_json_mirror(recipe, seed_lines)


def apply_seed_bundle(db: Session, bundle: dict[str, Any]) -> None:
    """
    Load catalog + recipes from a validated bundle dict (see `seed_bundle.load_seed_bundle`).

    Caller must ensure `recipe_ingredients` / `recipes` are empty or wiped first.
    """
    from .seed_bundle import validate_seed_bundle

    validate_seed_bundle(bundle)
    replace_ingredient_sections_catalog(db, bundle["ingredient_sections"])
    now = _iso_now()
    for row in bundle["recipes"]:
        insert_recipe_from_bundle_dict(db, row, now=now)
    db.commit()


def seed_if_empty(db: Session) -> None:
    count = db.query(func.count(RecipeRow.id)).scalar() or 0
    if count > 0:
        return
    from .seed_bundle import load_seed_bundle

    apply_seed_bundle(db, load_seed_bundle())


def list_recipes(db: Session) -> list[dict[str, Any]]:
    rows = (
        db.query(RecipeRow)
        .options(
            selectinload(RecipeRow.category_links).selectinload(
                RecipeCategoryLinkRow.category
            ),
            selectinload(RecipeRow.ingredients).selectinload(
                RecipeIngredientRow.section
            ),
        )
        .order_by(RecipeRow.created_at.desc())
        .all()
    )
    return [recipe_row_to_api(r) for r in rows]


def get_recipe(db: Session, recipe_id: int) -> RecipeRow | None:
    return (
        db.query(RecipeRow)
        .options(
            selectinload(RecipeRow.category_links).selectinload(
                RecipeCategoryLinkRow.category
            ),
            selectinload(RecipeRow.ingredients).selectinload(
                RecipeIngredientRow.section
            ),
        )
        .filter(RecipeRow.id == recipe_id)
        .first()
    )


def save_uploaded_image(
    image_base64: str | None, mime: str | None
) -> str | None:
    if not image_base64 or not image_base64.strip():
        return None
    raw = image_base64.strip()
    if "," in raw and raw.startswith("data:"):
        raw = raw.split(",", 1)[1]
    data = base64.b64decode(raw)
    ext = ".jpg"
    if mime:
        if "png" in mime.lower():
            ext = ".png"
        elif "webp" in mime.lower():
            ext = ".webp"
    settings.uploads_dir.mkdir(parents=True, exist_ok=True)
    name = f"{uuid.uuid4().hex}{ext}"
    path = settings.uploads_dir / name
    path.write_bytes(data)
    return f"/static/uploads/{name}"


def create_recipe(
    db: Session,
    *,
    title: str,
    directions: str | None,
    ingredients: list[str],
    tags: list[str],
    categories: list[str] | None = None,
    category_ids: list[int] | None = None,
    servings: float,
    source_url: str | None = None,
    description: str | None = None,
    image_base64: str | None = None,
    image_mime: str | None = None,
    prep_time_min: int | None = None,
    cook_time_min: int | None = None,
    nutrition: dict[str, Any] | None = None,
    ingredients_detail: list[RecipeIngredientLineCreate] | None = None,
) -> dict[str, Any]:
    now = _iso_now()
    image_url = save_uploaded_image(image_base64, image_mime)

    keywords = [t.strip() for t in tags if t.strip()]

    rid = _max_int_pk(db, RecipeRow) + 1
    recipe = RecipeRow(
        id=rid,
        user_id=DEMO_USER,
        title=title.strip(),
        description=description,
        directions=directions,
        notes=None,
        image_url=image_url,
        source_url=source_url.strip() if source_url and source_url.strip() else None,
        category="",
        keywords_json=json.dumps(keywords),
        prep_time_min=prep_time_min,
        cook_time_min=cook_time_min,
        servings=float(servings),
        status="library",
        nutrition_json=_nutrition_payload_to_json(nutrition),
        created_at=now,
    )
    db.add(recipe)
    db.flush()

    if ingredients_detail:
        _rebuild_ingredient_graph_from_detail(
            db, recipe, ingredients_detail, allow_client_ingredient_ids=False
        )
    else:
        _rebuild_ingredient_graph_from_lines(db, recipe, ingredients)
    db.flush()
    cats = apply_recipe_category_links(
        db,
        recipe,
        category_ids=list(category_ids or []),
        names=list(categories or []),
    )
    recipe.category = cats[0].name if cats else ""
    db.commit()
    db.refresh(recipe)
    return recipe_row_to_api(recipe)


def replace_recipe(
    db: Session,
    recipe_id: int,
    *,
    title: str,
    directions: str | None,
    ingredients: list[str],
    tags: list[str],
    categories: list[str] | None = None,
    category_ids: list[int] | None = None,
    servings: float,
    source_url: str | None = None,
    description: str | None = None,
    image_base64: str | None = None,
    image_mime: str | None = None,
    prep_time_min: int | None = None,
    cook_time_min: int | None = None,
    nutrition: dict[str, Any] | None = None,
    ingredients_detail: list[RecipeIngredientLineCreate] | None = None,
) -> dict[str, Any] | None:
    """Replace recipe core fields and rebuild ingredient graph; keeps id, notes, status, created_at."""
    recipe = get_recipe(db, recipe_id)
    if not recipe:
        return None

    db.execute(
        delete(RecipeIngredientRow).where(RecipeIngredientRow.recipe_id == recipe_id)
    )
    db.flush()

    keywords = [t.strip() for t in tags if t.strip()]
    new_image = save_uploaded_image(image_base64, image_mime)
    if new_image:
        recipe.image_url = new_image

    recipe.title = title.strip()
    recipe.description = description
    recipe.directions = directions
    recipe.source_url = (
        source_url.strip() if source_url and source_url.strip() else None
    )
    recipe.keywords_json = json.dumps(keywords)
    recipe.prep_time_min = prep_time_min
    recipe.cook_time_min = cook_time_min
    recipe.servings = float(servings)
    recipe.nutrition_json = _nutrition_payload_to_json(nutrition)
    db.flush()

    if ingredients_detail:
        _rebuild_ingredient_graph_from_detail(
            db, recipe, ingredients_detail, allow_client_ingredient_ids=True
        )
    else:
        _rebuild_ingredient_graph_from_lines(db, recipe, ingredients)
    db.flush()
    apply_recipe_category_links(
        db,
        recipe,
        category_ids=list(category_ids or []),
        names=list(categories or []),
    )
    db.commit()
    db.refresh(recipe)
    return recipe_row_to_api(recipe)


def update_recipe_status(db: Session, recipe_id: int, status: str) -> RecipeRow | None:
    row = get_recipe(db, recipe_id)
    if not row:
        return None
    row.status = status
    db.commit()
    db.refresh(row)
    return row


def update_recipe_notes(db: Session, recipe_id: int, notes: str | None) -> RecipeRow | None:
    row = get_recipe(db, recipe_id)
    if not row:
        return None
    row.notes = notes
    db.commit()
    db.refresh(row)
    return row
