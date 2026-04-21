import type { ViewStyle } from "react-native";
import { deviceClassForWidth, isWeb } from "./device";

/** Max content column width (matches home / recipes / planned). */
export const RECIPE_MAX_CONTENT_WIDTH = 1180;

/** Horizontal padding inside screen (one side). */
export function recipeScreenPaddingX(): number {
  return isWeb ? 44 : 32;
}

/** Gap between cards in a row — use with `RecipeGridRow` (`gap` style). */
export const RECIPE_GRID_GAP = 24;

export function recipeGridColumns(screenWidth: number): number {
  const device = deviceClassForWidth(screenWidth);
  if (device === "desktop") return 3;
  if (device === "tablet") return 2;
  return 1;
}

/** Split items into rows of length `columns` (last row may be shorter). */
export function chunkIntoRows<T>(items: T[], columns: number): T[][] {
  if (columns < 1) return [];
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += columns) {
    rows.push(items.slice(i, i + columns));
  }
  return rows;
}

/** Shared padded, max-width-centered content area for recipe grids (lists + scroll). */
export function recipeListContentContainerStyle(): ViewStyle {
  return {
    paddingHorizontal: recipeScreenPaddingX(),
    paddingTop: 18,
    paddingBottom: 28,
    width: "100%",
    maxWidth: RECIPE_MAX_CONTENT_WIDTH,
    alignSelf: "center",
  };
}
