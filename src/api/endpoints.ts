import type {
  WireConvertResponse,
  WireDedupeItem,
  WireDedupeResponse,
} from "./wire";
import { apiFetch } from "./client";

export type DedupeLine = WireDedupeItem;

export async function dedupeShoppingLines(items: WireDedupeItem[]) {
  return apiFetch<WireDedupeResponse>("/shopping-lists/dedupe", {
    method: "POST",
    json: items,
  });
}

/** POST /units/convert */
export async function convertUnits(
  quantity: number,
  fromUnit: string,
  toUnit: string,
  ingredientName?: string
) {
  return apiFetch<WireConvertResponse>("/units/convert", {
    method: "POST",
    json: {
      quantity,
      from_unit: fromUnit,
      to_unit: toUnit,
      ingredient_name: ingredientName ?? null,
    },
  });
}

/** POST /shopping-lists/generate (placeholder until RDS) */
export async function generateShoppingListFromPlanned() {
  return apiFetch<{ listId: string | null; detail?: string }>(
    "/shopping-lists/generate",
    {
      method: "POST",
      json: {},
    }
  );
}
