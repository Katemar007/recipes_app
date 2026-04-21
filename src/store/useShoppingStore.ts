import { create } from "zustand";
import { buildShoppingStatePayload, getErrorMessage, putShoppingStateToApi } from "@/api";
import { parseIngredientLine } from "@/lib/ingredientLine";
import { parseLocalISODate } from "../lib/dateLocal";
import type { ShoppingList, ShoppingListItem } from "../types";

type SavedSnapshot = {
  list: ShoppingList;
  items: ShoppingListItem[];
};

type HydratedShopping = {
  activeList: ShoppingList;
  items: ShoppingListItem[];
  savedSnapshots: SavedSnapshot[];
};

type ShoppingState = {
  activeList: ShoppingList;
  items: ShoppingListItem[];
  savedSnapshots: SavedSnapshot[];
  syncError: string | null;
  clearSyncError: () => void;
  hydrateFromApi: (data: HydratedShopping) => void;
  toggleChecked: (itemId: string) => void;
  removeItem: (itemId: string) => void;
  clearActiveItems: () => void;
  addManualItem: (name: string) => void;
  repeatList: (savedListId: string) => void;
  saveActiveList: (payload: { name: string; listDate: string }) => void;
  addRecipeIngredients: (
    recipeId: number,
    recipeTitle: string,
    ingredientLines: string[]
  ) => { added: number; skipped: number };
  addRecipeIngredient: (
    recipeId: number,
    recipeTitle: string,
    line: string
  ) => { added: boolean };
  replaceActiveItemsFromDedupe: (
    lines: {
      name: string;
      quantity: number | null;
      unit: string | null;
      category: string | null;
      source_recipe_id: number | null;
    }[]
  ) => void;
};

const demoUser = "demo-user";

let idCounter = 100;

function nextItemId() {
  idCounter += 1;
  return `li-${idCounter}`;
}

function nextListId() {
  return `sl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const initialList: ShoppingList = {
  id: "sl-active",
  userId: demoUser,
  name: "This week",
  status: "active",
  savedAt: null,
  listDate: null,
  createdAt: new Date().toISOString(),
};

function cloneItemsForActive(
  activeListId: string,
  source: ShoppingListItem[]
): ShoppingListItem[] {
  return source.map((i, idx) => ({
    ...i,
    id: nextItemId(),
    shoppingListId: activeListId,
    checked: false,
    position: idx,
  }));
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;
let shoppingPersistSuspended = true;

/** Call after initial shopping hydration (or failed fetch) so edits sync to API. */
export function setShoppingPersistReady() {
  shoppingPersistSuspended = false;
}

function queueShoppingPersist() {
  if (shoppingPersistSuspended) return;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    const s = useShoppingStore.getState();
    const payload = buildShoppingStatePayload({
      activeList: s.activeList,
      items: s.items,
      savedSnapshots: s.savedSnapshots,
    });
    void putShoppingStateToApi(payload)
      .then(() => {
        useShoppingStore.setState({ syncError: null });
      })
      .catch((error: unknown) => {
        useShoppingStore.setState({
          syncError: getErrorMessage(error, "Could not sync shopping list."),
        });
      });
  }, 750);
}

export const useShoppingStore = create<ShoppingState>((set, get) => ({
  activeList: initialList,
  items: [],
  savedSnapshots: [],
  syncError: null,
  clearSyncError: () => set({ syncError: null }),

  hydrateFromApi: (data) => {
    set({
      activeList: data.activeList,
      items: data.items,
      savedSnapshots: data.savedSnapshots,
      syncError: null,
    });
  },

  toggleChecked: (itemId) => {
    set((s) => ({
      items: s.items.map((i) =>
        i.id === itemId ? { ...i, checked: !i.checked } : i
      ),
    }));
    queueShoppingPersist();
  },

  removeItem: (itemId) => {
    set((s) => ({
      items: s.items
        .filter((i) => i.id !== itemId)
        .map((i, idx) => ({ ...i, position: idx })),
    }));
    queueShoppingPersist();
  },

  clearActiveItems: () => {
    set({ items: [] });
    queueShoppingPersist();
  },

  addManualItem: (name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const { activeList, items } = get();
    const item: ShoppingListItem = {
      id: nextItemId(),
      shoppingListId: activeList.id,
      name: trimmed,
      quantity: null,
      unit: null,
      category: null,
      checked: false,
      sourceRecipeId: null,
      isManual: true,
      position: items.length,
    };
    set({ items: [...items, item] });
    queueShoppingPersist();
  },

  saveActiveList: (payload) => {
    const { activeList, items, savedSnapshots } = get();
    const trimmedName = payload.name.trim();
    const listDate = payload.listDate.trim();
    if (!trimmedName || !listDate || !parseLocalISODate(listDate)) return;
    const savedListId = nextListId();
    const savedList: ShoppingList = {
      id: savedListId,
      userId: activeList.userId,
      name: trimmedName,
      status: "saved",
      savedAt: new Date().toISOString(),
      listDate,
      createdAt: new Date().toISOString(),
    };
    const snapshotItems = items.map((i, idx) => ({
      ...i,
      id: nextItemId(),
      shoppingListId: savedListId,
      position: idx,
    }));
    const snapshot: SavedSnapshot = {
      list: savedList,
      items: snapshotItems,
    };
    set({
      savedSnapshots: [snapshot, ...savedSnapshots],
    });
    queueShoppingPersist();
  },

  repeatList: (savedListId) => {
    const { activeList, items, savedSnapshots } = get();
    const snap = savedSnapshots.find((s) => s.list.id === savedListId);
    if (!snap) return;
    const appended = cloneItemsForActive(activeList.id, snap.items);
    set({ items: [...items, ...appended] });
    queueShoppingPersist();
  },

  addRecipeIngredients: (recipeId, recipeTitle, ingredientLines) => {
    const { activeList, items } = get();
    const existing = new Set(
      items
        .filter((i) => i.sourceRecipeId === recipeId)
        .map((i) => i.name.trim())
    );
    const toAdd: ShoppingListItem[] = [];
    let pos = items.length;
    for (const line of ingredientLines) {
      const trimmed = line.trim();
      if (!trimmed || existing.has(trimmed)) continue;
      existing.add(trimmed);
      const p = parseIngredientLine(trimmed);
      toAdd.push({
        id: nextItemId(),
        shoppingListId: activeList.id,
        name: trimmed,
        quantity: p.quantity,
        unit: p.unit,
        category: null,
        checked: false,
        sourceRecipeId: recipeId,
        sourceIngredientId: undefined,
        sourceRecipeTitle: recipeTitle,
        isManual: false,
        position: pos++,
      });
    }
    if (toAdd.length === 0) {
      return { added: 0, skipped: ingredientLines.length };
    }
    set({ items: [...items, ...toAdd] });
    queueShoppingPersist();
    return {
      added: toAdd.length,
      skipped: ingredientLines.length - toAdd.length,
    };
  },

  addRecipeIngredient: (recipeId, recipeTitle, line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return { added: false };
    }
    const { activeList, items } = get();
    const dup = items.some(
      (i) =>
        i.sourceRecipeId === recipeId && i.name.trim() === trimmed
    );
    if (dup) {
      return { added: false };
    }
    const p = parseIngredientLine(trimmed);
    const row: ShoppingListItem = {
      id: nextItemId(),
      shoppingListId: activeList.id,
      name: trimmed,
      quantity: p.quantity,
      unit: p.unit,
      category: null,
      checked: false,
      sourceRecipeId: recipeId,
      sourceIngredientId: undefined,
      sourceRecipeTitle: recipeTitle,
      isManual: false,
      position: items.length,
    };
    set({ items: [...items, row] });
    queueShoppingPersist();
    return { added: true };
  },

  replaceActiveItemsFromDedupe: (lines) => {
    const { activeList } = get();
    const items: ShoppingListItem[] = lines.map((line, idx) => ({
      id: nextItemId(),
      shoppingListId: activeList.id,
      name: line.name,
      quantity: line.quantity,
      unit: line.unit,
      category: line.category,
      checked: false,
      sourceRecipeId: line.source_recipe_id,
      sourceRecipeTitle: null,
      isManual: !line.source_recipe_id,
      position: idx,
    }));
    set({ items });
    queueShoppingPersist();
  },
}));
