import { router } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, useWindowDimensions, View } from "react-native";
import { Card, Text, TextInput, useTheme } from "react-native-paper";
import { RecipeCard, RecipeGrid } from "@/features/recipes";
import { COLORS } from "@/theme";
import {
  RECIPE_GRID_GAP,
  recipeGridColumns,
  recipeListContentContainerStyle,
} from "@/lib/recipeGridLayout";
import { useRecipesQuery } from "@/hooks/api/useServerState";

function normalize(v: string) {
  return v.trim().toLowerCase();
}

export default function HomeScreen() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const { data: allRecipes = [] } = useRecipesQuery();
  const [search, setSearch] = useState("");
  const previewRecipes = allRecipes.slice(0, 8);

  const columns = recipeGridColumns(width);

  const matchCount = useMemo(() => {
    const q = normalize(search);
    if (!q) return null;
    return allRecipes.filter((r) => {
      const inDirections = normalize(r.directions ?? "").includes(q);
      const inIngredients = r.ingredients.some((line) =>
        normalize(line).includes(q)
      );
      const inTitle = normalize(r.title).includes(q);
      const inTags = r.keywords.some((k) => normalize(k).includes(q));
      return inDirections || inIngredients || inTitle || inTags;
    }).length;
  }, [allRecipes, search]);

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={recipeListContentContainerStyle()}
      style={{ backgroundColor: theme.colors.background }}
    >
      <View
        style={{
          width: "100%",
          maxWidth: 720,
          alignSelf: "center",
          marginBottom: RECIPE_GRID_GAP,
        }}
      >
        <TextInput
          mode="outlined"
          dense
          label="Search all recipes (title, tags, ingredients, steps)"
          placeholder="Type a word, then Search"
          value={search}
          onChangeText={setSearch}
          style={{
            backgroundColor: "#ffffff",
            marginBottom: matchCount != null ? 10 : 0,
          }}
          outlineColor={COLORS.darkRed}
          activeOutlineColor={COLORS.darkRed}
          contentStyle={{ paddingVertical: 6 }}
          onSubmitEditing={() => {
            const q = search.trim();
            if (!q) return;
            router.push({
              pathname: "/recipes",
              params: { q },
            });
          }}
          right={
            <TextInput.Icon
              icon="magnify"
              color={COLORS.darkRed}
              onPress={() => {
                const q = search.trim();
                if (!q) return;
                router.push({ pathname: "/recipes", params: { q } });
              }}
            />
          }
        />
        {matchCount != null ? (
          <Text variant="bodySmall" style={{ opacity: 0.8 }}>
            {matchCount} recipe{matchCount === 1 ? "" : "s"} match. Open Recipes
            for the full list and filters.
          </Text>
        ) : null}
      </View>

      {previewRecipes.length > 0 ? (
        <RecipeGrid
          columns={columns}
          items={previewRecipes}
          gap={RECIPE_GRID_GAP}
          renderItem={(recipe) => <RecipeCard recipe={recipe} />}
        />
      ) : (
        <Card mode="outlined" style={{ padding: 14, width: "100%" }}>
          <Text variant="bodyMedium">
            No recipes yet. Add one from Recipes.
          </Text>
        </Card>
      )}
    </ScrollView>
  );
}
