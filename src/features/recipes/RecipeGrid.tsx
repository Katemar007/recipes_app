import { Children, type PropsWithChildren, type ReactNode } from "react";
import { View } from "react-native";
import {
  chunkIntoRows,
  RECIPE_GRID_GAP,
} from "@/lib/recipeGridLayout";

type RowProps = PropsWithChildren<{
  /** Expected cells per row — shorter rows get trailing flex spacers. */
  columns: number;
  gap?: number;
}>;

/**
 * One row of recipe cards: equal-width columns via flex (relative to container).
 * Pass one child per column, each wrapped in `{ flex: 1, minWidth: 0 }`, or use {@link RecipeGrid}.
 */
export function RecipeGridRow({ columns, gap = RECIPE_GRID_GAP, children }: RowProps) {
  const count = Children.count(children);
  const padCount = Math.max(0, columns - count);

  return (
    <View
      style={{
        flexDirection: "row",
        gap,
        width: "100%",
        marginBottom: gap,
      }}
    >
      {children}
      {padCount > 0
        ? Array.from({ length: padCount }, (_, i) => (
            <View
              key={`recipe-grid-pad-${i}`}
              style={{ flex: 1, minWidth: 0 }}
              importantForAccessibility="no-hide-descendants"
            />
          ))
        : null}
    </View>
  );
}

type GridProps<T extends { id: string | number }> = {
  columns: number;
  items: T[];
  gap?: number;
  renderItem: (item: T) => ReactNode;
};

/** Chunked grid for ScrollView / static sections — same row model as recipe list screens. */
export function RecipeGrid<T extends { id: string | number }>({
  columns,
  items,
  gap = RECIPE_GRID_GAP,
  renderItem,
}: GridProps<T>) {
  const rows = chunkIntoRows(items, columns);
  return (
    <>
      {rows.map((row) => (
        <RecipeGridRow
          key={row.map((r) => r.id).join("-")}
          columns={columns}
          gap={gap}
        >
          {row.map((item) => (
            <View key={item.id} style={{ flex: 1, minWidth: 0 }}>
              {renderItem(item)}
            </View>
          ))}
        </RecipeGridRow>
      ))}
    </>
  );
}
