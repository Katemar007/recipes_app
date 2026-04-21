/** Optional parse/format helpers for shopping-list flows (recipes store a plain `line` string). */

const ING_LINE_RE = /^(\d+(?:\.\d+)?)\s*([a-zA-Zµ]+)?\s+(.+)$/;

export type ParsedIngredientLine = {
  quantity: number | null;
  unit: string | null;
  name: string;
};

export function parseIngredientLine(line: string): ParsedIngredientLine {
  const trimmed = line.trim();
  if (!trimmed) {
    return { quantity: null, unit: null, name: "" };
  }
  const m = trimmed.match(ING_LINE_RE);
  if (m) {
    const q = Number(m[1]);
    return {
      quantity: Number.isFinite(q) ? q : null,
      unit: m[2]?.trim() || null,
      name: (m[3] ?? "").trim(),
    };
  }
  return { quantity: null, unit: null, name: trimmed };
}

export function formatIngredientLine(
  quantity: number | null,
  unit: string | null,
  name: string
): string {
  const n = name.trim();
  if (!n) return "";
  if (quantity != null && Number.isFinite(quantity) && unit) {
    return `${quantity} ${unit} ${n}`;
  }
  if (quantity != null && Number.isFinite(quantity)) {
    return `${quantity} ${n}`;
  }
  return n;
}

