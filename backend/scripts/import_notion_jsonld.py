#!/usr/bin/env python3
"""
Bulk-import recipes from URLs listed on the public Notion page:
https://dawn-orange-5ae.notion.site/List-of-recipes-333fa1a64ffc8052be02fa08a11bd93a

For each URL: fetch HTML → extract JSON-LD with @type Recipe → create_recipe.
Saves hero images to assets/recipes/ and uploads via the same path as import_external_recipes.py.

Skips: YouTube, Facebook, product pages, editor links, recipe roundups, non-recipe sites,
and URLs that already exist (matched by normalized source_url).

Usage:
  cd backend && source .venv/bin/activate && python scripts/import_notion_jsonld.py
"""

from __future__ import annotations

import base64
import hashlib
import html as html_lib
import json
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
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
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)

# --- URLs from Notion (List of recipes), order preserved; tracking params stripped later.
NOTION_RECIPE_URLS: list[str] = [
    "https://www.gastronom.ru/recipe/13045/ryba-pod-marinadom",
    "https://www.allrecipes.com/recipe/231009/chef-johns-beef-goulash/",
    "https://www.pookspantry.com/how-to-make-langostino-alfredo/",
    "https://www.iamcook.ru/showrecipe/26430",
    "https://swn.ru/cocktails/long_aylend_ays_ti/",
    "https://www.russianfood.com/recipes/recipe.php?rid=145580",
    "https://yummybook.ru/recept/yablochnyj-pirog-perevertysh",
    "https://www.youtube.com/watch?v=Y33iFBt1_PA",
    "https://www.iamcook.ru/showrecipe/8050",
    "https://tunnel.ru/post-forshmak",
    "https://cooking.nytimes.com/recipes/1020317-grilled-swordfish-with-smoky-tomato-anchovy-salsa",
    "https://andychef.ru/recipes/malibu/",
    "https://www.foodnetwork.com/recipes/food-network-kitchen/strawberries-and-wine-flower-cheesecake-5521801",
    "https://tastesbetterfromscratch.com/homemade-eggnog/",
    "https://www.food.com/recipe/grilled-japanese-swordfish-30380",
    "https://www.jerseygirlcooks.com/pan-roasted-swordfish-cherry-tomatoes-capers/",
    "https://japan.recipetineats.com/swordfish-in-vinaigrette/",
    "https://japan.recipetineats.com/nobus-miso-marinated-black-cod-recipe/",
    "https://japan.recipetineats.com/crab-and-cucumber-salad-with-sweet-vinegar-dressing-amazu/",
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
    "https://www.hirokoliston.com/kombu-carrot-shiitake-nimono/",
    "https://www.allrecipes.com/recipe/74037/lamb-chops-with-balsamic-reduction/",
    "https://1000.menu/cooking/3015-kotletj-iz-treski",
    "https://www.edimdoma.ru/retsepty/73765-bef-burginon-b-uf-bourguignon",
    "https://www.saltandlavender.com/creamy-spinach-pasta/",
    "https://www.allrecipes.com/recipe/149687/thai-chicken-spring-rolls/",
    "https://realhousemoms.com/chicken-spring-rolls/",
    "https://www.iamcook.ru/showrecipe/2096",
    "https://eda.ru/recepty/osnovnye-blyuda/dolma-s-baraninoj-48233",
    "https://takismadgreek.com/",
    "https://www.facebook.com/",
    "https://www.youtube.com/watch?v=QRJjlDE_Nx8",
    "https://123moviesfree-ma.123caches.re/watch-series/the-boys-season-4-full-episodes-online-free/123movies-ypw0ra36l-ypqj7al",
    "https://www.amazon.com/kindle-dbs/hz/subscribe/ku",
    "https://www.177milkstreet.com/recipes/turkish-eggplant-peppers-tomatoes-garlicky-yogurt",
    "https://www.russianfood.com/recipes/recipe.php?rid=124520",
    "https://www.themediterraneandish.com/baked-cod-recipe-lemon-garlic/",
    "https://www.savorynothings.com/mediterranean-baked-cod/",
    "https://tasty.co/recipe/french-style-apple-tart-tarte-tatin",
    "https://www.browneyedbaker.com/apple-cinnamon-raisin-walnut-baked-oatmeal/",
    "https://tastesbetterfromscratch.com/spinach-and-bacon-quiche/",
    "https://lilluna.com/bacon-and-cheese-quiche/",
    "https://www.allrecipes.com/recipe/216724/spinach-and-bacon-quiche/",
    "https://lifehacker.ru/tykva-v-duxovke-recepty/",
    "https://picsart.com/create/editor",
    "https://www.finewineandgoodspirits.com/old-kakheti-qvevri-saperavi-georgia-2020/product/000087799",
    "https://www.youtube.com/watch?v=m0oVyyqvOKY",
    "https://www.youtube.com/watch?v=pg-rt-xgpVs",
    "https://onolicioushawaii.com/edamame-rice/",
    "https://cookscrafter.com/miso-cod-sides/",
    "https://www.foodnetwork.com/recipes/asian-cucumber-salad-2268988",
    "https://www.food.com/recipe/grilled-soy-sesame-asparagus-275094",
    "https://yummyaddiction.com/chicken-rice-paper-rolls/",
]

SKIP_URL_PREFIXES = (
    "https://www.youtube.com/",
    "https://youtube.com/",
    "https://youtu.be/",
    "https://www.facebook.com/",
    "https://facebook.com/",
    "https://123movies",
    "https://www.amazon.com/kindle",
    "https://picsart.com/",
    "https://www.finewineandgoodspirits.com/",
    "https://takismadgreek.com/",
    "https://cookscrafter.com/",
)

SKIP_URLS_EXACT = {
    "https://lifehacker.ru/kak-prigotovit-syrniki/",
    "https://lifehacker.ru/tykva-v-duxovke-recepty/",
    "https://www.saveur.com/gallery/six-perfect-sauces-for-crab/",
}


def normalize_source_url(url: str) -> str:
    url = html_lib.unescape(url.strip())
    parsed = urllib.parse.urlparse(url)
    # Drop common tracking query params
    q = urllib.parse.parse_qsl(parsed.query, keep_blank_values=True)
    q = [(k, v) for k, v in q if k.lower() not in ("fbclid", "soc", "utm_source", "utm_medium", "utm_campaign")]
    query = urllib.parse.urlencode(q)
    return urllib.parse.urlunparse(
        (parsed.scheme, parsed.netloc.lower(), parsed.path, parsed.params, query, "")
    )


def should_skip_url(url: str) -> str | None:
    n = normalize_source_url(url)
    if n in SKIP_URLS_EXACT:
        return "skip list (roundup / gallery / non-recipe)"
    for p in SKIP_URL_PREFIXES:
        if n.startswith(p):
            return f"skip prefix {p!r}"
    return None


def download_bytes(url: str, timeout: int = 40) -> bytes:
    url = html_lib.unescape(url)
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "en-US,en;q=0.9,ru;q=0.8"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def _strip_tags(s: str) -> str:
    t = html_lib.unescape(s)
    t = re.sub(r"<[^>]+>", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def _is_recipe_type(t) -> bool:
    if t == "Recipe":
        return True
    if isinstance(t, list):
        return "Recipe" in t
    return False


def _iter_json_ld_recipes(obj) -> list[dict]:
    found: list[dict] = []

    def walk(o):
        if isinstance(o, dict):
            if _is_recipe_type(o.get("@type")):
                found.append(o)
            for v in o.values():
                walk(v)
        elif isinstance(o, list):
            for x in o:
                walk(x)

    walk(obj)
    return found


def extract_ld_json_blocks(html: str) -> list[dict]:
    blocks: list[dict] = []
    for m in re.finditer(
        r'<script[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
        html,
        re.DOTALL | re.IGNORECASE,
    ):
        raw = m.group(1).strip()
        if not raw:
            continue
        try:
            blocks.append(json.loads(raw))
        except json.JSONDecodeError:
            # Some sites concatenate two JSON objects; try first object only
            end = raw.find("}{")
            if end != -1:
                try:
                    blocks.append(json.loads(raw[: end + 1]))
                except json.JSONDecodeError:
                    pass
    return blocks


def iso8601_duration_to_min(s: str | None) -> int | None:
    if not s or not isinstance(s, str) or not s.startswith("P"):
        return None
    total = 0
    if (m := re.search(r"(\d+)H", s)):
        total += int(m.group(1)) * 60
    if (m := re.search(r"(\d+)M", s)):
        total += int(m.group(1))
    if total == 0 and (m := re.search(r"(\d+)S", s)):
        total = max(1, int(m.group(1)) // 60)
    return total if total else None


def parse_yield(y) -> float | None:
    if y is None:
        return None
    if isinstance(y, (int, float)):
        return float(y)
    if isinstance(y, list):
        for item in y:
            v = parse_yield(item)
            if v:
                return v
        return None
    s = str(y)
    m = re.search(r"(\d+(?:\.\d+)?)", s)
    return float(m.group(1)) if m else None


def flatten_instructions(rec: dict) -> str | None:
    ri = rec.get("recipeInstructions")
    if ri is None:
        return None
    if isinstance(ri, str):
        return _strip_tags(ri)

    lines: list[str] = []

    def from_howto(d: dict, depth: int = 0):
        if _is_recipe_type(d.get("@type")):
            return
        elems = d.get("step") or d.get("itemListElement")
        if isinstance(elems, list):
            for el in elems:
                if isinstance(el, dict):
                    if el.get("@type") == "HowToStep" or "text" in el:
                        tx = el.get("text")
                        if isinstance(tx, str):
                            lines.append(_strip_tags(tx))
                        elif isinstance(tx, list):
                            for t in tx:
                                if isinstance(t, str):
                                    lines.append(_strip_tags(t))
                    from_howto(el, depth + 1)
        elif isinstance(elems, dict):
            from_howto(elems, depth)

    if isinstance(ri, list):
        for step in ri:
            if isinstance(step, str):
                lines.append(_strip_tags(step))
            elif isinstance(step, dict):
                if step.get("@type") == "HowToStep" or "text" in step:
                    tx = step.get("text") or step.get("name")
                    if isinstance(tx, str):
                        lines.append(_strip_tags(tx))
                elif step.get("@type") == "HowToSection":
                    from_howto(step)
                else:
                    tx = step.get("text")
                    if isinstance(tx, str):
                        lines.append(_strip_tags(tx))
    elif isinstance(ri, dict):
        if ri.get("@type") in ("HowTo", "HowToSection", "ItemList"):
            from_howto(ri)
        else:
            tx = ri.get("text")
            if isinstance(tx, str):
                lines.append(_strip_tags(tx))

    if not lines:
        return None
    return "\n".join(f"{i}. {t}" for i, t in enumerate(lines, 1))


def ingredients_to_text(rec: dict) -> str | None:
    ing = rec.get("recipeIngredient")
    if not ing:
        return None
    if isinstance(ing, str):
        return ing.strip()
    if isinstance(ing, list):
        parts = []
        for x in ing:
            if isinstance(x, str):
                parts.append(x.strip())
            elif isinstance(x, dict):
                parts.append(str(x.get("name") or x).strip())
        return "\n".join(p for p in parts if p) if parts else None
    return None


def pick_image_url(rec: dict) -> str | None:
    img = rec.get("image")
    if not img:
        return None
    if isinstance(img, str):
        return img if img.startswith("http") else None
    if isinstance(img, list):
        for x in img:
            u = pick_image_url({"image": x})
            if u:
                return u
        return None
    if isinstance(img, dict):
        return img.get("url") or img.get("contentUrl")
    return None


def nutrition_from_recipe(rec: dict) -> dict | None:
    n = rec.get("nutrition")
    if not isinstance(n, dict):
        return None

    def num_from(val) -> float | None:
        if val is None:
            return None
        if isinstance(val, (int, float)):
            return float(val)
        s = str(val).replace(",", ".")
        m = re.search(r"(\d+(?:\.\d+)?)", s)
        return float(m.group(1)) if m else None

    out = {}
    cal = n.get("calories")
    kcal = num_from(cal)
    if kcal is not None:
        out["kcal"] = kcal
    for key, out_key in (
        ("proteinContent", "protein_g"),
        ("carbohydrateContent", "carbs_g"),
        ("fatContent", "fat_g"),
    ):
        v = num_from(n.get(key))
        if v is not None:
            out[out_key] = v
    return out if out else None


def recipe_to_spec(rec: dict, source_url: str, slug_base: str) -> dict | None:
    title = rec.get("name") or rec.get("headline")
    if not title or not isinstance(title, str):
        return None
    title = _strip_tags(title)
    ing_text = ingredients_to_text(rec)
    if not ing_text:
        return None
    directions = flatten_instructions(rec) or rec.get("description")
    if directions:
        directions = _strip_tags(directions) if not directions.startswith("1.") else directions
    if not directions:
        return None

    prep = iso8601_duration_to_min(rec.get("prepTime"))
    cook = iso8601_duration_to_min(rec.get("cookTime"))
    total = iso8601_duration_to_min(rec.get("totalTime"))
    if total and not cook and prep:
        cook = max(0, total - prep)
    elif total and not cook and not prep:
        cook = total

    servings = parse_yield(rec.get("recipeYield")) or 4.0

    cats = rec.get("recipeCategory")
    categories: list[str] = []
    if isinstance(cats, str) and cats.strip():
        categories = [cats.strip()]
    elif isinstance(cats, list):
        categories = [str(c).strip() for c in cats if str(c).strip()]

    kw = rec.get("keywords")
    tags: list[str] = []
    if isinstance(kw, str):
        tags = [k.strip() for k in re.split(r"[,;]", kw) if k.strip()][:20]
    elif isinstance(kw, list):
        tags = [str(k).strip() for k in kw if str(k).strip()][:20]

    desc = rec.get("description")
    description = _strip_tags(desc)[:1200] if isinstance(desc, str) else None

    nutrition = nutrition_from_recipe(rec)
    image_url = pick_image_url(rec)

    # Prefer human-readable image names from recipe title when possible.
    title_ascii = (
        unicodedata.normalize("NFKD", title)
        .encode("ascii", "ignore")
        .decode("ascii")
    )
    title_slug = re.sub(r"[^a-z0-9]+", "-", title_ascii.lower()).strip("-")[:60]
    base_slug = re.sub(r"[^a-z0-9]+", "-", slug_base.lower()).strip("-")[:50]
    slug = title_slug or base_slug
    if not slug:
        slug = hashlib.sha256(source_url.encode()).hexdigest()[:14]

    return {
        "slug": slug,
        "title": title[:200],
        "source_url": source_url,
        "description": description,
        "ingredient_sections": [("Ingredients", ing_text)],
        "directions": directions[:15000],
        "tags": tags or ["imported"],
        "categories": categories or [],
        "servings": float(servings),
        "prep_time_min": prep,
        "cook_time_min": cook,
        "nutrition": nutrition,
        "image_url": image_url,
    }


def _ext_for_mime(mime: str) -> str:
    m = mime.lower()
    if "jpeg" in m or m.endswith("/jpg"):
        return ".jpg"
    if "png" in m:
        return ".png"
    if "webp" in m:
        return ".webp"
    return ".jpg"


def save_asset_and_b64(slug: str, image_url: str | None) -> tuple[str | None, str | None]:
    if not image_url or not image_url.startswith("http"):
        return None, None
    try:
        data = download_bytes(image_url, timeout=35)
    except (urllib.error.URLError, TimeoutError, OSError, ValueError) as e:
        print(f"    (image skip: {e})")
        return None, None
    ASSETS_RECIPES.mkdir(parents=True, exist_ok=True)
    # Guess ext from URL path
    path = urllib.parse.urlparse(image_url).path.lower()
    if path.endswith(".png"):
        ext, mime = ".png", "image/png"
    elif path.endswith(".webp"):
        ext, mime = ".webp", "image/webp"
    else:
        ext, mime = ".jpg", "image/jpeg"
    out = ASSETS_RECIPES / f"{slug}{ext}"
    if out.exists():
        suffix = hashlib.md5(image_url.encode()).hexdigest()[:6]
        out = ASSETS_RECIPES / f"{slug}-{suffix}{ext}"
    out.write_bytes(data)
    print(f"    image → assets/recipes/{out.name}")
    b64 = base64.standard_b64encode(data).decode("ascii")
    return b64, mime


def _decode_page_html(raw: bytes) -> str:
    try:
        return raw.decode("utf-8")
    except UnicodeDecodeError:
        try:
            return raw.decode("cp1251")
        except UnicodeDecodeError:
            return raw.decode("utf-8", errors="replace")


def _slug_base_for_url(norm_url: str) -> str:
    parsed = urllib.parse.urlparse(norm_url)
    q = urllib.parse.parse_qs(parsed.query)
    path_last = (parsed.path.rstrip("/").split("/")[-1] or "").lower()
    if "rid" in q:
        return f"russianfood-{q['rid'][0]}"
    if "id" in q and "patee" in parsed.netloc:
        return f"patee-{q['id'][0]}"
    if path_last in ("", "recipe.php", "index.html") or path_last.endswith(".php"):
        return hashlib.md5(norm_url.encode()).hexdigest()[:14]
    return (path_last or "recipe")[:40]


def _download_page_bytes(norm_url: str) -> bytes | None:
    try:
        return download_bytes(norm_url, timeout=40)
    except urllib.error.HTTPError as e:
        if e.code == 403 and "foodnetwork.com" in norm_url.lower():
            wb = f"https://web.archive.org/web/20231215120000/{norm_url}"
            try:
                return download_bytes(wb, timeout=65)
            except (urllib.error.URLError, TimeoutError, OSError, urllib.error.HTTPError) as e2:
                print(f"  fetch error: {e} (wayback: {e2})")
                return None
        print(f"  fetch error: {e}")
        return None
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        print(f"  fetch error: {e}")
        return None


def _iamcook_merge_recipe_fields(rec: dict, html: str) -> None:
    if "iamcook.ru" not in html.lower() or "class=\"ilist\"" not in html:
        return
    if rec.get("recipeIngredient"):
        return
    m = re.search(r'class="ilist"[^>]*>(.*?)<ul class="ilparams"', html, re.S | re.I)
    if not m:
        return
    lines: list[str] = []
    for p in re.findall(r"<p>(.*?)</p>", m.group(1), re.S | re.I):
        t = _strip_tags(p).strip()
        if t:
            lines.append(t)
    if lines:
        rec["recipeIngredient"] = lines

    m2 = re.search(
        r'class="instructions"[^>]*>(.*?)<!-- Ответы на комментарий -->',
        html,
        re.S | re.I,
    )
    if not m2:
        return
    steps: list[str] = []
    for p in re.findall(r"<p[^>]*>(.*?)</p>", m2.group(1), re.S | re.I):
        if re.search(r"<img\b", p, re.I):
            continue
        t = _strip_tags(p).strip()
        if len(t) > 25:
            steps.append(t)
    if steps:
        rec["recipeInstructions"] = "\n".join(f"{i}. {t}" for i, t in enumerate(steps, 1))


def _russianfood_from_html(html: str, norm_url: str, slug_base: str) -> dict | None:
    if "russianfood.com" not in norm_url.lower():
        return None
    m = re.search(r'<h1 class="title[^"]*"[^>]*>([^<]+)</h1>', html)
    title = _strip_tags(m.group(1)).strip() if m else ""
    if not title:
        return None
    ings: list[str] = []
    for sm in re.finditer(
        r'<tr class="ingr_tr_[^"]*"[^>]*>.*?<span class=""[^>]*>([^<]+)</span>',
        html,
        re.S,
    ):
        line = _strip_tags(sm.group(1)).strip()
        if line:
            ings.append(line)
    if not ings:
        return None
    steps: list[str] = []
    for sm in re.finditer(r'<div class="step_n"[^>]*>.*?<p>([^<]+)</p>', html, re.S):
        st = _strip_tags(sm.group(1)).strip()
        if st:
            steps.append(st)
    if not steps:
        return None
    directions = "\n".join(f"{i}. {t}" for i, t in enumerate(steps, 1))
    desc_m = re.search(
        r'<div id="ib_s_e_2"[^>]*></div><div><p>([^<]{10,2000})</p></div>',
        html,
        re.S,
    )
    description = _strip_tags(desc_m.group(1)).strip()[:1200] if desc_m else None
    img_m = re.search(r'data-image=\'(https?://[^\'"]+)', html)
    image_url = img_m.group(1) if img_m else None
    if not image_url:
        im2 = re.search(
            r'<img[^>]+src="(//www\.russianfood\.com/dycontent/images_upl/[^"]+)"',
            html,
            re.I,
        )
        if im2:
            image_url = "https:" + im2.group(1) if im2.group(1).startswith("//") else im2.group(1)
    time_m = re.search(
        r'<span class="hl"><b>(\d+)</b>\s*мин</span>',
        html,
        re.I,
    )
    prep = int(time_m.group(1)) if time_m else None
    return {
        "slug": slug_base,
        "title": title[:200],
        "source_url": norm_url,
        "description": description,
        "ingredient_sections": [("Ingredients", "\n".join(ings))],
        "directions": directions[:15000],
        "tags": ["imported", "RussianFood"],
        "categories": [],
        "servings": 6.0,
        "prep_time_min": prep,
        "cook_time_min": None,
        "nutrition": None,
        "image_url": image_url,
    }


def _tunnel_from_html(html: str, norm_url: str, slug_base: str) -> dict | None:
    if "tunnel.ru" not in norm_url.lower() or "/post-" not in norm_url:
        return None
    m = re.search(
        r'block-post-list__body">\s*<div[^>]*>\s*<h2>([^<]{3,200})</h2>',
        html,
        re.I | re.S,
    )
    title = _strip_tags(m.group(1)).strip() if m else "Форшмак"
    names = re.findall(r'<div class="ingredient_name">([^<]+)</div>', html)
    vols = re.findall(r'<div class="ingredient_volume">([^<]*)</div>', html)
    if not names:
        return None
    ings: list[str] = []
    for i, name in enumerate(names):
        v = vols[i].strip() if i < len(vols) else ""
        name = _strip_tags(name).strip()
        ings.append(f"{name} — {v}" if v else name)
    text_m = re.search(r'class="block-post-list__text"[^>]*>(.*)', html, re.S | re.I)
    if not text_m:
        return None
    body = text_m.group(1)
    cut = re.search(r"<h1>А теперь поговорим", body, re.I)
    if cut:
        body = body[: cut.start()]
    steps: list[str] = []
    for p in re.findall(r"<p[^>]*>(.*?)</p>", body, re.S | re.I):
        if re.search(r"<img\b", p, re.I):
            continue
        t = _strip_tags(p).strip()
        if len(t) < 30:
            continue
        if "Приготовление" in t and len(t) < 90:
            continue
        steps.append(t)
    if not steps:
        return None
    directions = "\n".join(f"{i}. {t}" for i, t in enumerate(steps[:18], 1))
    img_m = re.search(r'href="(https://static\.tunnel\.ru/+media/images/[^"]+\.jpg)"', html)
    image_url = img_m.group(1).replace("https://static.tunnel.ru//", "https://static.tunnel.ru/") if img_m else None
    time_m = re.search(
        r'<span>(\d+)\s*минут',
        html,
        re.I,
    )
    prep = int(time_m.group(1)) if time_m else None
    return {
        "slug": slug_base,
        "title": title[:200],
        "source_url": norm_url,
        "description": "Классический одесский форшмак из сельди (tunnel.ru).",
        "ingredient_sections": [("Ingredients", "\n".join(ings))],
        "directions": directions[:15000],
        "tags": ["imported", "herring", "appetizer", "tunnel.ru"],
        "categories": ["Seafood"],
        "servings": 8.0,
        "prep_time_min": prep,
        "cook_time_min": None,
        "nutrition": None,
        "image_url": image_url,
    }


def _manual_recipe_specs() -> dict[str, dict]:
    """Sites that block bots or have no machine-readable recipe."""

    def n(u: str) -> str:
        return normalize_source_url(u)

    li = n("https://swn.ru/cocktails/long_aylend_ays_ti/")
    malibu = n("https://andychef.ru/recipes/malibu/")
    return {
        li: {
            "slug": "long-island-iced-tea-swn",
            "title": "Long Island Iced Tea (Лонг-Айленд айс ти)",
            "source_url": li,
            "description": (
                "Классический коктейль на основе нескольких крепких спиртов и колы; "
                "текст собран вручную (swn.ru отдаёт антибот-страницу без рецепта в HTML)."
            ),
            "ingredient_sections": [
                (
                    "Ingredients",
                    "\n".join(
                        [
                            "15 мл водки",
                            "15 мл джина",
                            "15 мл белого рома",
                            "15 мл текилы серебряной",
                            "15 мл ликёра Triple Sec (Cointreau)",
                            "25 мл лимонного сока",
                            "90–120 мл колы",
                            "Лёд",
                            "Лимон для украшения (по желанию)",
                        ]
                    ),
                )
            ],
            "directions": "\n".join(
                [
                    "1. Наполнить хайбол или коллинз стакан льдом.",
                    "2. Влить водку, джин, ром, текилу, Triple Sec и лимонный сок.",
                    "3. Аккуратно долить колу, слегка размешать барной ложкой.",
                    "4. Украсить долькой лимона и подавать с трубочкой.",
                ]
            ),
            "tags": ["cocktail", "long island", "swn.ru"],
            "categories": ["Drinks"],
            "servings": 1.0,
            "prep_time_min": 5,
            "cook_time_min": None,
            "nutrition": None,
            "image_url": None,
        },
        malibu: {
            "slug": "malibu-cocktail-andychef",
            "title": "Коктейль «Малибу»",
            "source_url": malibu,
            "description": (
                "Кокосовый ром Malibu с ананасовым соком; краткий рецепт "
                "(andychef.ru сейчас отдаёт пустую/защищённую страницу для автозагрузки)."
            ),
            "ingredient_sections": [
                (
                    "Ingredients",
                    "\n".join(
                        [
                            "50 мл кокосового рома Malibu",
                            "150 мл ананасового сока",
                            "Лёд",
                            "Долька ананаса или лайма для украшения (по желанию)",
                        ]
                    ),
                )
            ],
            "directions": "\n".join(
                [
                    "1. Наполнить стакан льдом.",
                    "2. Влить Malibu, затем ананасовый сок.",
                    "3. Слегка перемешать; при желании украсить.",
                ]
            ),
            "tags": ["cocktail", "Malibu", "andychef"],
            "categories": ["Drinks"],
            "servings": 1.0,
            "prep_time_min": 3,
            "cook_time_min": None,
            "nutrition": None,
            "image_url": None,
        },
    }


def fetch_and_parse_recipe(page_url: str) -> dict | None:
    norm = normalize_source_url(page_url)
    manual = _manual_recipe_specs().get(norm)
    if manual:
        return dict(manual)

    raw = _download_page_bytes(norm)
    if raw is None:
        return None
    html = _decode_page_html(raw)

    recipes: list[dict] = []
    for block in extract_ld_json_blocks(html):
        recipes.extend(_iter_json_ld_recipes(block))

    slug_base = _slug_base_for_url(norm)

    if recipes:
        recipes.sort(key=lambda r: len(ingredients_to_text(r) or ""), reverse=True)
        rec = dict(recipes[0])
        if "iamcook.ru" in norm.lower():
            _iamcook_merge_recipe_fields(rec, html)
        spec = recipe_to_spec(rec, norm, slug_base)
        if spec:
            return spec

    if "russianfood.com" in norm.lower():
        spec = _russianfood_from_html(html, norm, slug_base)
        if spec:
            return spec
    if "tunnel.ru" in norm.lower():
        spec = _tunnel_from_html(html, norm, slug_base)
        if spec:
            return spec
    return None


def main() -> None:
    _ensure_sqlite_recipe_graph_columns()
    ASSETS_RECIPES.mkdir(parents=True, exist_ok=True)

    seen: set[str] = set()
    urls = []
    for u in NOTION_RECIPE_URLS:
        n = normalize_source_url(u)
        if n in seen:
            continue
        seen.add(n)
        urls.append(n)

    db = SessionLocal()
    added = 0
    skipped = 0
    failed = 0
    try:
        for i, url in enumerate(urls):
            reason = should_skip_url(url)
            if reason:
                print(f"[skip] {url[:70]}… — {reason}")
                skipped += 1
                continue

            if db.query(RecipeRow).filter(RecipeRow.source_url == url).first():
                print(f"[exists] {url[:75]}")
                skipped += 1
                continue

            print(f"[{i+1}/{len(urls)}] {url}")
            spec = fetch_and_parse_recipe(url)
            time.sleep(0.4)

            if not spec:
                print("  no JSON-LD Recipe (or empty ingredients)")
                failed += 1
                continue

            img_b64, img_mime = save_asset_and_b64(spec["slug"], spec.get("image_url"))
            try:
                create_recipe(
                    db,
                    title=spec["title"],
                    directions=spec["directions"],
                    ingredients=flatten_ingredient_section_tuples(
                        spec["ingredient_sections"]
                    ),
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
            except ValueError as e:
                print(f"  create_recipe error: {e}")
                failed += 1
                continue
            print(f"  + {spec['title']!r}")
            added += 1
    finally:
        db.close()

    print(f"\nDone. added={added} skipped={skipped} failed={failed}")


if __name__ == "__main__":
    main()
