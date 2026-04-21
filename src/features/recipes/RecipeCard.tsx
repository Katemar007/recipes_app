import { Link } from "expo-router";
import type { Href } from "expo-router";
import { useState, type ReactNode } from "react";
import { Pressable, View, type StyleProp, type ViewStyle } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text, useTheme } from "react-native-paper";
import { PlannedToggleButton } from "@/components/ui/AppButton";
import { Card } from "@/components/ui/Card";
import { RecipeRemoteImage } from "./RecipeRemoteImage";
import {
  useCategoriesQuery,
  useUpdateRecipeStatusMutation,
} from "@/hooks/api/useServerState";
import {
  categoryPreviewLine,
  filterLinkedCategories,
  primaryCategoryLabel,
  validCategoryIds,
} from "@/lib/recipeCategories";
import { isWeb } from "@/lib/device";
import { webMouseHandlers, webPointerCursorStyle } from "@/lib/webPressable";
import { COLORS } from "@/theme";
import type { Recipe } from "@/types";
import { RecipeImagePlaceholder } from "./RecipeImagePlaceholder";

export type RecipeCardVariant = "grid" | "featured";

/** Grid image area: height follows column width (responsive). ~16:9 */
const GRID_IMAGE_ASPECT_RATIO = 16 / 9;

type Props = {
  recipe: Recipe;
  href?: Href;
  variant?: RecipeCardVariant;
  style?: StyleProp<ViewStyle>;
  /** When set, replaces the default planned toggle. */
  topRightAction?: ReactNode;
  /**
   * When true (default), shows add/remove planned control like on Recipes.
   * Ignored if `topRightAction` is passed.
   */
  showPlannedToggle?: boolean;
};

function formatTotalActiveMinutes(r: Recipe): string {
  const p = r.prepTimeMin ?? 0;
  const c = r.cookTimeMin ?? 0;
  const t = p + c;
  if (t <= 0) return "—";
  return `${t} min`;
}

/** Nutrition kcal is stored per one serving (as entered). */
function formatKcal(r: Recipe): string {
  const k = r.nutrition?.kcal;
  if (k == null || !Number.isFinite(k)) return "—";
  return `~${Math.round(k)} kcal/serving`;
}

function previewText(recipe: Recipe): string {
  const source = (recipe.description ?? recipe.directions ?? "").trim();
  if (!source) return "Simple, tasty, and easy to cook at home.";
  return source.length > 110 ? `${source.slice(0, 107)}...` : source;
}

export function RecipeCard({
  recipe,
  href,
  variant = "grid",
  style,
  topRightAction,
  showPlannedToggle = true,
}: Props) {
  const theme = useTheme();
  const moveRecipeStatus = useUpdateRecipeStatusMutation();
  const { data: categoryDirectory = [], isSuccess: categoriesHydrated } =
    useCategoriesQuery();
  const [hovered, setHovered] = useState(false);
  const linkHref = href ?? `/recipe/${recipe.id}`;
  const timeLine = formatTotalActiveMinutes(recipe);
  const kcalLine = formatKcal(recipe);
  const active = isWeb && hovered;
  const filteredCats = filterLinkedCategories(
    recipe,
    validCategoryIds(categoryDirectory, categoriesHydrated)
  );
  const categoryLine = categoryPreviewLine(
    recipe,
    filteredCats,
    categoryDirectory,
    categoriesHydrated
  );
  const featuredCategoryLabel =
    primaryCategoryLabel(
      recipe,
      filteredCats,
      categoryDirectory,
      categoriesHydrated
    ) || "Recipe";

  const resolvedTopRight =
    topRightAction ??
    (showPlannedToggle ? (
      <PlannedToggleButton
        planned={recipe.status === "planned"}
        onToggle={(e) => {
          e.stopPropagation();
          moveRecipeStatus.mutate({
              id: recipe.id,
              status: recipe.status === "planned" ? "library" : "planned",
            });
        }}
      />
    ) : null);

  const outerStyle: StyleProp<ViewStyle> = [{ width: "100%" }, style];

  const outerClassName = undefined;

  const webHoverProps = webMouseHandlers(
    () => setHovered(true),
    () => setHovered(false)
  );

  return (
    <View className={outerClassName} style={outerStyle} {...webHoverProps}>
      <Link href={linkHref} asChild>
        <Pressable
          accessibilityRole="link"
          style={webPointerCursorStyle ?? undefined}
        >
          <Card
            active={active}
            className="overflow-visible"
            style={
              active
                ? {
                    borderWidth: 2.5,
                    shadowColor: COLORS.accent,
                    shadowOpacity: 0.5,
                    shadowRadius: 22,
                    shadowOffset: { width: 0, height: 10 },
                  }
                : undefined
            }
          >
            {variant === "featured" ? (
              <View style={{ borderRadius: 14, overflow: "hidden" }}>
                <RecipeRemoteImage
                  imageUrl={recipe.imageUrl}
                  style={{
                    width: "100%",
                    height: 215,
                    backgroundColor: theme.colors.surfaceVariant,
                  }}
                  resizeMode="cover"
                  placeholder={<RecipeImagePlaceholder variant="hero" height={215} />}
                />
                <View style={{ padding: 14 }}>
                  <View
                    style={{
                      paddingLeft: 12,
                      borderLeftWidth: 5,
                      borderLeftColor: active ? COLORS.accent : "transparent",
                    }}
                  >
                    <Text
                      variant="labelMedium"
                      style={{
                        opacity: active ? 0.9 : 0.65,
                        marginBottom: 4,
                        color: active ? COLORS.hoverText : undefined,
                      }}
                    >
                      {featuredCategoryLabel}
                    </Text>
                    <Text
                      variant="headlineSmall"
                      numberOfLines={2}
                      style={{ color: active ? COLORS.hoverText : undefined }}
                    >
                      {recipe.title}
                    </Text>
                    <Text
                      variant="bodyLarge"
                      numberOfLines={2}
                      style={{ opacity: active ? 0.98 : 0.82, marginTop: 6 }}
                    >
                      {previewText(recipe)}
                    </Text>
                    <Text
                      variant="bodyMedium"
                      style={{
                        opacity: 0.8,
                        marginTop: 10,
                        color: active ? COLORS.hoverText : undefined,
                      }}
                    >
                      <MaterialCommunityIcons
                        name="clock-outline"
                        size={14}
                        color={
                          active ? COLORS.hoverText : theme.colors.onSurfaceVariant
                        }
                      />{" "}
                      {timeLine} ·{" "}
                      <MaterialCommunityIcons
                        name="fire"
                        size={14}
                        color={
                          active ? COLORS.hoverText : theme.colors.onSurfaceVariant
                        }
                      />{" "}
                      {kcalLine}
                    </Text>
                  </View>
                </View>
              </View>
            ) : (
              <View style={{ borderRadius: 14, overflow: "hidden" }}>
                <RecipeRemoteImage
                  imageUrl={recipe.imageUrl}
                  style={{
                    width: "100%",
                    aspectRatio: GRID_IMAGE_ASPECT_RATIO,
                    backgroundColor: theme.colors.surfaceVariant,
                  }}
                  resizeMode="cover"
                  placeholder={
                    <RecipeImagePlaceholder
                      variant="card"
                      aspectRatio={GRID_IMAGE_ASPECT_RATIO}
                    />
                  }
                />

                <View
                  className="px-4 pt-3 pb-2 bg-transparent"
                  style={{
                    borderLeftWidth: 5,
                    borderLeftColor: active ? COLORS.accent : "transparent",
                    minHeight: 56,
                  }}
                >
                  <Text
                    variant="titleMedium"
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={{
                      color: active ? COLORS.hoverText : COLORS.textPrimary,
                      fontWeight: "600",
                    }}
                  >
                    {recipe.title}
                  </Text>
                  <Text
                    variant="bodyLarge"
                    numberOfLines={1}
                    className="mt-2"
                    style={{
                      color: active ? COLORS.hoverText : COLORS.textSecondary,
                    }}
                  >
                    {categoryLine}
                  </Text>
                </View>

                <View className="px-4 pb-3">
                  <Text
                    variant="bodyMedium"
                    style={{
                      color: theme.colors.primary,
                      fontWeight: "600",
                    }}
                  >
                    {timeLine} · {kcalLine}
                  </Text>
                </View>
              </View>
            )}
          </Card>
        </Pressable>
      </Link>
      {resolvedTopRight ? (
        <View
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            zIndex: 30,
          }}
        >
          {resolvedTopRight}
        </View>
      ) : null}
    </View>
  );
}
