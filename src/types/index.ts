/** Recipe lifecycle in the meal-planning flow */
export type RecipeStatus = "library" | "planned";

/** All macro values are **per one serving** (same basis as the servings field on the recipe). */
export type RecipeNutrition = {
  kcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  /** kcal per 100g of finished dish, if known */
  per100gKcal?: number | null;
};

/** Recipe taxonomy — many-to-many in DB (`recipe_categories` join row + category). */
export type RecipeCategoryRef = {
  /** Surrogate id of the `recipe_categories` row for this recipe↔category link. */
  linkId: number;
  id: number;
  name: string;
};

/** Matches GET `/recipes` `ingredients_detail` (camelCase in app state). */
export type RecipeIngredientDetail = {
  line: string;
  ingredientId: number;
  recipeId: number;
  sectionId: number | null;
  sectionPosition: number;
  position: number;
  sectionTitle: string | null;
};

/** Per-recipe section blocks; titles are not duplicated on each ingredient line. */
export type RecipeIngredientSectionRef = {
  sectionId: number | null;
  sectionPosition: number;
  title: string;
};

export type Recipe = {
  id: number;
  userId: string;
  title: string;
  description: string | null;
  directions: string | null;
  notes: string | null;
  imageUrl: string | null;
  sourceUrl: string | null;
  /** Primary category label (first linked category); never null — empty string if none */
  category: string;
  /** All linked categories from API */
  categories: RecipeCategoryRef[];
  keywords: string[];
  prepTimeMin: number | null;
  cookTimeMin: number | null;
  servings: number;
  status: RecipeStatus;
  /** One entry per ingredient line (canonical JSON array from API). */
  ingredients: string[];
  /** Structured rows when the API returns `ingredients_detail`. */
  ingredientsDetail?: RecipeIngredientDetail[];
  /** Section titles keyed by `(sectionId, sectionPosition)` for this recipe. */
  ingredientSectionRefs?: RecipeIngredientSectionRef[];
  nutrition: RecipeNutrition | null;
  createdAt: string;
};

export type ShoppingListStatus = "active" | "saved";

export type ShoppingList = {
  id: string;
  userId: string;
  name: string | null;
  status: ShoppingListStatus;
  /** When the list was archived (ISO timestamp). */
  savedAt: string | null;
  /** User-chosen shopping day, local calendar date as YYYY-MM-DD. */
  listDate: string | null;
  createdAt: string;
  sourceListId?: string | null;
};

export type ShoppingListItem = {
  id: string;
  shoppingListId: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  category: string | null;
  checked: boolean;
  sourceRecipeId: number | null;
  /** Recipe ingredient row id — avoids duplicate lines when re-adding from same recipe */
  sourceIngredientId?: number | null;
  sourceRecipeTitle?: string | null;
  isManual: boolean;
  position: number;
};
