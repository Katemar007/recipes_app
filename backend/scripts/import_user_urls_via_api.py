#!/usr/bin/env python3
"""
Import a fixed list of recipe URLs into meal_planner.db using the same JSON payloads
as POST /recipes and PUT /recipes/{id} (FastAPI TestClient).

- Skips YouTube.
- Skips pages with no usable JSON-LD Recipe (ingredients + directions).
- POST when source_url is new; PUT when a recipe with the same normalized source_url exists.
- Nutrition (kcal, protein_g, carbs_g, fat_g) is taken from JSON-LD as published (per serving).

Usage (repo root or backend):
  cd backend && source .venv/bin/activate && pip install -r requirements.txt
  python scripts/import_user_urls_via_api.py
"""

from __future__ import annotations

import importlib.util
import sys
import time
from pathlib import Path

from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.main import app  # noqa: E402
from app.recipe_db_service import flatten_ingredient_section_tuples  # noqa: E402

# Load sibling module without package __init__
_NOTION_PATH = Path(__file__).resolve().parent / "import_notion_jsonld.py"
_spec = importlib.util.spec_from_file_location("_notion_jsonld", _NOTION_PATH)
_notion = importlib.util.module_from_spec(_spec)
assert _spec.loader is not None
_spec.loader.exec_module(_notion)

normalize_source_url = _notion.normalize_source_url
fetch_and_parse_recipe = _notion.fetch_and_parse_recipe
save_asset_and_b64 = _notion.save_asset_and_b64


RAW_URLS: list[str] = [
    "https://www.aspicyperspective.com/cocktail-sauce-recipe/",
    "https://cooking.nytimes.com/recipes/1018684-classic-tiramisu",
    "https://www.saveur.com/gallery/six-perfect-sauces-for-crab/",
    "https://www.edimdoma.ru/retsepty/45774-tart-taten-s-yablokami-ili-perevernutyy-pirog",
    "https://1000.menu/cooking/44440-tart-taten-s-yablokami-klassicheskii-francuzskii-pirog",
    "https://pressureluckcooking.com/recipe/instant-pot-beef-stroganoff/",
    "https://www.patee.ru/recipes/baking/view/?id=83242",
    "https://www.foodclub.ru/detail/yablochnyy-shtrudel/",
    "https://www.russianfood.com/recipes/recipe.php?rid=129003",
    "https://lifehacker.ru/kak-prigotovit-syrniki/",
    "https://pokatim.ru/na-obed/46493",
    "https://downshiftology.com/recipes/basil-pesto/",
    "https://povar.ru/recipes/bliny_s_krasnoi_ryboi-9414.html",
    "https://andychef.ru/recipes/tatin/",
    "https://belonika.ru/recipes/88/",
    "https://northwildkitchen.com/creamy-salmon-soup/",
    "https://damndelicious.net/2021/06/17/salmon-with-garlic-cream-sauce/",
    "https://www.edimdoma.ru/retsepty/76344-turetskiy-sup-pyure-iz-krasnoy-chechevitsy-merdzhimek-chorbasy",
    "https://menunedeli.ru/2012/02/koncentrirovannyj-myasnoj-bulon-osnova-dlya-supa/",
    "https://www.edimdoma.ru/retsepty/20971-treska-zapechenaya-pod-ovoschami",
    "https://www.russianfood.com/recipes/recipe.php?rid=165937",
    "https://kartofan.org/kak-prigotovit-baraninu-s-kartoshkoj-v-duxovke.html",
    "https://eda.ru/recepty/sousy-marinady/gribnoj-sous-iz-shampinonov-so-slivkami-53203",
    "https://khakim.livejournal.com/8826.html",
    "https://sitkaseafoodmarket.com/blogs/culinary/recipes/miso-and-soy-glazed-sablefish-black-cod",
]


def _youtube(url: str) -> bool:
    u = url.lower()
    return "youtube.com/" in u or "youtu.be/" in u


def _index_recipes_by_source(client: TestClient) -> dict[str, int]:
    r = client.get("/recipes")
    assert r.status_code == 200, r.text
    data = r.json()
    out: dict[str, int] = {}
    for row in data.get("recipes", []):
        su = row.get("source_url")
        if not su:
            continue
        out[normalize_source_url(su)] = int(row["id"])
    return out


def _payload_from_spec(spec: dict, img_b64: str | None, img_mime: str | None) -> dict:
    ingredients = flatten_ingredient_section_tuples(list(spec["ingredient_sections"]))
    payload: dict = {
        "title": spec["title"],
        "directions": spec["directions"],
        "ingredients": ingredients,
        "tags": spec["tags"],
        "categories": spec["categories"],
        "servings": float(spec["servings"]),
        "source_url": spec["source_url"],
        "description": spec.get("description"),
        "prep_time_min": spec.get("prep_time_min"),
        "cook_time_min": spec.get("cook_time_min"),
    }
    if spec.get("nutrition"):
        payload["nutrition"] = spec["nutrition"]
    if img_b64 and img_mime:
        payload["image_base64"] = img_b64
        payload["image_mime"] = img_mime
    return payload


def main() -> None:
    _notion._ensure_sqlite_recipe_graph_columns()
    _notion.ASSETS_RECIPES.mkdir(parents=True, exist_ok=True)

    seen: set[str] = set()
    urls: list[str] = []
    for u in RAW_URLS:
        n = normalize_source_url(u)
        if n in seen:
            continue
        seen.add(n)
        urls.append(n)

    added = updated = skipped = failed = 0

    with TestClient(app, raise_server_exceptions=True) as client:
        for i, url in enumerate(urls):
            if _youtube(url):
                print(f"[skip] YouTube: {url}")
                skipped += 1
                continue
            if "saveur.com/gallery/" in url:
                print(f"[skip] Saveur gallery (not one recipe page): {url}")
                skipped += 1
                continue

            by_src = _index_recipes_by_source(client)
            existing_id = by_src.get(url)

            print(f"[{i + 1}/{len(urls)}] {url}")
            spec = fetch_and_parse_recipe(url)
            time.sleep(0.45)

            if not spec:
                print("  (no recipe data from URL — skip)")
                failed += 1
                continue

            img_b64, img_mime = save_asset_and_b64(spec["slug"], spec.get("image_url"))
            body = _payload_from_spec(spec, img_b64, img_mime)

            if existing_id is not None:
                r = client.put(f"/recipes/{existing_id}", json=body)
                if r.status_code != 200:
                    print(f"  PUT failed {r.status_code}: {r.text[:500]}")
                    failed += 1
                    continue
                print(f"  PUT ok → id={existing_id} {spec['title']!r}")
                updated += 1
            else:
                r = client.post("/recipes", json=body)
                if r.status_code != 201:
                    print(f"  POST failed {r.status_code}: {r.text[:500]}")
                    failed += 1
                    continue
                rid = r.json().get("id")
                print(f"  POST ok → id={rid} {spec['title']!r}")
                added += 1

    print(f"\nDone. added={added} updated={updated} skipped={skipped} failed={failed}")


if __name__ == "__main__":
    main()
