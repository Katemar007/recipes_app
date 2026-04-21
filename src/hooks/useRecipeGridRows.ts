import { useMemo } from "react";
import { useWindowDimensions } from "react-native";
import { chunkIntoRows, recipeGridColumns } from "@/lib/recipeGridLayout";

/** Responsive column count and row chunks for recipe grids (FlatList / scroll views). */
export function useRecipeGridRows<T extends { id: string | number }>(items: T[]) {
  const { width } = useWindowDimensions();
  const cols = recipeGridColumns(width);
  const rows = useMemo(() => chunkIntoRows(items, cols), [items, cols]);
  return { cols, rows, width };
}
