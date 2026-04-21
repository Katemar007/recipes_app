import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { FlatList, View } from "react-native";
import { Text, TextInput, useTheme } from "react-native-paper";
import { RecipeCard, RecipeGridRow } from "@/features/recipes";
import { AppButton } from "@/components/ui/AppButton";
import {
  useCategoriesQuery,
  useRecipesQuery,
} from "@/hooks/api/useServerState";
import { COLORS } from "@/theme";
import { useRecipeGridRows } from "@/hooks/useRecipeGridRows";
import { recipeListContentContainerStyle } from "@/lib/recipeGridLayout";
import { recipeMatchesCategoryWithDirectory } from "@/lib/recipeCategories";
import type { Recipe } from "@/types";

function normalize(v: string) {
  return v.trim().toLowerCase();
}

function paramString(v: string | string[] | undefined): string | null {
  if (v == null) return null;
  if (Array.isArray(v)) return v[0] ? String(v[0]) : null;
  const s = String(v);
  return s === "" ? null : s;
}

export default function RecipesScreen() {
  const theme = useTheme();
  const { data: categoryDirectory = [], isSuccess: categoriesHydrated } =
    useCategoriesQuery();
  const params = useLocalSearchParams<{ q?: string; category?: string }>();
  const { data: allRecipes = [] } = useRecipesQuery();

  const [search, setSearch] = useState("");

  const categoryFromUrl = paramString(params.category);

  useEffect(() => {
    if (typeof params.q === "string" && params.q !== "") {
      setSearch(params.q);
    }
  }, [params.q]);

  const recipes = useMemo(() => {
    const query = normalize(search);
    return allRecipes
      .filter((r) => {
        if (!categoryFromUrl) return true;
        return recipeMatchesCategoryWithDirectory(
          r,
          categoryFromUrl,
          categoryDirectory,
          categoriesHydrated
        );
      })
      .filter((r) => {
        if (!query) return true;
        const inTitle = normalize(r.title).includes(query);
        const inTags = r.keywords.some((k) => normalize(k).includes(query));
        const inDirections = normalize(r.directions ?? "").includes(query);
        const inIngredients = r.ingredients.some((line) =>
          normalize(line).includes(query)
        );
        return inTitle || inTags || inDirections || inIngredients;
      });
  }, [allRecipes, search, categoryFromUrl, categoryDirectory, categoriesHydrated]);

  const { cols, rows, width } = useRecipeGridRows(recipes);
  const cardHrefFor = (recipeId: string | number) =>
    categoryFromUrl
      ? ({
          pathname: "/recipe/[id]",
          params: { id: String(recipeId), category: categoryFromUrl },
        } as const)
      : `/recipe/${recipeId}`;

  return (
    <View className="flex-1" style={{ backgroundColor: theme.colors.background }}>
      <FlatList
        key={cols}
        data={rows}
        keyExtractor={(row: Recipe[]) => row.map((r) => r.id).join("-")}
        extraData={width}
        contentContainerStyle={recipeListContentContainerStyle()}
        ListHeaderComponent={
          <View className="mb-4 gap-3">
            <View className="flex-row items-stretch gap-3 flex-wrap">
              <View className="flex-1 min-w-[200px]">
                <TextInput
                  mode="outlined"
                  dense
                  label="Search all recipes (title, tags, ingredients, steps)"
                  placeholder="Title, tags, ingredients, or steps…"
                  value={search}
                  onChangeText={setSearch}
                  style={{ backgroundColor: "#ffffff" }}
                  outlineColor={COLORS.darkRed}
                  activeOutlineColor={COLORS.darkRed}
                  contentStyle={{ paddingVertical: 6 }}
                  right={
                    <TextInput.Icon
                      icon="magnify"
                      color={COLORS.darkRed}
                      onPress={() => {
                        /* icon is decorative here; filtering is live on typing */
                      }}
                    />
                  }
                />
              </View>
              <AppButton
                onPress={() => router.push("/new-recipe")}
                color={COLORS.brightGreen}
                style={{ alignSelf: "center", minWidth: 160 }}
              >
                + Add new recipe
              </AppButton>
            </View>
            {categoryFromUrl ? (
              <View className="flex-row items-center flex-wrap gap-2">
                <Text variant="bodySmall" style={{ opacity: 0.8 }}>
                  Category:{" "}
                  <Text variant="bodySmall" style={{ fontWeight: "700" }}>
                    {categoryFromUrl}
                  </Text>
                </Text>
                <AppButton
                  mode="text"
                  compact
                  onPress={() => router.push("/recipes")}
                  color={COLORS.darkRed}
                  style={{ alignSelf: "center" }}
                >
                  Show all recipes
                </AppButton>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <Text
            className="text-center mt-8 px-2"
            variant="bodyLarge"
            style={{ opacity: 0.9 }}
          >
            No recipes match your search
            {categoryFromUrl ? ` in “${categoryFromUrl}”` : ""}. Try different
            words or choose another category from the Recipes menu.
          </Text>
        }
        renderItem={({ item: row }) => (
          <RecipeGridRow columns={cols}>
            {row.map((r) => (
              <View key={r.id} style={{ flex: 1, minWidth: 0 }}>
                <RecipeCard
                  recipe={r}
                  href={cardHrefFor(r.id)}
                />
              </View>
            ))}
          </RecipeGridRow>
        )}
      />
    </View>
  );
}
