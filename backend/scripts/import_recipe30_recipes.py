#!/usr/bin/env python3
"""
Import two recipes from Recipe30.com. Idempotent: skips if a recipe with the same title exists.
Does not delete or replace existing data.

Sources:
  https://recipe30.com/apple-cinnamon-butter-cake.html/
  https://recipe30.com/tarragon-chicken-meat-balls.html/
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
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
    """Add columns expected by current models (legacy / partial SQLite schemas). No deletes."""
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

APPLE_CAKE = {
    "title": "Apple Cinnamon Butter Cake",
    "description": (
        "Classic apple cake with cinnamon and caramelised apples over a soft buttery base — "
        "inspired by French-style home baking (Recipe30 / Joel Mielle)."
    ),
    "directions": "\n".join(
        [
            "1. Peel, core and thinly slice the apples. Work fairly quickly so they do not brown "
            "(toss with a little lemon juice if prepping ahead).",
            "2. Cinnamon sugar: in a small bowl, mix the white sugar, cinnamon, nutmeg, melted butter, "
            "and a pinch of salt until combined. Set aside.",
            "3. Batter: in a large bowl, beat eggs with sugar and milk until well mixed. Sift in flour "
            "and baking powder; mix thoroughly. Mix in the melted butter until smooth.",
            "4. Pour batter into a well-buttered 11 in / 28 cm tart mould. Swirl about half of the "
            "cinnamon sugar over the batter (keep away from the edges). Arrange a layer of apple "
            "slices on top, pressing gently into the batter.",
            "5. Brush the remaining cinnamon sugar over the apples (again, keep away from the edges "
            "to reduce burning). Bake at 350°F / 180°C for 25–30 minutes; in a non-convection oven, "
            "allow roughly 30% extra time. Check doneness with a skewer.",
        ]
    ),
    "ingredient_sections": [
        (
            "Apples",
            "\n".join(
                [
                    "3 large cooking apples (e.g. Golden Delicious, Granny Smith), peeled, cored, thinly sliced",
                ]
            ),
        ),
        (
            "Batter",
            "\n".join(
                [
                    "2 egg",
                    "100 g white sugar",
                    "180 g all-purpose flour",
                    "60 ml milk",
                    "100 g salted butter, melted",
                    "1.5 tsp baking powder",
                ]
            ),
        ),
        (
            "Cinnamon sugar",
            "\n".join(
                [
                    "150 g white sugar",
                    "2.5 tsp ground cinnamon",
                    "0.125 tsp grated nutmeg",
                    "120 g salted butter, melted",
                    "1 pinch salt",
                ]
            ),
        ),
    ],
    "tags": [
        "dessert",
        "apple",
        "cinnamon",
        "cake",
        "French",
        "baking",
        "Recipe30",
    ],
    "categories": ["Desserts"],
    "servings": 8.0,
    "source_url": "https://recipe30.com/apple-cinnamon-butter-cake.html/",
    "prep_time_min": 25,
    "cook_time_min": 25,
}

CHICKEN_MEATBALLS = {
    "title": "Tarragon Chicken Meatballs",
    "description": (
        "Chicken meatballs with a creamy leek and tarragon sauce. Recipe30 recommends grinding "
        "your own chicken thigh for juicier meatballs and using good chicken stock in the sauce."
    ),
    "directions": "\n".join(
        [
            "1. Preheat oven to 200°C (400°F). Finely chop shallots. Melt butter in a large frying pan "
            "over low–medium heat; add shallots and grated garlic and sweat until translucent; cool.",
            "2. Combine minced chicken, bread crumbs, egg, lemon zest, chopped tarragon, cooled shallot "
            "mixture, about 1½ tsp salt and generous pepper. Mix well. Divide into 8 equal portions "
            "(about 125 g each) and form into balls (optionally rub with a little olive oil).",
            "3. For the sauce, heat an ovenproof frying pan over medium heat. Add oil and the white/light "
            "parts of the leeks; cook about 6 minutes until lightly golden.",
            "4. Add wine; simmer about 2 minutes. Add stock, mustard, cream and tarragon; bring to a simmer "
            "and cook 5–8 minutes.",
            "5. Add meatballs and gently coat with sauce. Transfer the pan to the oven and bake 15–20 minutes "
            "until golden and cooked through. Garnish with tarragon or parsley and serve with the sauce.",
        ]
    ),
    "ingredient_sections": [
        (
            "Meatballs",
            "\n".join(
                [
                    "700 g chicken thighs, minced (or ground chicken)",
                    "2 tbsp butter",
                    "2 shallot, finely chopped",
                    "2 clove garlic, grated",
                    "1 cup bread crumbs",
                    "Finely grated zest of 1 lemon",
                    "1 egg",
                    "1 tbsp fresh tarragon, chopped (use half if dried)",
                    "salt and black pepper",
                ]
            ),
        ),
        (
            "Tarragon sauce",
            "\n".join(
                [
                    "2 tbsp olive oil",
                    "2 leek, trimmed and thinly sliced (white/light green parts)",
                    "1 tbsp fresh tarragon, chopped (use half if dried)",
                    "120 ml dry white wine",
                    "240 ml chicken stock",
                    "4 tsp Dijon mustard",
                    "360 ml heavy cream",
                    "Extra tarragon sprigs or chopped parsley, to garnish",
                ]
            ),
        ),
    ],
    "tags": ["chicken", "meatballs", "tarragon", "cream", "leek", "French", "Recipe30"],
    "categories": ["Chicken", "Dinner"],
    "servings": 4.0,
    "source_url": "https://recipe30.com/tarragon-chicken-meat-balls.html/",
    "prep_time_min": 25,
    "cook_time_min": 20,
}

SPECS: list[dict] = [APPLE_CAKE, CHICKEN_MEATBALLS]


def main() -> None:
    _ensure_sqlite_recipe_graph_columns()
    db = SessionLocal()
    try:
        for spec in SPECS:
            title = spec["title"]
            exists = db.query(RecipeRow).filter(RecipeRow.title == title).first()
            if exists:
                print(f"Skip (already in DB): {title!r}")
                continue
            create_recipe(
                db,
                title=spec["title"],
                directions=spec["directions"],
                ingredients=flatten_ingredient_section_tuples(
                    spec["ingredient_sections"]
                ),
                tags=spec["tags"],
                categories=spec["categories"],
                servings=spec["servings"],
                source_url=spec.get("source_url"),
                description=spec.get("description"),
                prep_time_min=spec.get("prep_time_min"),
                cook_time_min=spec.get("cook_time_min"),
            )
            print(f"Added: {title!r}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
