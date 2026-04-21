import { useMemo } from "react";
import { FlatList, View } from "react-native";
import { Text, useTheme } from "react-native-paper";
import { RecipeCard, RecipeGridRow } from "@/features/recipes";
import { useRecipesQuery } from "@/hooks/api/useServerState";
import { useRecipeGridRows } from "@/hooks/useRecipeGridRows";
import { recipeListContentContainerStyle } from "@/lib/recipeGridLayout";
import type { Recipe } from "@/types";

export default function PlannedScreen() {
  const theme = useTheme();
  const { data: allRecipes = [] } = useRecipesQuery();
  const recipes = useMemo(
    () => allRecipes.filter((r) => r.status === "planned"),
    [allRecipes]
  );
  const { cols, rows, width } = useRecipeGridRows(recipes);

  return (
    <View className="flex-1" style={{ backgroundColor: theme.colors.background }}>
      <FlatList
        key={cols}
        data={rows}
        keyExtractor={(row: Recipe[]) => row.map((r) => r.id).join("-")}
        extraData={width}
        contentContainerStyle={recipeListContentContainerStyle()}
        ListEmptyComponent={
          <Text
            className="text-center mt-8 px-4"
            variant="bodyLarge"
            style={{ opacity: 0.9 }}
          >
            Nothing planned yet. Add recipes from Home or Recipes with the +
            button, or open a recipe and use “Move to Planned”.
          </Text>
        }
        renderItem={({ item: row }) => (
          <RecipeGridRow columns={cols}>
            {row.map((recipe) => (
              <View key={recipe.id} style={{ flex: 1, minWidth: 0 }}>
                <RecipeCard recipe={recipe} />
              </View>
            ))}
          </RecipeGridRow>
        )}
      />
    </View>
  );
}
