from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from . import db_models  # noqa: F401 — register models
from .config import settings
from .database import Base, SessionLocal, engine, get_db
from .recipe_db_service import (
    apply_recipe_category_links,
    backfill_recipe_ingredients_json,
    create_recipe,
    ensure_demo_recipe_seed_files,
    ensure_recipe_category_non_null,
    get_recipe,
    list_categories,
    list_ingredient_sections_catalog,
    list_recipes,
    recipe_row_to_api,
    replace_recipe,
    seed_if_empty,
    sync_demo_recipe_images,
    sync_recipe_denormalized_category_from_links,
)
from .schemas import (
    ConvertRequest,
    ConvertResponse,
    DedupeItem,
    DedupeResponse,
    RecipeCreateBody,
    RecipePatchBody,
    ShoppingStateIn,
)
from .shopping_db_service import get_shopping_state, replace_shopping_state
from .services.conversion import convert_quantity
from .services.dedupe import dedupe_items


@asynccontextmanager
async def lifespan(_app: FastAPI):
    Base.metadata.create_all(bind=engine)
    settings.uploads_dir.mkdir(parents=True, exist_ok=True)
    ensure_demo_recipe_seed_files()
    db = SessionLocal()
    try:
        seed_if_empty(db)
        backfill_recipe_ingredients_json(db)
        ensure_recipe_category_non_null(db)
        sync_recipe_denormalized_category_from_links(db)
        sync_demo_recipe_images(db)
    finally:
        db.close()
    yield


app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)

# With allow_credentials=True, browsers reject Allow-Headers: * on preflight.
# List headers the app sends (Content-Type on writes, Authorization for Basic auth).
_CORS_ALLOW_HEADERS = [
    "Content-Type",
    "Authorization",
    "Accept",
    "Accept-Language",
    "X-Requested-With",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=_CORS_ALLOW_HEADERS,
)

static_root = settings.uploads_dir.parent
static_root.mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=str(static_root)), name="static")


@app.get("/")
def root():
    """Browser-friendly: `/` had no route (404). Interactive API: `/docs`."""
    return RedirectResponse(url="/docs")


@app.get("/health")
def health():
    return {"status": "ok", "service": settings.app_name}


# --- Recipe DB (SQLite; swap DATABASE_URL for Postgres/RDS later) ---


@app.get("/categories")
def categories_list(db: Session = Depends(get_db)):
    return {"categories": list_categories(db)}


@app.get("/ingredient-sections")
def ingredient_sections_catalog(db: Session = Depends(get_db)):
    """Shared `ingredient_sections` catalog ids + titles for the UI."""
    return {"sections": list_ingredient_sections_catalog(db)}


@app.get("/recipes")
def recipes_list(db: Session = Depends(get_db)):
    return {"recipes": list_recipes(db)}


@app.post("/recipes", status_code=201)
def recipes_create(body: RecipeCreateBody, db: Session = Depends(get_db)):
    try:
        nutrition_dump = (
            body.nutrition.model_dump(exclude_none=True) if body.nutrition else None
        )
        out = create_recipe(
            db,
            title=body.title,
            directions=body.directions,
            ingredients=body.ingredients,
            ingredients_detail=body.ingredients_detail,
            tags=body.tags,
            categories=body.categories,
            category_ids=body.category_ids,
            servings=body.servings,
            source_url=body.source_url,
            description=body.description,
            image_base64=body.image_base64,
            image_mime=body.image_mime,
            prep_time_min=body.prep_time_min,
            cook_time_min=body.cook_time_min,
            nutrition=nutrition_dump,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return out


@app.get("/recipes/{recipe_id}")
def recipes_get(recipe_id: int, db: Session = Depends(get_db)):
    row = get_recipe(db, recipe_id)
    if not row:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return recipe_row_to_api(row)


@app.put("/recipes/{recipe_id}")
def recipes_put(recipe_id: int, body: RecipeCreateBody, db: Session = Depends(get_db)):
    """Replace recipe content (same payload shape as POST /recipes); keeps id, notes, status."""
    try:
        nutrition_dump = (
            body.nutrition.model_dump(exclude_none=True) if body.nutrition else None
        )
        out = replace_recipe(
            db,
            recipe_id,
            title=body.title,
            directions=body.directions,
            ingredients=body.ingredients,
            ingredients_detail=body.ingredients_detail,
            tags=body.tags,
            categories=body.categories,
            category_ids=body.category_ids,
            servings=body.servings,
            source_url=body.source_url,
            description=body.description,
            image_base64=body.image_base64,
            image_mime=body.image_mime,
            prep_time_min=body.prep_time_min,
            cook_time_min=body.cook_time_min,
            nutrition=nutrition_dump,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    if not out:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return out


@app.patch("/recipes/{recipe_id}")
def recipes_patch(
    recipe_id: int, body: RecipePatchBody, db: Session = Depends(get_db)
):
    row = get_recipe(db, recipe_id)
    if not row:
        raise HTTPException(status_code=404, detail="Recipe not found")
    patch = body.model_dump(exclude_unset=True)
    if not patch:
        raise HTTPException(status_code=400, detail="No fields to update")
    if "categories" in patch or "category_ids" in patch:
        ids = patch.get("category_ids", []) if "category_ids" in patch else []
        names = patch.get("categories", []) if "categories" in patch else []
        apply_recipe_category_links(db, row, category_ids=ids, names=names)
    if "status" in patch:
        st = patch["status"]
        if st not in ("library", "planned"):
            raise HTTPException(status_code=400, detail="Invalid status")
        row.status = st
    if "notes" in patch:
        n = patch["notes"]
        row.notes = n.strip() if isinstance(n, str) and n.strip() else None
    db.commit()
    db.refresh(row)
    return recipe_row_to_api(row)


@app.post("/units/convert", response_model=ConvertResponse)
def units_convert(body: ConvertRequest):
    q, u, method = convert_quantity(
        body.quantity,
        body.from_unit,
        body.to_unit,
        ingredient_name=body.ingredient_name,
    )
    return ConvertResponse(quantity=round(q, 4), unit=u, method=method)


@app.post("/shopping-lists/dedupe", response_model=DedupeResponse)
def shopping_dedupe(items: list[DedupeItem]):
    normalized = []
    for i in items:
        d = i.model_dump()
        normalized.append(
            {
                "name": d.get("name"),
                "quantity": d.get("quantity"),
                "unit": d.get("unit"),
                "category": d.get("category"),
                "source_recipe_id": d.get("source_recipe_id"),
            }
        )
    out, merged = dedupe_items(normalized)
    return DedupeResponse(items=out, merged_count=merged)


@app.post("/shopping-lists/generate")
def shopping_generate_placeholder():
    """Reserved: aggregate planned recipe ingredients + dedupe (needs DB)."""
    return {
        "detail": "Wire to RDS: select planned recipes for user, flatten ingredients, dedupe.",
        "list_id": None,
    }


@app.get("/shopping-lists/state")
def shopping_get_state(db: Session = Depends(get_db)):
    return get_shopping_state(db)


@app.put("/shopping-lists/state")
def shopping_put_state(body: ShoppingStateIn, db: Session = Depends(get_db)):
    return replace_shopping_state(db, body.model_dump(by_alias=True))
