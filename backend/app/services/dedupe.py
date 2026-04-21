"""
Merge shopping-like rows by normalized name + same display unit.

When units differ but are convertible (same bucket), convert to the first row's unit and sum.
"""

from __future__ import annotations

from typing import Any

from .conversion import convert_quantity, normalize_ingredient_name


def dedupe_items(items: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], int]:
    """
    Returns (merged_rows, number_of_input_rows_eliminated_by_merging).
    """
    if not items:
        return [], 0

    # key: (canonical_name, unit_normalized_for_group) — we group by name first pass
    merged: list[dict[str, Any]] = []
    eliminated = 0

    for raw in items:
        name_key = normalize_ingredient_name(str(raw.get("name", "")))
        qty = raw.get("quantity")
        unit = raw.get("unit")

        placed = False
        for m in merged:
            m_key = normalize_ingredient_name(str(m.get("name", "")))
            if m_key != name_key:
                continue
            if m.get("quantity") is None or qty is None:
                m["quantity"] = None
                placed = True
                eliminated += 1
                break
            if not m.get("unit") or not unit:
                m["quantity"] = None
                placed = True
                eliminated += 1
                break
            try:
                q_conv, _, _ = convert_quantity(
                    float(qty), str(unit), str(m["unit"]), ingredient_name=str(raw.get("name"))
                )
                m["quantity"] = round(float(m["quantity"]) + q_conv, 4)
                placed = True
                eliminated += 1
                break
            except ValueError:
                continue

        if not placed:
            merged.append(
                {
                    "name": raw.get("name"),
                    "quantity": float(qty) if qty is not None else None,
                    "unit": unit,
                    "category": raw.get("category"),
                    "source_recipe_id": raw.get("source_recipe_id"),
                }
            )

    return merged, eliminated
