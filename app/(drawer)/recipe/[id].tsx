import { RecipeImagePlaceholder, RecipeRemoteImage } from "@/features/recipes";
import {
  AppButton,
  CircleActionButton,
  IngredientShoppingToggleButton,
  PlannedToggleButton,
} from "@/components/ui/AppButton";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Linking,
  PanResponder,
  Platform,
  ScrollView,
  useWindowDimensions,
  View,
} from "react-native";
import {
  SegmentedButtons,
  Snackbar,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  COLORS,
  centeredContentColumn,
  centeredPageContainer,
  recipeDetailStyles,
} from "@/theme";
import {
  formatDirectionsForDisplay,
  type UnitSystem,
} from "@/lib/units";
import {
  filterLinkedCategories,
  primaryCategoryLabel,
  recipeMatchesCategoryWithDirectory,
  validCategoryIds,
} from "@/lib/recipeCategories";
import {
  useCategoriesQuery,
  useRecipeByIdQuery,
  useRecipesQuery,
  useUpdateRecipeNotesMutation,
  useUpdateRecipeStatusMutation,
} from "@/hooks/api/useServerState";
import { useShoppingStore } from "@/store/useShoppingStore";

export default function RecipeDetailScreen() {
  const { id: rawId, category: rawCategory } = useLocalSearchParams<{
    id: string;
    category?: string;
  }>();
  const recipeId = useMemo(() => {
    if (rawId == null || rawId === "") return undefined;
    const n = Number(rawId);
    return Number.isFinite(n) ? n : undefined;
  }, [rawId]);
  const router = useRouter();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const { data: allRecipes = [] } = useRecipesQuery();
  const { data: categoryDirectory = [], isSuccess: categoriesHydrated } =
    useCategoriesQuery();
  const recipeFromList = useMemo(
    () =>
      recipeId !== undefined
        ? allRecipes.find((candidate) => candidate.id === recipeId)
        : undefined,
    [allRecipes, recipeId]
  );
  const recipeByIdQuery = useRecipeByIdQuery(
    recipeId !== undefined && recipeFromList == null ? recipeId : undefined
  );
  const recipe = recipeFromList ?? recipeByIdQuery.data;
  const moveRecipeStatus = useUpdateRecipeStatusMutation();
  const updateRecipeNotes = useUpdateRecipeNotesMutation();
  const addRecipeIngredient = useShoppingStore((s) => s.addRecipeIngredient);
  const shoppingItems = useShoppingStore((s) => s.items);
  const removeShoppingItem = useShoppingStore((s) => s.removeItem);

  const [movedToPlannedAck, setMovedToPlannedAck] = useState(false);
  const [snackbar, setSnackbar] = useState<string | null>(null);
  const [unitSystem, setUnitSystem] = useState<UnitSystem>("us");
  const [notesDraft, setNotesDraft] = useState("");
  const [notesEditing, setNotesEditing] = useState(false);
  const isWeb = Platform.OS === "web";
  const isAndroid = Platform.OS === "android";
  const selectedCategory =
    typeof rawCategory === "string" && rawCategory.trim() ? rawCategory.trim() : null;
  const maxContentWidth = 1040;
  const heroHeight = width >= 1200 ? 420 : width >= 900 ? 360 : 260;
  const styles = recipeDetailStyles(theme, heroHeight);

  useEffect(() => {
    setMovedToPlannedAck(false);
    setSnackbar(null);
  }, [rawId]);

  // Reset draft when the route id changes; another effect keeps draft in sync with `recipe?.notes`.
  useEffect(() => {
    setNotesEditing(false);
    setNotesDraft(recipe?.notes ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only reinitialize when `rawId` changes
  }, [rawId]);

  useEffect(() => {
    if (!notesEditing) {
      setNotesDraft(recipe?.notes ?? "");
    }
  }, [recipe?.notes, notesEditing]);

  function onAddSingleIngredient(line: string) {
    if (!recipe) return;
    addRecipeIngredient(recipe.id, recipe.title, line);
  }

  function onIngredientShoppingToggle(line: string) {
    if (!recipe) return;
    const trimmed = line.trim();
    const existing = shoppingItems.find(
      (i) =>
        i.sourceRecipeId === recipe.id && i.name.trim() === trimmed
    );
    if (existing) {
      removeShoppingItem(existing.id);
      return;
    }
    onAddSingleIngredient(line);
  }

  function ingredientOnShoppingList(line: string): boolean {
    if (!recipe) return false;
    const trimmed = line.trim();
    return shoppingItems.some(
      (i) =>
        i.sourceRecipeId === recipe.id && i.name.trim() === trimmed
    );
  }

  async function onOpenSourceUrl(url: string) {
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        setSnackbar("Could not open source URL.");
        return;
      }
      await Linking.openURL(url);
    } catch {
      setSnackbar("Could not open source URL.");
    }
  }

  const ingredientLines = recipe?.ingredients ?? [];

  const swipeList = useMemo(() => {
    if (!selectedCategory) return allRecipes;
    return allRecipes.filter((r) =>
      recipeMatchesCategoryWithDirectory(
        r,
        selectedCategory,
        categoryDirectory,
        categoriesHydrated
      )
    );
  }, [allRecipes, selectedCategory, categoryDirectory, categoriesHydrated]);

  const detailCategoryLabel = useMemo(() => {
    if (!recipe) return "";
    const filtered = filterLinkedCategories(
      recipe,
      validCategoryIds(categoryDirectory, categoriesHydrated)
    );
    return primaryCategoryLabel(
      recipe,
      filtered,
      categoryDirectory,
      categoriesHydrated
    );
  }, [recipe, categoryDirectory, categoriesHydrated]);

  const swipeIndex = useMemo(
    () => swipeList.findIndex((r) => r.id === recipeId),
    [swipeList, recipeId]
  );

  const navigateBySwipe = useCallback(
    (direction: "next" | "prev") => {
      if (swipeIndex < 0) return;
      const targetIndex =
        direction === "next" ? swipeIndex + 1 : swipeIndex - 1;
      if (targetIndex < 0 || targetIndex >= swipeList.length) return;
      const target = swipeList[targetIndex];
      router.replace({
        pathname: "/recipe/[id]",
        params: {
          id: String(target.id),
          ...(selectedCategory ? { category: selectedCategory } : {}),
        },
      });
    },
    [router, selectedCategory, swipeIndex, swipeList]
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dx) > 24 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.2,
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dx <= -60) navigateBySwipe("next");
          if (gestureState.dx >= 60) navigateBySwipe("prev");
        },
      }),
    [navigateBySwipe]
  );

  if (!recipe) {
    return (
      <View className="flex-1 p-4 justify-center" style={styles.notFoundWrap}>
        <Text variant="bodyLarge">Recipe not found.</Text>
        <AppButton
          mode="text"
          style={styles.startButton}
          onPress={() => router.back()}
        >
          Go back
        </AppButton>
      </View>
    );
  }

  const isPlanned = recipe.status === "planned";
  /** Nutrition fields are stored per one serving (as entered). */
  const n = recipe.nutrition;
  const kcal =
    n?.kcal != null && Number.isFinite(n.kcal) ? Math.round(n.kcal) : null;
  const proteinG =
    n?.proteinG != null && Number.isFinite(n.proteinG)
      ? Math.round(n.proteinG * 10) / 10
      : null;
  const carbsG =
    n?.carbsG != null && Number.isFinite(n.carbsG)
      ? Math.round(n.carbsG * 10) / 10
      : null;
  const fatG =
    n?.fatG != null && Number.isFinite(n.fatG)
      ? Math.round(n.fatG * 10) / 10
      : null;

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={centeredPageContainer({ isWeb, maxWidth: maxContentWidth })}
      style={styles.screenBg}
    >
      <View style={centeredContentColumn(maxContentWidth)} {...panResponder.panHandlers}>
        <RecipeRemoteImage
          imageUrl={recipe.imageUrl}
          style={styles.heroImage}
          resizeMode="cover"
          placeholder={
            <RecipeImagePlaceholder
              variant="hero"
              height={heroHeight}
              style={styles.heroPlaceholder}
            />
          }
        />
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text variant="headlineSmall" className="mb-1">
              {recipe.title}
            </Text>
          </View>
          {isAndroid ? (
            <View
              style={{
                flexDirection: "row",
                gap: 10,
                marginTop: 4,
                alignItems: "center",
              }}
            >
              <CircleActionButton
                accessibilityLabel="Edit recipe"
                color={COLORS.darkRed}
                iconName="pencil"
                diameter={42}
                iconSize={22}
                onPress={() => {
                  router.push({
                    pathname: "/new-recipe",
                    params: {
                      editId: String(recipe.id),
                      ...(selectedCategory
                        ? { returnCategory: selectedCategory }
                        : {}),
                    },
                  });
                }}
              />
              {!isPlanned ? (
                <CircleActionButton
                  accessibilityLabel="Add recipe to Planned"
                  diameter={42}
                  iconSize={22}
                  onPress={() => {
                    moveRecipeStatus.mutate({ id: recipe.id, status: "planned" });
                    setMovedToPlannedAck(true);
                    setSnackbar("Added to Planned");
                  }}
                />
              ) : (
                <PlannedToggleButton
                  planned
                  onToggle={() => {
                    /* keep status pill; no-op on detail header */
                  }}
                />
              )}
            </View>
          ) : (
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 8,
                marginTop: 4,
                justifyContent: "flex-end",
                alignItems: "center",
              }}
            >
              <AppButton
                mode="text"
                icon="pencil"
                compact
                color={COLORS.darkRed}
                style={{ minHeight: 32 }}
                onPress={() => {
                  router.push({
                    pathname: "/new-recipe",
                    params: {
                      editId: String(recipe.id),
                      ...(selectedCategory
                        ? { returnCategory: selectedCategory }
                        : {}),
                    },
                  });
                }}
              >
                Edit
              </AppButton>
              {!isPlanned ? (
                <AppButton
                  color={COLORS.brightGreen}
                  compact
                  style={{ minHeight: 32, minWidth: 160 }}
                  onPress={() => {
                    moveRecipeStatus.mutate({ id: recipe.id, status: "planned" });
                    setMovedToPlannedAck(true);
                    setSnackbar("Added to Planned");
                  }}
                >
                  Add to Planned
                </AppButton>
              ) : (
                <PlannedToggleButton
                  planned
                  onToggle={() => {
                    /* keep status pill; no-op on detail header */
                  }}
                />
              )}
            </View>
          )}
        </View>
        {detailCategoryLabel ? (
          <Text variant="labelLarge" className="mb-2" style={styles.categoryText}>
            {detailCategoryLabel}
          </Text>
        ) : null}
        {recipe.sourceUrl ? (
          <View style={styles.sourceWrap}>
            <Text variant="labelSmall" style={styles.mutedLabel}>
              Original recipe
            </Text>
            <Text
              variant="bodyMedium"
              style={styles.sourceLink}
              onPress={() => onOpenSourceUrl(recipe.sourceUrl!)}
            >
              {recipe.sourceUrl}
            </Text>
          </View>
        ) : null}
        <View
          style={[
            styles.sectionSurface,
            styles.topInfoRow,
          ]}
        >
          <View style={styles.topInfoCol}>
            <Text variant="labelSmall" style={[styles.mutedLabel, styles.centeredText]}>
              Preparation time
            </Text>
            <Text variant="bodyMedium" style={[styles.valueMedium, styles.centeredText]}>
              {recipe.prepTimeMin != null ? `${recipe.prepTimeMin} min` : "—"}
            </Text>
            <Text variant="labelSmall" style={[styles.mutedLabel, styles.centeredText]}>
              Cooking time
            </Text>
            <Text variant="bodyMedium" style={[styles.hintStrong, styles.centeredText]}>
              {recipe.cookTimeMin != null ? `${recipe.cookTimeMin} min` : "—"}
            </Text>
          </View>
          <View style={styles.topInfoCol}>
            <Text variant="labelSmall" style={[styles.mutedLabel, styles.centeredText]}>
              Servings
            </Text>
            <Text variant="bodyMedium" style={[styles.valueMedium, styles.centeredText]}>
              {recipe.servings}
            </Text>
            <Text variant="labelSmall" style={[styles.mutedLabel, styles.centeredText]}>
              Nutrition per serving
            </Text>
            <Text variant="bodyMedium" style={[styles.valueStrong, styles.centeredText]}>
              {kcal != null ? `~${kcal} kcal` : "—"}
            </Text>
            <Text variant="bodySmall" style={[styles.perServingMacros, styles.centeredText]}>
              P {proteinG ?? "—"}g · C {carbsG ?? "—"}g · F {fatG ?? "—"}g
            </Text>
          </View>
          <View style={styles.unitsCol}>
            <Text variant="labelSmall" style={[styles.unitsLabel, styles.centeredText]}>
              Units
            </Text>
            <SegmentedButtons
              value={unitSystem}
              onValueChange={(v) => setUnitSystem(v as UnitSystem)}
              buttons={[
                { value: "us", label: "US" },
                { value: "metric", label: "Metric" },
              ]}
              style={styles.unitsSwitch}
              density="small"
            />
          </View>
        </View>

      <View style={styles.contentSplitRow}>
        <View style={[styles.sectionSurface, styles.contentSplitCol]}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Ingredients
          </Text>
          {ingredientLines.map((line, idx) => {
            const t = line.trim();
            return (
              <View
                key={`${idx}-${line}`}
                className="ml-2 mb-2 flex-row items-center gap-2"
                style={styles.ingredientRow}
              >
                <Text variant="bodyMedium" style={styles.ingredientMain}>
                  <Text style={styles.bulletPrimary}>•</Text>
                  <Text> {t}</Text>
                </Text>
                <IngredientShoppingToggleButton
                  onShoppingList={ingredientOnShoppingList(line)}
                  ingredientName={t}
                  onPress={() => onIngredientShoppingToggle(line)}
                  style={styles.ingredientAddCircle}
                />
              </View>
            );
          })}
        </View>
        {recipe.directions ? (
          <View style={[styles.sectionSurface, styles.contentSplitCol]}>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              Directions
            </Text>
            <Text variant="bodyLarge">
              {formatDirectionsForDisplay(recipe.directions, unitSystem)}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.sectionSurface}>
        <Text variant="titleMedium" style={styles.sectionTitle}>
          Notes & comments
        </Text>
        {notesEditing ? (
          <>
            <TextInput
              mode="outlined"
              multiline
              numberOfLines={4}
              label="Your notes"
              placeholder="Substitutions, timing tweaks, what you’d change next time…"
              value={notesDraft}
              onChangeText={setNotesDraft}
              style={styles.notesInput}
            />
            <View
              style={{
                flexDirection: "row",
                justifyContent: "flex-end",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
                marginTop: isAndroid ? 10 : 6,
              }}
            >
              <AppButton
                mode="text"
                compact={isAndroid}
                color={COLORS.darkRed}
                onPress={() => {
                  setNotesDraft(recipe.notes ?? "");
                  setNotesEditing(false);
                }}
              >
                Cancel
              </AppButton>
              <AppButton
                color={COLORS.brightGreen}
                compact={isAndroid}
                style={[
                  styles.notesSaveButton,
                  { marginTop: 0 },
                  isAndroid && { minHeight: 32, minWidth: 92 },
                ]}
                onPress={() => {
                  updateRecipeNotes.mutate({ id: recipe.id, notes: notesDraft });
                  setNotesEditing(false);
                  setSnackbar("Notes saved.");
                }}
              >
                {isAndroid ? (
                  <Text variant="labelSmall" style={{ color: "#FFFFFF", fontWeight: "700" }}>
                    Save
                  </Text>
                ) : (
                  "Save"
                )}
              </AppButton>
            </View>
          </>
        ) : (recipe.notes ?? "").trim() ? (
          <>
            <Text variant="bodyLarge" selectable>
              {recipe.notes}
            </Text>
            <AppButton
              mode="text"
              compact
              color={COLORS.lightBlue}
              icon="pencil"
              style={{ alignSelf: "flex-start", marginTop: 8 }}
              onPress={() => {
                setNotesDraft(recipe.notes ?? "");
                setNotesEditing(true);
              }}
            >
              Edit notes
            </AppButton>
          </>
        ) : (
          <>
            <Text variant="bodyMedium" style={{ opacity: 0.75, marginBottom: 4 }}>
              No notes yet.
            </Text>
            <AppButton
              mode="text"
              compact
              color={COLORS.lightBlue}
              style={{ alignSelf: "flex-start" }}
              onPress={() => {
                setNotesDraft("");
                setNotesEditing(true);
              }}
            >
              Add notes
            </AppButton>
          </>
        )}
      </View>

      {isPlanned && movedToPlannedAck ? (
        <View className="gap-2" style={styles.footerActions}>
          <AppButton
            style={styles.startButton}
            onPress={() => {
              setMovedToPlannedAck(false);
              router.back();
            }}
          >
            In Planned
          </AppButton>
        </View>
      ) : null}

        <Snackbar
          visible={snackbar != null}
          onDismiss={() => setSnackbar(null)}
          duration={4500}
          onIconPress={() => setSnackbar(null)}
          action={{ label: "OK", onPress: () => setSnackbar(null) }}
        >
          {snackbar ?? ""}
        </Snackbar>
      </View>
    </ScrollView>
  );
}
