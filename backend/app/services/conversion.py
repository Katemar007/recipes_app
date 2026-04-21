"""
Ingredient-aware unit conversion (portfolio core).

- Global conversions: mass (g↔kg), volume (ml↔L, tbsp↔ml).
- Optional density path: volume ↔ mass when ingredient + density profile exist.

Extend with `ingredient_density_profiles` from DB (see db/schema.sql).
"""

from __future__ import annotations
import re

# Base SI-ish anchors (grams for mass, ml for volume)
_TO_ML: dict[str, float] = {
    "ml": 1.0,
    "l": 1000.0,
    "liter": 1000.0,
    "tbsp": 14.7868,
    "tablespoon": 14.7868,
    "tsp": 4.92892,
    "teaspoon": 4.92892,
    "cup": 236.588,
    "cups": 236.588,
}

_TO_G: dict[str, float] = {
    "g": 1.0,
    "gram": 1.0,
    "grams": 1.0,
    "kg": 1000.0,
    "kilogram": 1000.0,
    "lb": 453.592,
    "lbs": 453.592,
    "oz": 28.3495,
}

# g per 1 ml for common pantry items (demo — move to DB)
_DENSITY_G_PER_ML: dict[str, float] = {
    "all-purpose flour": 0.53,
    "flour": 0.53,
    "sugar": 0.85,
    "powdered sugar": 0.48,
    "heavy cream": 0.99,
    "milk": 1.03,
    "water": 1.0,
    "oil": 0.92,
    "vegetable oil": 0.92,
}


def _norm_unit(u: str) -> str:
    return u.strip().lower().replace(".", "")


def convert_quantity(
    quantity: float,
    from_unit: str,
    to_unit: str,
    *,
    ingredient_name: str | None = None,
) -> tuple[float, str, str]:
    """
    Returns (new_quantity, to_unit_normalized, method).
    """
    fu = _norm_unit(from_unit)
    tu = _norm_unit(to_unit)
    if fu == tu:
        return quantity, tu, "identity"

    # Mass → mass
    if fu in _TO_G and tu in _TO_G:
        g = quantity * _TO_G[fu]
        return g / _TO_G[tu], tu, "global"

    # Volume → volume
    if fu in _TO_ML and tu in _TO_ML:
        ml = quantity * _TO_ML[fu]
        return ml / _TO_ML[tu], tu, "global"

    # Cross: volume ↔ mass via ingredient density
    ing = (ingredient_name or "").strip().lower()
    density = None
    for key, d in _DENSITY_G_PER_ML.items():
        if key in ing or ing in key:
            density = d
            break

    if density is None:
        raise ValueError(
            f"Cannot convert {from_unit} → {to_unit} without density; "
            f"ingredient='{ingredient_name}'"
        )

    if fu in _TO_ML and tu in _TO_G:
        g = quantity * _TO_ML[fu] * density
        return g / _TO_G[tu], tu, "density"
    if fu in _TO_G and tu in _TO_ML:
        ml = (quantity * _TO_G[fu]) / density
        return ml / _TO_ML[tu], tu, "density"

    raise ValueError(f"Unsupported conversion: {from_unit} → {to_unit}")


def normalize_ingredient_name(name: str) -> str:
    """
    Canonical merge key for dedupe that preserves meaningful descriptors.

    Goals:
    - Preserve characteristics (e.g. "green apple", "large egg", "granny smith")
    - Normalize formatting/case/punctuation differences
    - Lightly normalize common size abbreviations and simple plurals
    """
    raw = name.strip().lower()
    if not raw:
        return ""

    # Keep words/numbers, remove punctuation noise.
    cleaned = re.sub(r"[^a-z0-9\s-]", " ", raw)
    tokens = [t for t in cleaned.replace("-", " ").split() if t]
    if not tokens:
        return ""

    # Normalize frequent size abbreviations so equivalent descriptors merge.
    size_alias = {
        "sm": "small",
        "med": "medium",
        "lg": "large",
        "xl": "extra large",
        "xxl": "extra extra large",
    }

    normalized: list[str] = []
    for t in tokens:
        mapped = size_alias.get(t, t)
        normalized.extend(mapped.split())

    # Very light singularization to merge obvious variants:
    # apples -> apple, eggs -> egg, tomatoes -> tomato
    def singularize(token: str) -> str:
        if len(token) <= 3:
            return token
        if token.endswith("ies") and len(token) > 4:
            return token[:-3] + "y"
        if token.endswith("es") and len(token) > 4:
            return token[:-2]
        if token.endswith("s") and not token.endswith("ss"):
            return token[:-1]
        return token

    normalized = [singularize(t) for t in normalized]
    return " ".join(normalized)
