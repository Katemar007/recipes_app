#!/usr/bin/env python3
"""
Import curated recipes from external URLs into the SQLite DB.

- Saves hero images under <repo>/assets/recipes/ (for version control / design reference).
- Uploads the same bytes via create_recipe → backend data/uploads + image_url.

Idempotent: skips when a recipe with the same source_url already exists.

Note: www.allrecipes.com blocks headless HTTP (Cloudflare). Recipe text is transcribed from
the published pages; hero images use archive.org snapshots of AllRecipes OpenGraph URLs.

For the full URL list from the public Notion page, use `scripts/import_notion_jsonld.py`
(JSON-LD Recipe extraction; skips YouTube and other non-recipe links).

Usage (from repo root):
  cd backend && source .venv/bin/activate && python scripts/import_external_recipes.py
"""

from __future__ import annotations

import base64
import html as html_lib
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REPO_ROOT = ROOT.parent
ASSETS_RECIPES = REPO_ROOT / "assets" / "recipes"

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sqlalchemy import text  # noqa: E402

from app.config import settings  # noqa: E402
from app.database import SessionLocal, engine  # noqa: E402
from app.db_models import RecipeRow  # noqa: E402
from app.recipe_db_service import (  # noqa: E402
    create_recipe,
    flatten_ingredient_section_tuples,
)


def _sqlite_add_column_if_missing(table: str, column: str, col_type: str) -> None:
    with engine.connect() as conn:
        rows = conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
        if column in {r[1] for r in rows}:
            return
        conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}"))
        conn.commit()


def _ensure_sqlite_recipe_graph_columns() -> None:
    if "sqlite" not in settings.database_url:
        return
    for col, typ in (
        ("recipe_id", "INTEGER"),
        ("position", "INTEGER"),
    ):
        _sqlite_add_column_if_missing("ingredient_sections", col, typ)
    for col, typ in (
        ("recipe_id", "INTEGER"),
        ("section_id", "INTEGER"),
        ("section_position", "INTEGER"),
        ("position", "INTEGER"),
        ("line", "TEXT"),
        ("name", "TEXT"),
        ("quantity", "FLOAT"),
        ("unit", "TEXT"),
        ("category", "TEXT"),
    ):
        _sqlite_add_column_if_missing("recipe_ingredients", col, typ)


UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)


def download_bytes(url: str, timeout: int = 45) -> tuple[bytes, str]:
    """Return (body, mime_type)."""
    url = html_lib.unescape(url)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        data = resp.read()
        mime = resp.headers.get("Content-Type", "application/octet-stream").split(";")[0].strip()
    return data, mime


def _ext_for_mime(mime: str) -> str:
    m = mime.lower()
    if "jpeg" in m or m.endswith("/jpg"):
        return ".jpg"
    if "png" in m:
        return ".png"
    if "webp" in m:
        return ".webp"
    return ".jpg"


def save_asset_and_b64(
    slug: str, image_url: str | None
) -> tuple[str | None, str | None]:
    """Download image to assets/recipes/<slug>.ext; return (base64, mime) for create_recipe."""
    if not image_url:
        return None, None
    try:
        data, mime = download_bytes(image_url)
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        print(f"  (skip image {slug}: {e})")
        return None, None
    ASSETS_RECIPES.mkdir(parents=True, exist_ok=True)
    ext = _ext_for_mime(mime)
    path = ASSETS_RECIPES / f"{slug}{ext}"
    path.write_bytes(data)
    print(f"  saved image → {path.relative_to(REPO_ROOT)}")
    b64 = base64.standard_b64encode(data).decode("ascii")
    return b64, mime


RECIPE_SPECS: list[dict] = [
    {
        "slug": "tomato-pork-loin-chops",
        "title": "Tomato Pork Loin Chops",
        "source_url": "https://www.allrecipes.com/recipe/62883/tomato-pork-loin-chops/",
        "description": (
            "Pan-seared pork loin chops simmered in a spiced tomato sauce with onion, "
            "chili powder, and fennel — adapted from Allrecipes."
        ),
        "ingredient_sections": [
            (
                "Ingredients",
                "\n".join(
                    [
                        "2 tablespoons olive oil, divided",
                        "4 boneless pork loin chops, pounded thin",
                        "1 large onion, sliced",
                        "½ teaspoon white sugar",
                        "2 teaspoons chili powder",
                        "½ teaspoon fennel seeds, crushed",
                        "½ teaspoon red pepper flakes",
                        "1 teaspoon dried oregano",
                        "1 (8 ounce) can tomato sauce",
                        "2 fluid ounces water",
                        "1 teaspoon Worcestershire sauce",
                        "Salt and freshly ground black pepper to taste",
                    ]
                ),
            )
        ],
        "directions": "\n".join(
            [
                "1. Heat 1 tablespoon olive oil in a large skillet over medium-high heat. "
                "Season pork chops with salt and pepper and brown on both sides; remove and set aside.",
                "2. Heat remaining oil in the skillet. Cook onion with sugar until softened and golden, "
                "stirring often.",
                "3. Stir in chili powder, fennel seeds, red pepper flakes, and oregano; cook until fragrant.",
                "4. Add tomato sauce, water, and Worcestershire sauce; bring to a simmer.",
                "5. Return pork chops to the skillet, nestle into the sauce, and simmer until pork is "
                "cooked through (internal temperature 145°F / 63°C), about 10–15 minutes.",
            ]
        ),
        "tags": ["pork", "tomato", "skillet", "dinner", "Allrecipes"],
        "categories": ["Pork", "Dinner"],
        "servings": 4.0,
        "prep_time_min": 15,
        "cook_time_min": 35,
        "nutrition": None,
        "image_url": (
            "https://web.archive.org/web/20250529234254im_/https://www.allrecipes.com/thmb/"
            "aeoQGgGYbHvFMDQvnANpAQbmKQM=/1500x0/filters:no_upscale():max_bytes(150000):"
            "strip_icc()/9355214-509116c8a2cc49d9af0f86b6864a3ff4.jpg"
        ),
    },
    {
        "slug": "ryba-pod-marinadom",
        "title": "Рыба под маринадом (Fish in vegetable marinade)",
        "source_url": "https://www.gastronom.ru/recipe/13045/ryba-pod-marinadom",
        "description": (
            "Classic Russian–Soviet–style fish under a tangy tomato–vegetable marinade; "
            "cod is fried then covered with a simmered onion–carrot–parsley root sauce "
            "(Гастрономъ / Gastronom.ru)."
        ),
        "ingredient_sections": [
            (
                "Ingredients",
                "\n".join(
                    [
                        "500 g cod fillet (or other firm white fish)",
                        "2 medium yellow onions",
                        "2 medium carrots",
                        "1 parsley root (or 1 tsp dried parsley root)",
                        "50 ml vegetable oil",
                        "1 tablespoon tomato paste",
                        "60 ml water",
                        "1½ tablespoons 9% vinegar",
                        "1 teaspoon sugar",
                        "4–5 black peppercorns",
                        "2 bay leaves",
                        "2 tablespoons all-purpose flour",
                        "Freshly ground black pepper to taste",
                        "Salt to taste",
                    ]
                ),
            )
        ],
        "directions": "\n".join(
            [
                "1. Slice onions into rings. Peel carrots and cut into very thin matchsticks. "
                "Peel and finely grate parsley root (or use dried substitute).",
                "2. Heat half the oil in a large skillet over medium heat. Add vegetables and fry, "
                "stirring, about 5 minutes.",
                "3. Stir in tomato paste, then add water, bring to a boil, and simmer gently ~10 minutes.",
                "4. Add vinegar, sugar, peppercorns, and bay leaves; season with salt. Simmer ~10 minutes more; "
                "add black pepper to taste.",
                "5. Pat cod dry, cut into large pieces, season with salt and pepper, and dredge lightly in flour.",
                "6. Heat remaining oil in a skillet and fry fish until golden on both sides.",
                "7. Transfer fish to a shallow dish, pour hot marinade over, cool, then refrigerate "
                "at least 30 minutes before serving. Garnish with fresh herbs if you like.",
            ]
        ),
        "tags": ["fish", "Russian", "marinade", "cod", "Gastronom"],
        "categories": ["Seafood", "Dinner"],
        "servings": 4.0,
        "prep_time_min": 60,
        "cook_time_min": 50,
        "nutrition": {
            "kcal": 307.62,
            "protein_g": 24.84,
            "carbs_g": 20.48,
            "fat_g": 13.65,
        },
        "image_url": (
            "https://images.gastronom.ru/dh68CIWwruNz2czsGO-jw3lwYt4InHz9f2AGXYHnaJo/"
            "pr:recipe-cover-image/g:ce/rs:auto:0:0:0/"
            "L2Ntcy9hbGwtaW1hZ2VzL2NmOWFiNzIwLTk4NDQtNDRhMS1iMGZkLWNlZmYzN2NkZDU1YS5qcGc.webp"
        ),
    },
    {
        "slug": "grilled-swordfish-smoky-tomato-salsa",
        "title": "Grilled Swordfish With Smoky Tomato-Anchovy Salsa",
        "source_url": (
            "https://cooking.nytimes.com/recipes/1020317-grilled-swordfish-with-smoky-tomato-anchovy-salsa"
        ),
        "description": (
            "Firm grilled swordfish with a cherry-tomato salsa of anchovy, smoked paprika, "
            "and fresh chiles — by David Tanis (NYT Cooking)."
        ),
        "ingredient_sections": [
            (
                "Ingredients",
                "\n".join(
                    [
                        "4 (8-ounce) swordfish steaks, cut ¾-inch thick",
                        "Kosher salt and black pepper",
                        "Extra-virgin olive oil as needed",
                        "3 tablespoons red wine vinegar, or to taste",
                        "1 teaspoon smoked Spanish paprika (Pimentón de la Vera)",
                        "1 teaspoon tomato paste",
                        "2 small garlic cloves, smashed to a paste",
                        "1 medium red onion, diced small (about 1 cup)",
                        "1 sweet red bell pepper, diced (about 1 cup)",
                        "2 Fresno chiles, seeds removed, finely diced",
                        "4 anchovy fillets, chopped, plus 4 whole fillets for garnish",
                        "2 cups halved mixed cherry tomatoes",
                        "Pinch of dried oregano",
                        "Arugula leaves, for garnish",
                    ]
                ),
            )
        ],
        "directions": "\n".join(
            [
                "1. Prepare a charcoal grill or preheat a gas grill (or use a cast-iron skillet / "
                "grill pan over medium-high). Season swordfish with salt and pepper, drizzle each "
                "steak with about 1 teaspoon olive oil, and rub to coat. Rest at room temperature.",
                "2. In a bowl, whisk vinegar, smoked paprika, tomato paste, and garlic until smooth. "
                "Add onion, sweet pepper, chiles, and chopped anchovies; season lightly with salt. "
                "Whisk in ½–¾ cup olive oil.",
                "3. Fold in cherry tomatoes, season lightly, and let marinate about 10 minutes.",
                "4. Grill swordfish over medium-hot heat about 4 minutes per side until just cooked "
                "(juices begin to rise on the second side).",
                "5. Plate fish, spoon salsa generously on top, sprinkle oregano, garnish with whole "
                "anchovies, and surround with arugula.",
            ]
        ),
        "tags": ["swordfish", "grill", "seafood", "salsa", "NYT Cooking", "David Tanis"],
        "categories": ["Seafood", "Dinner"],
        "servings": 6.0,
        "prep_time_min": 25,
        "cook_time_min": 35,
        "nutrition": {
            "kcal": 293.0,
            "protein_g": 32.0,
            "carbs_g": 8.0,
            "fat_g": 14.0,
        },
        "image_url": (
            "https://static01.nyt.com/images/2019/07/03/dining/28kitchenrex/"
            "merlin_156916815_308c1d1d-1ed8-4ceb-86a4-ccd5abdb529d-threeByTwoMediumAt2X.jpg"
        ),
    },
    {
        "slug": "chef-johns-beef-goulash",
        "title": "Chef John's Beef Goulash",
        "source_url": "https://www.allrecipes.com/recipe/231009/chef-johns-beef-goulash/",
        "description": (
            "Hungarian-style beef stew with paprika, caraway, and tomato paste, simmered until "
            "tender — serve over noodles with sour cream (Allrecipes / Food Wishes)."
        ),
        "ingredient_sections": [
            (
                "Ingredients",
                "\n".join(
                    [
                        "2½ pounds boneless beef chuck roast, cut into 2-inch cubes",
                        "Salt and freshly ground black pepper",
                        "2 tablespoons vegetable oil",
                        "2 large onions, chopped",
                        "2 teaspoons olive oil",
                        "½ teaspoon salt",
                        "2 tablespoons Hungarian sweet paprika",
                        "2 teaspoons caraway seeds, crushed",
                        "1 teaspoon freshly ground black pepper",
                        "1 teaspoon dried marjoram",
                        "½ teaspoon dried thyme",
                        "½ teaspoon cayenne pepper",
                        "4 cups low-sodium chicken broth, divided",
                        "¼ cup tomato paste",
                        "3 cloves garlic, crushed",
                        "2 tablespoons balsamic vinegar",
                        "1 teaspoon white sugar",
                        "½ teaspoon salt (or to taste)",
                        "1 bay leaf",
                    ]
                ),
            )
        ],
        "directions": "\n".join(
            [
                "1. Pat beef dry; season generously with salt and black pepper. Brown in vegetable oil "
                "in batches over high heat; transfer to a large pot.",
                "2. In the same pan, sauté onions in drippings with olive oil and ½ tsp salt until "
                "softened, about 5 minutes; add to the pot.",
                "3. Reduce heat; toast paprika, caraway, black pepper, marjoram, thyme, and cayenne "
                "until fragrant, about 1 minute. Stir in 1 cup broth, scrape the pan, and pour into the pot.",
                "4. Add remaining broth, tomato paste, garlic, vinegar, sugar, salt, and bay leaf. "
                "Bring to a boil, then reduce to a low simmer. Cover and cook until beef is very tender, "
                "about 1½–2 hours. Skim fat if desired. Serve over buttered egg noodles with sour cream.",
            ]
        ),
        "tags": ["beef", "goulash", "Hungarian", "stew", "paprika", "Allrecipes", "Chef John"],
        "categories": ["Beef", "Dinner"],
        "servings": 4.0,
        "prep_time_min": 30,
        "cook_time_min": 120,
        "nutrition": None,
        # Direct CDN (Wayback Meredith image URL often 404s).
        "image_url": "https://images.media-allrecipes.com/userphotos/3638637.jpg",
    },
    {
        "slug": "langostino-alfredo",
        "title": "Langostino Alfredo",
        "source_url": "https://www.pookspantry.com/how-to-make-langostino-alfredo/",
        "description": (
            "Creamy Parmesan alfredo with a lightened roux-based sauce, folded with thawed "
            "langostino tails — Pook's Pantry."
        ),
        "ingredient_sections": [
            (
                "Ingredients",
                "\n".join(
                    [
                        "4 ounces dried pasta, cooked per package directions (reserve about 1 cup pasta water)",
                        "6 ounces langostino tails, thawed and drained",
                        "2½ tablespoons unsalted butter",
                        "1 tablespoon all-purpose flour",
                        "2–4 cloves garlic, minced",
                        "½ teaspoon kosher salt (e.g. Diamond Crystal), plus more to taste",
                        "¼ teaspoon ground black pepper, plus more to taste",
                        "¾ cup half-and-half, room temperature",
                        "¼ cup whole milk, room temperature",
                        "1½ cups freshly grated Parmesan cheese, divided",
                        "1 tablespoon chopped chives or parsley for garnish (optional)",
                    ]
                ),
            )
        ],
        "directions": "\n".join(
            [
                "1. Melt butter in a medium saucepan over medium heat. Whisk in flour; cook 3–4 minutes "
                "to cook out the raw flour taste.",
                "2. Add garlic; whisk. Season with about half the salt and pepper.",
                "3. Slowly whisk in milk and half-and-half (add gradually while whisking).",
                "4. Cook over medium to medium-low heat, whisking often, until the sauce thickens.",
                "5. Off heat, whisk in 1–1¼ cups Parmesan until smooth. Adjust salt and pepper.",
                "6. Thin with pasta water if needed. Toss a few ladles of sauce with the drained pasta.",
                "7. Gently fold langostino into the remaining sauce; ladle over pasta.",
                "8. Top with herbs and the rest of the Parmesan.",
            ]
        ),
        "tags": ["langostino", "alfredo", "pasta", "seafood", "Pook's Pantry"],
        "categories": ["Pasta", "Seafood", "Dinner"],
        "servings": 2.0,
        "prep_time_min": 10,
        "cook_time_min": 25,
        "nutrition": {
            "kcal": 687.0,
            "protein_g": 29.0,
            "carbs_g": 39.0,
            "fat_g": 46.0,
        },
        "image_url": (
            "https://www.pookspantry.com/wp-content/uploads/2020/09/langostino-alfredo-pasta-on-fork.jpg"
        ),
    },
]


def main() -> None:
    print(
        "Skipping Notion hub "
        "(https://www.notion.so/333fa1a64ffc8052be02fa08a11bd93a): "
        "page content requires Notion API or manual export.\n"
    )
    _ensure_sqlite_recipe_graph_columns()
    ASSETS_RECIPES.mkdir(parents=True, exist_ok=True)

    db = SessionLocal()
    try:
        for spec in RECIPE_SPECS:
            src = spec["source_url"]
            exists = (
                db.query(RecipeRow).filter(RecipeRow.source_url == src).first()
            )
            if exists:
                print(f"Skip (source_url in DB): {spec['title']!r}")
                continue

            img_b64, img_mime = save_asset_and_b64(spec["slug"], spec.get("image_url"))

            sections = spec["ingredient_sections"]
            create_recipe(
                db,
                title=spec["title"],
                directions=spec["directions"],
                ingredients=flatten_ingredient_section_tuples(list(sections)),
                tags=spec["tags"],
                categories=spec["categories"],
                servings=float(spec["servings"]),
                source_url=spec["source_url"],
                description=spec.get("description"),
                prep_time_min=spec.get("prep_time_min"),
                cook_time_min=spec.get("cook_time_min"),
                nutrition=spec.get("nutrition"),
                image_base64=img_b64,
                image_mime=img_mime,
            )
            print(f"Added: {spec['title']!r}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
