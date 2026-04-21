from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from .db_models import ShoppingListItemRow, ShoppingListRow

DEMO_USER = "demo-user"


def _item_to_dict(row: ShoppingListItemRow) -> dict[str, Any]:
    return {
        "id": row.id,
        "shopping_list_id": row.shopping_list_id,
        "name": row.name,
        "quantity": row.quantity,
        "unit": row.unit,
        "category": row.category,
        "checked": row.checked,
        "source_recipe_id": row.source_recipe_id,
        "source_ingredient_id": row.source_ingredient_id,
        "source_recipe_title": row.source_recipe_title,
        "is_manual": row.is_manual,
        "position": row.position,
    }


def _list_to_dict(row: ShoppingListRow) -> dict[str, Any]:
    return {
        "id": row.id,
        "user_id": row.user_id,
        "name": row.name,
        "status": row.status,
        "saved_at": row.saved_at,
        "list_date": row.list_date,
        "created_at": row.created_at,
    }


def get_shopping_state(db: Session, user_id: str = DEMO_USER) -> dict[str, Any]:
    from datetime import datetime, timezone

    lists = (
        db.query(ShoppingListRow)
        .filter(ShoppingListRow.user_id == user_id)
        .all()
    )
    active_row = next((L for L in lists if L.status == "active"), None)
    saved_rows = [L for L in lists if L.status == "saved"]

    saved_snapshots = [
        {
            "list": _list_to_dict(L),
            "items": [
                _item_to_dict(i) for i in sorted(L.items, key=lambda x: x.position)
            ],
        }
        for L in sorted(saved_rows, key=lambda x: x.saved_at or "", reverse=True)
    ]

    if not active_row:
        now_iso = datetime.now(timezone.utc).isoformat()
        return {
            "active_list": {
                "id": "sl-active",
                "user_id": user_id,
                "name": "This week",
                "status": "active",
                "saved_at": None,
                "list_date": None,
                "created_at": now_iso,
            },
            "items": [],
            "saved_snapshots": saved_snapshots,
        }

    active_items = sorted(active_row.items, key=lambda i: i.position)
    return {
        "active_list": _list_to_dict(active_row),
        "items": [_item_to_dict(i) for i in active_items],
        "saved_snapshots": saved_snapshots,
    }


def replace_shopping_state(
    db: Session,
    payload: dict[str, Any],
    user_id: str = DEMO_USER,
) -> dict[str, Any]:
    active_list = payload.get("active_list") or {}
    items_raw = payload.get("items") or []
    snapshots_raw = payload.get("saved_snapshots") or []

    for L in (
        db.query(ShoppingListRow)
        .filter(ShoppingListRow.user_id == user_id)
        .all()
    ):
        db.delete(L)
    db.commit()

    def add_list_and_items(list_data: dict[str, Any], item_rows: list[dict[str, Any]]):
        lid = list_data["id"]
        sl = ShoppingListRow(
            id=lid,
            user_id=user_id,
            name=list_data.get("name"),
            status=list_data["status"],
            saved_at=list_data.get("saved_at"),
            list_date=list_data.get("list_date"),
            created_at=list_data["created_at"],
        )
        db.add(sl)
        for it in item_rows:
            db.add(
                ShoppingListItemRow(
                    id=it["id"],
                    shopping_list_id=lid,
                    name=it["name"],
                    quantity=it.get("quantity"),
                    unit=it.get("unit"),
                    category=it.get("category"),
                    checked=bool(it.get("checked", False)),
                    source_recipe_id=it.get("source_recipe_id"),
                    source_ingredient_id=it.get("source_ingredient_id"),
                    source_recipe_title=it.get("source_recipe_title"),
                    is_manual=bool(it.get("is_manual", False)),
                    position=int(it.get("position", 0)),
                )
            )

    add_list_and_items(active_list, items_raw)
    for snap in snapshots_raw:
        lst = snap.get("list") or {}
        its = snap.get("items") or []
        add_list_and_items(lst, its)

    db.commit()
    return get_shopping_state(db, user_id)
