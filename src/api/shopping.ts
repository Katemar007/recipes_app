import { apiFetch } from "./client";
import type {
  WireShoppingItem,
  WireShoppingList,
  WireShoppingSnapshot,
  WireShoppingState,
} from "./wire";
import type { ShoppingList, ShoppingListItem } from "@/types";

export type ApiShoppingList = WireShoppingList;
export type ApiShoppingItem = WireShoppingItem;
export type ApiShoppingSnapshot = WireShoppingSnapshot;
export type ApiShoppingState = WireShoppingState;

function mapList(raw: WireShoppingList): ShoppingList {
  return {
    id: raw.id,
    userId: raw.user_id,
    name: raw.name,
    status: raw.status,
    savedAt: raw.saved_at,
    listDate: raw.list_date,
    createdAt: raw.created_at,
  };
}

function mapItem(raw: WireShoppingItem): ShoppingListItem {
  return {
    id: raw.id,
    shoppingListId: raw.shopping_list_id,
    name: raw.name,
    quantity: raw.quantity,
    unit: raw.unit,
    category: raw.category,
    checked: raw.checked,
    sourceRecipeId: raw.source_recipe_id,
    sourceIngredientId: raw.source_ingredient_id ?? undefined,
    sourceRecipeTitle: raw.source_recipe_title ?? undefined,
    isManual: raw.is_manual,
    position: raw.position,
  };
}

export function mapApiShoppingState(res: WireShoppingState): {
  activeList: ShoppingList;
  items: ShoppingListItem[];
  savedSnapshots: { list: ShoppingList; items: ShoppingListItem[] }[];
} {
  return {
    activeList: mapList(res.active_list),
    items: res.items.map(mapItem),
    savedSnapshots: (res.saved_snapshots ?? []).map((snap) => ({
      list: mapList(snap.list),
      items: snap.items.map(mapItem),
    })),
  };
}

function listToApi(l: ShoppingList): WireShoppingList {
  return {
    id: l.id,
    user_id: l.userId,
    name: l.name,
    status: l.status,
    saved_at: l.savedAt,
    list_date: l.listDate,
    created_at: l.createdAt,
  };
}

function itemToApi(i: ShoppingListItem): WireShoppingItem {
  return {
    id: i.id,
    shopping_list_id: i.shoppingListId,
    name: i.name,
    quantity: i.quantity,
    unit: i.unit,
    category: i.category,
    checked: i.checked,
    source_recipe_id: i.sourceRecipeId,
    source_ingredient_id: i.sourceIngredientId ?? null,
    source_recipe_title: i.sourceRecipeTitle ?? null,
    is_manual: i.isManual,
    position: i.position,
  };
}

export function buildShoppingStatePayload(state: {
  activeList: ShoppingList;
  items: ShoppingListItem[];
  savedSnapshots: { list: ShoppingList; items: ShoppingListItem[] }[];
}): WireShoppingState {
  return {
    active_list: listToApi(state.activeList),
    items: state.items.map(itemToApi),
    saved_snapshots: state.savedSnapshots.map((s) => ({
      list: listToApi(s.list),
      items: s.items.map(itemToApi),
    })),
  };
}

export async function fetchShoppingStateFromApi(): Promise<WireShoppingState> {
  return apiFetch<WireShoppingState>("/shopping-lists/state");
}

export async function putShoppingStateToApi(
  payload: WireShoppingState
): Promise<WireShoppingState> {
  return apiFetch<WireShoppingState>("/shopping-lists/state", {
    method: "PUT",
    json: payload,
  });
}
