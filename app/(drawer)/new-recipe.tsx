import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import {
  PaperProvider,
  Text,
  TextInput,
  useTheme,
} from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppButton } from "@/components/ui/AppButton";
import { CenterAlertModal } from "@/components/ui/CenterAlertModal";
import { MultiSelectDropdownMenu } from "@/components/ui/MultiSelectDropdownMenu";
import { useAnchoredDropdown } from "@/hooks/useAnchoredDropdown";
import {
  createRecipeOnApi,
  fetchIngredientSectionsCatalog,
  fetchRecipeById,
  getErrorMessage,
  replaceRecipeOnApi,
  type ApiIngredientSection,
} from "@/api";
import type { WireRecipeIngredientLineCreate } from "@/api/wire";
import { queryKeys, useCategoriesQuery } from "@/hooks/api/useServerState";
import { COLORS } from "@/theme";
import type { RecipeIngredientSectionRef } from "@/types";
import { useQueryClient } from "@tanstack/react-query";

function splitTags(raw: string): string[] {
  return raw
    .split(/[,;\n]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function isCategorySelected(selected: string[], name: string): boolean {
  const k = name.trim().toLowerCase();
  return selected.some((s) => s.trim().toLowerCase() === k);
}

function toggleCategory(selected: string[], name: string): string[] {
  const k = name.trim().toLowerCase();
  const t = name.trim();
  if (!t) return selected;
  if (selected.some((s) => s.trim().toLowerCase() === k)) {
    return selected.filter((s) => s.trim().toLowerCase() !== k);
  }
  return [...selected, t];
}

function mergeNewCategoryNames(prev: string[], raw: string): string[] {
  const parts = splitTags(raw);
  if (parts.length === 0) return prev;
  let next = [...prev];
  for (const p of parts) {
    const k = p.toLowerCase();
    if (!next.some((s) => s.trim().toLowerCase() === k)) next.push(p);
  }
  return next;
}

/** Whole minutes ≥ 0; empty → null. */
function parseOptionalNonNegativeInt(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  if (!/^\d+$/.test(t)) return null;
  return parseInt(t, 10);
}

/** Grams / kcal ≥ 0; empty → null. */
function parseOptionalNonNegativeNumber(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = parseFloat(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

async function pickImagePayload(): Promise<{
  base64: string;
  mime: string;
} | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: Platform.OS !== "web",
    quality: 0.85,
    base64: true,
  });
  if (res.canceled || !res.assets?.[0]) return null;
  const a = res.assets[0];
  if (a.base64) {
    return {
      base64: a.base64,
      mime: a.mimeType ?? "image/jpeg",
    };
  }
  if (a.uri && Platform.OS !== "web") {
    const b64 = await FileSystem.readAsStringAsync(a.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return { base64: b64, mime: "image/jpeg" };
  }
  return null;
}

const fieldBackground = { backgroundColor: "#ffffff" as const };

function nextUnusedSectionCatalogId(
  catalog: { id: number }[],
  /** Other section blocks already using ids — avoids duplicate ids before the next catalog fetch. */
  otherSectionIds: number[]
): number {
  const ids = [...catalog.map((c) => c.id), ...otherSectionIds];
  return 1 + Math.max(0, ...ids);
}

/** Pick a catalog id for this section title, or the next free id for a new title. */
function sectionIdForTitle(
  title: string,
  catalog: ApiIngredientSection[],
  otherSectionIds: number[] = []
): number {
  const t = title.trim();
  if (!t || t.toLowerCase() === "ingredients") return 0;
  const hit = catalog.find(
    (c) => c.title.trim().toLowerCase() === t.toLowerCase()
  );
  if (hit) return hit.id;
  return nextUnusedSectionCatalogId(catalog, otherSectionIds);
}

const DEFAULT_SECTION_PRESETS = [
  "Batter",
  "Topping",
  "Sauce",
  "Marinade",
  "Filling",
  "Salad",
  "Garnish",
  "Dry ingredients",
  "Wet ingredients",
  "To serve",
];

type IngredientSectionDraft = {
  key: string;
  title: string;
  lines: string;
  /** Shared `ingredient_sections.id` from the API catalog (0 = default unnamed section). */
  sectionId: number;
  /** Order of this section within the recipe. */
  sectionPosition: number;
  /** Parallel to each non-empty line from `lines`, for stable `ingredient_id` on edit. */
  ingredientIds?: (number | null)[];
};

type FormState = {
  title: string;
  description: string;
  ingredientSections: IngredientSectionDraft[];
  sectionModalOpen: boolean;
  customSectionName: string;
  directions: string;
  selectedCategoryNames: string[];
  newCategoryDraft: string;
  tags: string;
  prepTimeMin: string;
  cookTimeMin: string;
  nutKcal: string;
  nutProtein: string;
  nutCarbs: string;
  nutFat: string;
  servings: string;
  sourceUrl: string;
  pickedLabel: string | null;
  imagePayload: {
    base64: string;
    mime: string;
  } | null;
};

type FormAction =
  | { type: "patch"; patch: Partial<FormState> }
  | { type: "hydrate"; state: FormState }
  | {
      type: "setIngredientSections";
      updater: (prev: IngredientSectionDraft[]) => IngredientSectionDraft[];
    }
  | {
      type: "setSelectedCategoryNames";
      updater: (prev: string[]) => string[];
    };

function createInitialFormState(): FormState {
  return {
    title: "",
    description: "",
    ingredientSections: [
      {
        key: newSectionKey(),
        title: "",
        lines: "",
        sectionId: 0,
        sectionPosition: 0,
      },
    ],
    sectionModalOpen: false,
    customSectionName: "",
    directions: "",
    selectedCategoryNames: [],
    newCategoryDraft: "",
    tags: "",
    prepTimeMin: "",
    cookTimeMin: "",
    nutKcal: "",
    nutProtein: "",
    nutCarbs: "",
    nutFat: "",
    servings: "4",
    sourceUrl: "",
    pickedLabel: null,
    imagePayload: null,
  };
}

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "patch":
      return { ...state, ...action.patch };
    case "hydrate":
      return action.state;
    case "setIngredientSections":
      return {
        ...state,
        ingredientSections: action.updater(state.ingredientSections),
      };
    case "setSelectedCategoryNames":
      return {
        ...state,
        selectedCategoryNames: action.updater(state.selectedCategoryNames),
      };
    default:
      return state;
  }
}

function newSectionKey(): string {
  return `sec-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Resolve a section heading when hydrating edit — refs first, then shared catalog. */
function sectionBlockDisplayTitle(
  refs: RecipeIngredientSectionRef[] | undefined,
  catalog: ApiIngredientSection[],
  sectionId: number,
  sectionPosition: number
): string {
  const fromRefs = refs?.find(
    (x) => x.sectionId === sectionId && x.sectionPosition === sectionPosition
  )?.title;
  if (fromRefs?.trim()) return fromRefs.trim();
  const fromCatalog = catalog.find((c) => c.id === sectionId)?.title;
  if (fromCatalog?.trim()) return fromCatalog.trim();
  return sectionId === 0 ? "" : "Section";
}

export default function NewRecipeScreen() {
  const theme = useTheme();
  const isAndroid = Platform.OS === "android";
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    editId?: string;
    returnCategory?: string;
  }>();
  const editIdNum = useMemo(() => {
    const raw = params.editId;
    const s = Array.isArray(raw) ? raw[0] : raw;
    if (s == null || s === "") return undefined;
    const n = Number(String(s));
    return Number.isFinite(n) ? n : undefined;
  }, [params.editId]);
  const returnCategoryStr =
    typeof params.returnCategory === "string" && params.returnCategory.trim()
      ? params.returnCategory.trim()
      : undefined;

  const [alertModal, setAlertModal] = useState<{
    visible: boolean;
    title: string;
    message: string;
  }>({ visible: false, title: "", message: "" });
  const [saveUi, setSaveUi] = useState<"idle" | "saved">("idle");

  const showAlert = useCallback((title: string, message: string) => {
    setAlertModal({ visible: true, title, message });
  }, []);
  const dismissAlert = useCallback(() => {
    setAlertModal((m) => ({ ...m, visible: false }));
  }, []);

  const [formState, dispatchForm] = useReducer(formReducer, createInitialFormState());
  const [sectionCatalog, setSectionCatalog] = useState<ApiIngredientSection[]>(
    []
  );
  const [busy, setBusy] = useState(false);
  const [editHydrated, setEditHydrated] = useState(() => editIdNum === undefined);
  const categoryMenu = useAnchoredDropdown();
  const queryClient = useQueryClient();
  const { data: categoryRows = [] } = useCategoriesQuery();
  const {
    title,
    description,
    ingredientSections,
    sectionModalOpen,
    customSectionName,
    directions,
    selectedCategoryNames,
    newCategoryDraft,
    tags,
    prepTimeMin,
    cookTimeMin,
    nutKcal,
    nutProtein,
    nutCarbs,
    nutFat,
    servings,
    sourceUrl,
    pickedLabel,
    imagePayload,
  } = formState;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await fetchIngredientSectionsCatalog();
        if (!cancelled) setSectionCatalog(rows);
      } catch {
        /* offline — UI still works with client-chosen ids + section_title */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (editIdNum === undefined) {
      setEditHydrated(true);
      return;
    }
    let cancelled = false;
    setEditHydrated(false);
    (async () => {
      try {
        const recipe = await fetchRecipeById(editIdNum);
        if (cancelled) return;
        const nextState = createInitialFormState();
        nextState.title = recipe.title;
        nextState.description = recipe.description ?? "";
        nextState.directions = recipe.directions ?? "";
        nextState.selectedCategoryNames = recipe.categories.map((c) => c.name);
        nextState.tags = recipe.keywords.join(", ");
        nextState.prepTimeMin =
          recipe.prepTimeMin != null ? String(recipe.prepTimeMin) : "";
        nextState.cookTimeMin =
          recipe.cookTimeMin != null ? String(recipe.cookTimeMin) : "";
        nextState.servings = String(recipe.servings);
        nextState.sourceUrl = recipe.sourceUrl ?? "";
        nextState.imagePayload = null;
        nextState.pickedLabel = null;
        const nut = recipe.nutrition;
        nextState.nutKcal =
          nut?.kcal != null ? String(Math.round(nut.kcal * 10) / 10) : "";
        nextState.nutProtein =
          nut?.proteinG != null
            ? String(Math.round(nut.proteinG * 10) / 10)
            : "";
        nextState.nutCarbs =
          nut?.carbsG != null ? String(Math.round(nut.carbsG * 10) / 10) : "";
        nextState.nutFat =
          nut?.fatG != null ? String(Math.round(nut.fatG * 10) / 10) : "";
        const detail = recipe.ingredientsDetail;
        if (detail && detail.length > 0) {
          const sorted = [...detail].sort(
            (a, b) =>
              a.sectionPosition - b.sectionPosition ||
              a.position - b.position
          );
          const keysOrder: string[] = [];
          const groups = new Map<
            string,
            {
              title: string;
              sectionId: number;
              sectionPosition: number;
              lines: string[];
              ids: (number | null)[];
            }
          >();
          for (const row of sorted) {
            const sid = row.sectionId ?? 0;
            const k = `${sid}:${row.sectionPosition}`;
            if (!groups.has(k)) {
              keysOrder.push(k);
              groups.set(k, {
                title: sectionBlockDisplayTitle(
                  recipe.ingredientSectionRefs,
                  sectionCatalog,
                  sid,
                  row.sectionPosition
                ),
                sectionId: sid,
                sectionPosition: row.sectionPosition,
                lines: [],
                ids: [],
              });
            }
            const g = groups.get(k)!;
            g.lines.push(row.line);
            g.ids.push(row.ingredientId);
          }
          nextState.ingredientSections = keysOrder.map((k) => {
            const g = groups.get(k)!;
            return {
              key: newSectionKey(),
              title: g.title,
              lines: g.lines.join("\n"),
              sectionId: g.sectionId,
              sectionPosition: g.sectionPosition,
              ingredientIds: g.ids,
            };
          });
        } else {
          nextState.ingredientSections = [
            {
              key: newSectionKey(),
              title: "",
              lines: recipe.ingredients.join("\n"),
              sectionId: 0,
              sectionPosition: 0,
              ingredientIds: undefined,
            },
          ];
        }
        dispatchForm({ type: "hydrate", state: nextState });
        setEditHydrated(true);
      } catch (e) {
        if (!cancelled) {
          showAlert(
            "Could not load recipe",
            getErrorMessage(e, "Recipe not found or the server is unreachable.")
          );
          setEditHydrated(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editIdNum, showAlert]); // eslint-disable-line react-hooks/exhaustive-deps -- titles from `ingredient_section_refs`; omit `sectionCatalog` to avoid re-fetch on catalog load

  const androidScreenTheme = useMemo(() => {
    if (!isAndroid) return theme;

    const scaledFonts = Object.fromEntries(
      Object.entries(theme.fonts).map(([key, token]) => {
        const t = token as { fontSize?: number; lineHeight?: number };
        return [
          key,
          {
            ...token,
            ...(typeof t.fontSize === "number"
              ? { fontSize: Math.round(t.fontSize * 1.16) }
              : {}),
            ...(typeof t.lineHeight === "number"
              ? { lineHeight: Math.round(t.lineHeight * 1.16) }
              : {}),
          },
        ];
      })
    ) as typeof theme.fonts;

    return { ...theme, fonts: scaledFonts };
  }, [isAndroid, theme]);

  /** Picker list: DB categories + not-yet-saved names typed on this screen. */
  const categoryListLabels = useMemo(() => {
    const byLower = new Map<string, string>();
    for (const c of categoryRows) {
      byLower.set(c.name.toLowerCase(), c.name);
    }
    for (const n of selectedCategoryNames) {
      const t = n.trim();
      if (!t) continue;
      const k = t.toLowerCase();
      if (!byLower.has(k)) byLower.set(k, t);
    }
    return Array.from(byLower.values()).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" })
    );
  }, [categoryRows, selectedCategoryNames]);

  const categoryMenuItems = useMemo(
    () =>
      categoryListLabels.map((label) => ({
        key: label.toLowerCase(),
        label,
      })),
    [categoryListLabels]
  );

  const categoryFieldSummary =
    selectedCategoryNames.length === 0
      ? ""
      : selectedCategoryNames.join(", ");

  const knownSectionTitles = useMemo(() => {
    const set = new Set<string>(DEFAULT_SECTION_PRESETS);
    for (const s of ingredientSections) {
      const t = s.title.trim();
      if (t) set.add(t);
    }
    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" })
    );
  }, [ingredientSections]);

  function updateIngredientSection(
    key: string,
    patch: Partial<
      Pick<
        IngredientSectionDraft,
        "title" | "lines" | "ingredientIds" | "sectionId" | "sectionPosition"
      >
    >
  ) {
    dispatchForm({
      type: "setIngredientSections",
      updater: (prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)),
    });
  }

  function removeIngredientSection(key: string) {
    dispatchForm({
      type: "setIngredientSections",
      updater: (prev) => (prev.length <= 1 ? prev : prev.filter((s) => s.key !== key)),
    });
  }

  function appendSectionWithTitle(sectionTitle: string) {
    const t = sectionTitle.trim();
    if (!t) return;
    dispatchForm({
      type: "setIngredientSections",
      updater: (prev) => {
        const nextPos =
          prev.length === 0
            ? 0
            : Math.max(...prev.map((s) => s.sectionPosition)) + 1;
        const sid = sectionIdForTitle(
          t,
          sectionCatalog,
          prev.map((s) => s.sectionId)
        );
        return [
          ...prev,
          {
            key: newSectionKey(),
            title: t,
            lines: "",
            sectionId: sid,
            sectionPosition: nextPos,
          },
        ];
      },
    });
    dispatchForm({ type: "patch", patch: { sectionModalOpen: false, customSectionName: "" } });
  }

  function closeSectionModal() {
    dispatchForm({ type: "patch", patch: { sectionModalOpen: false, customSectionName: "" } });
  }

  return (
    <PaperProvider theme={androidScreenTheme}>
      <View className="flex-1" style={{ backgroundColor: theme.colors.background }}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="p-4"
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        <Text variant="titleMedium" className="mb-3">
          {editIdNum != null ? "Edit recipe" : "Let's add a new one!"}
        </Text>
        <TextInput
          mode="outlined"
          label="Title"
          value={title}
          onChangeText={(value) => dispatchForm({ type: "patch", patch: { title: value } })}
          className="mb-2"
          style={fieldBackground}
        />
        <TextInput
          mode="outlined"
          label="Description (optional)"
          value={description}
          onChangeText={(value) => dispatchForm({ type: "patch", patch: { description: value } })}
          multiline
          numberOfLines={3}
          className="mb-2"
          style={fieldBackground}
        />
        <Text variant="labelLarge" className="mb-2" style={{ marginTop: 4 }}>
          Ingredients by section
        </Text>
        <Text
          variant="bodySmall"
          className="mb-2"
          style={{ opacity: 0.75, marginTop: -4 }}
        >
          One ingredient per line in each section. Add more sections below.
        </Text>
        {ingredientSections.map((sec) => (
          <View
            key={sec.key}
            style={[
              styles.sectionCard,
              { borderColor: theme.colors.outlineVariant },
            ]}
          >
            <TextInput
              mode="outlined"
              dense
              label="Section name (optional)"
              placeholder="Leave blank if you only need one block"
              value={sec.title}
              onChangeText={(t) =>
                updateIngredientSection(sec.key, {
                  title: t,
                  sectionId: sectionIdForTitle(
                    t,
                    sectionCatalog,
                    ingredientSections
                      .filter((s) => s.key !== sec.key)
                      .map((s) => s.sectionId)
                  ),
                  ingredientIds: undefined,
                })
              }
              className="mb-2"
              style={fieldBackground}
            />
            <TextInput
              mode="outlined"
              label="Ingredients (one per line)"
              placeholder={
                "2 cup all-purpose flour\n1 tbsp baking powder\nsalt"
              }
              value={sec.lines}
              onChangeText={(t) =>
                updateIngredientSection(sec.key, {
                  lines: t,
                  ingredientIds: undefined,
                })
              }
              multiline
              numberOfLines={5}
              className="mb-2"
              style={fieldBackground}
            />
            {ingredientSections.length > 1 ? (
              <AppButton
                mode="text"
                compact
                color={COLORS.darkRed}
                onPress={() => removeIngredientSection(sec.key)}
                style={{ alignSelf: "flex-start" }}
              >
                Remove section
              </AppButton>
            ) : null}
          </View>
        ))}
        <AppButton
          mode="text"
          compact
          color={COLORS.lightBlue}
          onPress={() => dispatchForm({ type: "patch", patch: { sectionModalOpen: true } })}
          style={{ marginBottom: 12, alignSelf: "flex-start" }}
        >
          Add new section below
        </AppButton>
        <TextInput
          mode="outlined"
          label="Directions"
          value={directions}
          onChangeText={(value) => dispatchForm({ type: "patch", patch: { directions: value } })}
          multiline
          numberOfLines={8}
          className="mb-2"
          style={fieldBackground}
        />
        <Text variant="labelLarge" className="mb-2" style={{ marginTop: 4 }}>
          Categories (optional)
        </Text>
        <Text variant="bodySmall" className="mb-2" style={{ opacity: 0.8 }}>
          Tap the box or “Open category list”. Add new names with the field below
          if nothing is loaded from the server yet.
        </Text>
        <View className="mb-3">
          <View
            ref={(r) => {
              categoryMenu.anchorRef.current = r;
            }}
            collapsable={false}
            style={{ minHeight: 52 }}
          >
            <Pressable
              onPress={categoryMenu.openMenu}
              accessibilityRole="button"
              accessibilityLabel="Choose recipe categories"
              style={[
                styles.categoryFieldPressable,
                {
                  borderColor: theme.colors.outline,
                  backgroundColor: fieldBackground.backgroundColor,
                },
              ]}
            >
              <Text
                variant="bodyLarge"
                numberOfLines={4}
                style={{
                  color: categoryFieldSummary
                    ? theme.colors.onSurface
                    : theme.colors.outline,
                }}
              >
                {categoryFieldSummary ||
                  (categoryListLabels.length === 0
                    ? "None selected — tap to open list or add below"
                    : "None selected — tap to choose")}
              </Text>
            </Pressable>
          </View>
          <AppButton
            mode="text"
            compact
            color={COLORS.lightBlue}
            icon="tag-multiple-outline"
            style={{ alignSelf: "flex-start", marginTop: 6 }}
            onPress={categoryMenu.openMenu}
          >
            Open category list
          </AppButton>
          <MultiSelectDropdownMenu
            visible={categoryMenu.open}
            anchorRect={categoryMenu.anchorRect}
            items={categoryMenuItems}
            isSelected={(item) =>
              isCategorySelected(selectedCategoryNames, item.label)
            }
            onToggle={(item) =>
              dispatchForm({
                type: "setSelectedCategoryNames",
                updater: (prev) => toggleCategory(prev, item.label),
              })
            }
            onClose={categoryMenu.closeMenu}
            title="Categories"
            maxHeight={320}
            emptyListMessage="No categories in the list yet. Use “Add new category” below this section."
          />
        </View>
        <View
          className="flex-row gap-2 items-end mb-3"
          style={{ flexWrap: "wrap" }}
        >
          <View style={{ flex: 1, minWidth: 160 }}>
            <TextInput
              mode="outlined"
              label="Add new category"
              placeholder="e.g. Brunch or Desserts, Baking"
              value={newCategoryDraft}
              onChangeText={(value) =>
                dispatchForm({ type: "patch", patch: { newCategoryDraft: value } })
              }
              onSubmitEditing={() => {
                dispatchForm({
                  type: "setSelectedCategoryNames",
                  updater: (prev) => mergeNewCategoryNames(prev, newCategoryDraft),
                });
                dispatchForm({ type: "patch", patch: { newCategoryDraft: "" } });
              }}
              style={fieldBackground}
            />
          </View>
          <AppButton
            mode="text"
            compact
            color={COLORS.darkRed}
            style={{ marginBottom: 4 }}
            onPress={() => {
              dispatchForm({
                type: "setSelectedCategoryNames",
                updater: (prev) => mergeNewCategoryNames(prev, newCategoryDraft),
              });
              dispatchForm({ type: "patch", patch: { newCategoryDraft: "" } });
            }}
          >
            Add
          </AppButton>
        </View>
        <TextInput
          mode="outlined"
          label="Tags / keywords"
          placeholder="quick, meal-prep, weekend (comma-separated)"
          value={tags}
          onChangeText={(value) => dispatchForm({ type: "patch", patch: { tags: value } })}
          className="mb-2"
          style={fieldBackground}
        />
        <View style={styles.timeRow}>
          <TextInput
            mode="outlined"
            dense
            label="Prep time (min)"
            value={prepTimeMin}
            onChangeText={(value) => dispatchForm({ type: "patch", patch: { prepTimeMin: value } })}
            keyboardType="number-pad"
            style={[styles.timeField, fieldBackground]}
          />
          <TextInput
            mode="outlined"
            dense
            label="Cook time (min)"
            value={cookTimeMin}
            onChangeText={(value) => dispatchForm({ type: "patch", patch: { cookTimeMin: value } })}
            keyboardType="number-pad"
            style={[styles.timeField, fieldBackground]}
          />
        </View>
        <TextInput
          mode="outlined"
          label="Servings"
          value={servings}
          onChangeText={(value) => dispatchForm({ type: "patch", patch: { servings: value } })}
          keyboardType="decimal-pad"
          className="mb-2"
          style={fieldBackground}
        />
        <Text
          variant="labelLarge"
          className="mb-2"
          style={{ marginTop: 4 }}
        >
          Nutrition (optional, per serving)
        </Text>
        <View style={styles.macroRow}>
          <TextInput
            mode="outlined"
            dense
            label="Kcal"
            value={nutKcal}
            onChangeText={(value) => dispatchForm({ type: "patch", patch: { nutKcal: value } })}
            keyboardType="decimal-pad"
            style={[styles.macroField, fieldBackground]}
          />
          <TextInput
            mode="outlined"
            dense
            label="Protein (g)"
            value={nutProtein}
            onChangeText={(value) => dispatchForm({ type: "patch", patch: { nutProtein: value } })}
            keyboardType="decimal-pad"
            style={[styles.macroField, fieldBackground]}
          />
          <TextInput
            mode="outlined"
            dense
            label="Carbs (g)"
            value={nutCarbs}
            onChangeText={(value) => dispatchForm({ type: "patch", patch: { nutCarbs: value } })}
            keyboardType="decimal-pad"
            style={[styles.macroField, fieldBackground]}
          />
          <TextInput
            mode="outlined"
            dense
            label="Fat (g)"
            value={nutFat}
            onChangeText={(value) => dispatchForm({ type: "patch", patch: { nutFat: value } })}
            keyboardType="decimal-pad"
            style={[styles.macroField, fieldBackground]}
          />
        </View>
        <TextInput
          mode="outlined"
          label="Original recipe URL"
          placeholder="https://example.com/recipe"
          value={sourceUrl}
          onChangeText={(value) => dispatchForm({ type: "patch", patch: { sourceUrl: value } })}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          className="mb-8"
          style={fieldBackground}
        />
      </ScrollView>
      <View
        style={[
          styles.actionBar,
          {
            paddingBottom: Math.max(insets.bottom, 12),
            borderTopColor: theme.colors.outlineVariant,
            backgroundColor: theme.colors.background,
          },
        ]}
      >
        <AppButton
          icon="image"
          compact
          color={COLORS.lightBlue}
          style={{ minWidth: 168, flexShrink: 0 }}
          onPress={async () => {
            try {
              const p = await pickImagePayload();
              if (!p) {
                dispatchForm({
                  type: "patch",
                  patch: { pickedLabel: null, imagePayload: null },
                });
                return;
              }
              dispatchForm({
                type: "patch",
                patch: { imagePayload: p, pickedLabel: "Photo attached" },
              });
            } catch (e) {
              showAlert(
                "Photo",
                getErrorMessage(e, "Could not read the selected image.")
              );
            }
          }}
        >
          {pickedLabel ?? "Choose picture"}
        </AppButton>
        <AppButton
          color={saveUi === "saved" ? COLORS.accent : COLORS.brightGreen}
          loading={busy}
          disabled={busy || !editHydrated || saveUi === "saved"}
          style={{ minWidth: 120, flexShrink: 0 }}
          onPress={async () => {
            setSaveUi("idle");
            if (!editHydrated) {
              showAlert(
                "Please wait",
                "Recipe details are still loading. Try again in a moment."
              );
              return;
            }
            const t = title.trim();
            if (!t) {
              showAlert("Missing title", "Title is required.");
              return;
            }
            const ingredients_detail: WireRecipeIngredientLineCreate[] = [];
            for (const sec of ingredientSections) {
              const parts = sec.lines
                .split(/\r?\n/)
                .map((l) => l.trim())
                .filter(Boolean);
              const st = sec.title.trim();
              const sectionTitleWire =
                sec.sectionId === 0 ? undefined : st || undefined;
              parts.forEach((line, i) => {
                const row: WireRecipeIngredientLineCreate = {
                  line,
                  section_id: sec.sectionId,
                  section_position: sec.sectionPosition,
                  position: i,
                  section_title: sectionTitleWire,
                };
                if (editIdNum != null) {
                  row.recipe_id = editIdNum;
                  const iid = sec.ingredientIds?.[i];
                  if (iid != null) row.ingredient_id = iid;
                }
                ingredients_detail.push(row);
              });
            }
            const ingredientArray = ingredients_detail.map((d) => d.line);
            if (ingredientArray.length === 0) {
              showAlert("Ingredients", "Add at least one ingredient line.");
              return;
            }
            const n = parseFloat(servings);
            if (!Number.isFinite(n) || n <= 0) {
              showAlert("Servings", "Servings must be a positive number.");
              return;
            }
            if (
              prepTimeMin.trim() &&
              parseOptionalNonNegativeInt(prepTimeMin) === null
            ) {
              showAlert(
                "Prep time",
                "Prep time must be a whole number (minutes) ≥ 0, or leave blank."
              );
              return;
            }
            if (
              cookTimeMin.trim() &&
              parseOptionalNonNegativeInt(cookTimeMin) === null
            ) {
              showAlert(
                "Cook time",
                "Cook time must be a whole number (minutes) ≥ 0, or leave blank."
              );
              return;
            }
            const macroFields = [
              { raw: nutKcal, label: "Kcal" },
              { raw: nutProtein, label: "Protein" },
              { raw: nutCarbs, label: "Carbs" },
              { raw: nutFat, label: "Fat" },
            ];
            for (const { raw, label } of macroFields) {
              if (raw.trim() && parseOptionalNonNegativeNumber(raw) === null) {
                showAlert(
                  label,
                  `${label} must be a number ≥ 0, or leave blank.`
                );
                return;
              }
            }
            const prepM = parseOptionalNonNegativeInt(prepTimeMin);
            const cookM = parseOptionalNonNegativeInt(cookTimeMin);
            const kcalN = parseOptionalNonNegativeNumber(nutKcal);
            const pN = parseOptionalNonNegativeNumber(nutProtein);
            const cN = parseOptionalNonNegativeNumber(nutCarbs);
            const fN = parseOptionalNonNegativeNumber(nutFat);
            const nutrition =
              kcalN != null || pN != null || cN != null || fN != null
                ? {
                    ...(kcalN != null ? { kcal: kcalN } : {}),
                    ...(pN != null ? { protein_g: pN } : {}),
                    ...(cN != null ? { carbs_g: cN } : {}),
                    ...(fN != null ? { fat_g: fN } : {}),
                  }
                : null;
            const categoriesToSave = selectedCategoryNames
              .map((c) => c.trim())
              .filter(Boolean);
            setBusy(true);
            try {
              const descTrim = description.trim();
              const payload = {
                title: t,
                directions: directions.trim(),
                ingredients: ingredientArray,
                ingredients_detail,
                category_ids: [],
                categories: categoriesToSave,
                tags: splitTags(tags),
                servings: n,
                sourceUrl: sourceUrl.trim() || null,
                description: descTrim ? descTrim : null,
                image_base64: imagePayload?.base64 ?? null,
                image_mime: imagePayload?.mime ?? null,
                prep_time_min: prepM,
                cook_time_min: cookM,
                nutrition,
              };

              if (editIdNum != null) {
                await replaceRecipeOnApi(editIdNum, payload);
              } else {
                await createRecipeOnApi(payload);
              }

              const syncWarnings: string[] = [];
              void queryClient.invalidateQueries({ queryKey: queryKeys.categories });
              void queryClient.invalidateQueries({ queryKey: queryKeys.recipes });
              if (syncWarnings.length > 0) {
                showAlert("Saved with warnings", syncWarnings.join("\n\n"));
              }

              setSaveUi("saved");
              setBusy(false);
              const navDelayMs = syncWarnings.length > 0 ? 2200 : 900;
              setTimeout(() => {
                if (editIdNum != null) {
                  router.replace({
                    pathname: "/recipe/[id]",
                    params: {
                      id: String(editIdNum),
                      ...(returnCategoryStr
                        ? { category: returnCategoryStr }
                        : {}),
                    },
                  });
                } else {
                  router.replace("/recipes");
                }
                setSaveUi("idle");
              }, navDelayMs);
            } catch (e) {
              setBusy(false);
              showAlert(
                "Could not save",
                getErrorMessage(
                  e,
                  "Could not save. Is the backend running on EXPO_PUBLIC_API_URL?"
                )
              );
            }
          }}
        >
          {saveUi === "saved"
            ? "Saved"
            : editIdNum != null
              ? "Save changes"
              : "Save"}
        </AppButton>
      </View>
      <CenterAlertModal
        visible={alertModal.visible}
        title={alertModal.title}
        message={alertModal.message}
        onConfirm={dismissAlert}
      />

      <Modal
        visible={sectionModalOpen}
        animationType="fade"
        transparent
        onRequestClose={closeSectionModal}
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={closeSectionModal}
            accessibilityLabel="Dismiss"
          />
          <View
            style={[
              styles.modalSheet,
              { backgroundColor: theme.colors.surface },
            ]}
          >
            <Text variant="titleSmall" style={styles.modalTitle}>
              Choose section name
            </Text>
            <ScrollView
              style={styles.modalScroll}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
            >
              {knownSectionTitles.map((name) => (
                <Pressable
                  key={name}
                  onPress={() => appendSectionWithTitle(name)}
                  style={({ pressed }) => [
                    styles.modalRow,
                    { opacity: pressed ? 0.65 : 1 },
                  ]}
                >
                  <Text variant="bodyLarge">{name}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <TextInput
              mode="outlined"
              label="Custom section name"
              value={customSectionName}
              onChangeText={(value) =>
                dispatchForm({ type: "patch", patch: { customSectionName: value } })
              }
              onSubmitEditing={() => appendSectionWithTitle(customSectionName)}
              className="mt-2 mb-2"
              style={fieldBackground}
            />
            <View style={styles.modalActions}>
              <AppButton mode="text" onPress={closeSectionModal}>
                Cancel
              </AppButton>
              <AppButton
                color={COLORS.brightGreen}
                onPress={() => appendSectionWithTitle(customSectionName)}
              >
                Add custom
              </AppButton>
            </View>
          </View>
        </View>
      </Modal>
      </View>
    </PaperProvider>
  );
}

const styles = StyleSheet.create({
  categoryFieldPressable: {
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 4,
    borderWidth: 1,
    justifyContent: "center",
  },
  sectionCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  modalRoot: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  modalSheet: {
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
    borderRadius: 14,
    padding: 16,
    maxHeight: "80%",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  modalTitle: {
    marginBottom: 10,
  },
  modalScroll: {
    maxHeight: 280,
    marginBottom: 8,
  },
  modalRow: {
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.08)",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  timeRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },
  timeField: {
    flex: 1,
    minWidth: 120,
  },
  macroRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  macroField: {
    flexGrow: 1,
    flexBasis: "22%",
    minWidth: 76,
  },
  actionBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    paddingTop: 12,
    paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
