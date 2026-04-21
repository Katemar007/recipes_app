/** Display-only conversion between US customary and metric for ingredients & oven temps. */

export type UnitSystem = "us" | "metric";

function normUnit(u: string | null | undefined): string {
  if (u == null || u === "") return "";
  return u.trim().toLowerCase();
}

function roundNice(n: number): number {
  if (!Number.isFinite(n)) return n;
  if (n >= 100) return Math.round(n);
  if (n >= 10) return Math.round(n * 10) / 10;
  return Math.round(n * 100) / 100;
}

const US_CUP_ML = 240;
const US_TBSP_ML = 15;
const US_TSP_ML = 5;
const OZ_G = 28.3495;
const LB_G = 453.592;

export type IngredientDisplay = {
  primary: string;
  secondary: string | null;
};

/**
 * Assumes stored amounts use US volume/weight where applicable (cup, tbsp, lb, oz).
 * Metric mode shows ml/g/kg with the original US line as secondary when converted.
 */
export function formatIngredientDisplay(
  quantity: number | null,
  unit: string | null,
  system: UnitSystem
): IngredientDisplay {
  if (quantity == null || !Number.isFinite(quantity)) {
    return { primary: "", secondary: null };
  }
  const u = normUnit(unit);

  if (system === "metric") {
    if (u === "cup" || u === "cups" || u === "c") {
      const ml = roundNice(quantity * US_CUP_ML);
      return {
        primary: `${ml} ml`,
        secondary: `${quantity} ${unit ?? "cup"}`,
      };
    }
    if (
      u === "tbsp" ||
      u === "tablespoon" ||
      u === "tablespoons" ||
      u === "tbs"
    ) {
      const ml = roundNice(quantity * US_TBSP_ML);
      return {
        primary: `${ml} ml`,
        secondary: `${quantity} ${unit ?? "tbsp"}`,
      };
    }
    if (u === "tsp" || u === "teaspoon" || u === "teaspoons") {
      const ml = roundNice(quantity * US_TSP_ML);
      return {
        primary: `${ml} ml`,
        secondary: `${quantity} ${unit ?? "tsp"}`,
      };
    }
    if (u === "lb" || u === "lbs" || u === "pound" || u === "pounds") {
      const g = quantity * LB_G;
      if (g >= 1000) {
        const kg = roundNice(g / 1000);
        return {
          primary: `${kg} kg`,
          secondary: `${quantity} ${unit ?? "lb"}`,
        };
      }
      return {
        primary: `${Math.round(g)} g`,
        secondary: `${quantity} ${unit ?? "lb"}`,
      };
    }
    if (u === "oz" || u === "ounce" || u === "ounces") {
      const g = roundNice(quantity * OZ_G);
      return {
        primary: `${Math.round(g)} g`,
        secondary: `${quantity} ${unit ?? "oz"}`,
      };
    }
    if (
      u === "g" ||
      u === "gram" ||
      u === "grams" ||
      u === "kg" ||
      u === "ml" ||
      u === "l" ||
      u === "liter" ||
      u === "liters"
    ) {
      return { primary: `${quantity} ${unit ?? ""}`.trim(), secondary: null };
    }
    return { primary: `${quantity} ${unit ?? ""}`.trim(), secondary: null };
  }

  // US — convert obvious metric inputs for display
  if (u === "ml" || u === "milliliter" || u === "milliliters") {
    const cups = quantity / US_CUP_ML;
    if (cups >= 0.125) {
      const c = roundNice(cups);
      return {
        primary: `${c} cup${c === 1 ? "" : "s"}`,
        secondary: `${quantity} ml`,
      };
    }
    const tbsp = roundNice(quantity / US_TBSP_ML);
    return { primary: `${tbsp} tbsp`, secondary: `${quantity} ml` };
  }
  if (u === "g" || u === "gram" || u === "grams") {
    if (quantity >= LB_G * 0.25) {
      const lbs = roundNice(quantity / LB_G);
      return { primary: `${lbs} lb`, secondary: `${quantity} g` };
    }
    const oz = roundNice(quantity / OZ_G);
    return { primary: `${oz} oz`, secondary: `${quantity} g` };
  }
  if (u === "kg") {
    const lbs = roundNice(quantity * 2.20462);
    return { primary: `${lbs} lb`, secondary: `${quantity} kg` };
  }
  return { primary: `${quantity} ${unit ?? ""}`.trim(), secondary: null };
}

export function formatDirectionsForDisplay(
  directions: string | null,
  system: UnitSystem
): string {
  if (!directions) return "";
  if (system === "us") return directions;
  return directions.replace(/\b(\d+)\s*F\b/g, (_, digits: string) => {
    const f = Number(digits);
    if (!Number.isFinite(f)) return `${digits}F`;
    const c = Math.round(((f - 32) * 5) / 9);
    return `${c}°C`;
  });
}
