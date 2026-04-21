/**
 * Canonical JSON wire types for the FastAPI API (snake_case on the wire).
 *
 * Source of truth: `backend/app/schemas.py`, `backend/app/recipe_db_service.py`
 * (`recipe_row_to_api`), and `backend/app/shopping_db_service.py`.
 *
 * When the backend ships a committed `openapi.json`, prefer `openapi-typescript`
 * and replace/extend this module from generated output.
 */

import type { RecipeStatus } from "@/types";

/**
 * `nutrition_json` decoded; known keys match `NutritionIn` / UI mapping.
 * Values are **per one serving** (not multiplied by recipe servings).
 */
export type WireRecipeNutrition = {
  kcal?: number | null;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
  per_100g_kcal?: number | null;
};

/** `link_id` = `recipe_categories.id` (stable join row); `id` = `categories.id`. */
export type WireRecipeCategory = {
  link_id: number;
  id: number;
  name: string;
};

/** Catalog section used by this recipe (GET); titles are not repeated per line. */
export type WireIngredientSectionRef = {
  section_id: number | null;
  section_position: number;
  title: string;
};

/** One ingredient line (GET); join `ingredient_section_refs` for section titles. */
export type WireRecipeIngredientDetail = {
  line: string;
  ingredient_id: number;
  section_id: number | null;
  section_position: number;
  position: number;
  /** Legacy API only — prefer `ingredient_section_refs` + `recipe.id`. */
  recipe_id?: number;
  section_title?: string | null;
};

/** Single recipe as returned by GET/POST/PUT/PATCH `/recipes` handlers. */
export type WireRecipe = {
  id: number;
  user_id: string;
  title: string;
  description: string | null;
  directions: string | null;
  notes: string | null;
  image_url: string | null;
  source_url: string | null;
  category: string | null;
  categories?: WireRecipeCategory[];
  keywords: string[];
  prep_time_min: number | null;
  cook_time_min: number | null;
  servings: number;
  status: RecipeStatus;
  created_at: string;
  nutrition: WireRecipeNutrition | null;
  ingredients: string[];
  ingredient_section_refs?: WireIngredientSectionRef[];
  ingredients_detail?: WireRecipeIngredientDetail[];
};

export type WireRecipesListResponse = { recipes: WireRecipe[] };

export type WireCategory = { id: number; name: string };

export type WireCategoriesListResponse = { categories: WireCategory[] };

export type WireShoppingList = {
  id: string;
  user_id: string;
  name: string | null;
  status: "active" | "saved";
  saved_at: string | null;
  list_date: string | null;
  created_at: string;
};

export type WireShoppingItem = {
  id: string;
  shopping_list_id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  category: string | null;
  checked: boolean;
  source_recipe_id: number | null;
  source_ingredient_id: number | null;
  source_recipe_title: string | null;
  is_manual: boolean;
  position: number;
};

export type WireShoppingSnapshot = {
  list: WireShoppingList;
  items: WireShoppingItem[];
};

export type WireShoppingState = {
  active_list: WireShoppingList;
  items: WireShoppingItem[];
  saved_snapshots: WireShoppingSnapshot[];
};

/** Mirrors `DedupeItem` / dedupe endpoint line shape. */
export type WireDedupeItem = {
  name: string;
  quantity: number | null;
  unit: string | null;
  category: string | null;
  source_recipe_id: number | null;
};

export type WireDedupeResponse = {
  items: WireDedupeItem[];
  merged_count: number;
};

/** Mirrors `ConvertResponse`. */
export type WireConvertResponse = {
  quantity: number;
  unit: string;
  method: string;
};

/** One line when using structured `ingredients_detail` (POST/PUT `/recipes`). */
export type WireRecipeIngredientLineCreate = {
  line: string;
  section_id: number;
  section_position?: number;
  position?: number;
  ingredient_id?: number | null;
  recipe_id?: number | null;
  section_title?: string | null;
};

/** Mirrors `RecipeCreateBody` fields sent as JSON (POST/PUT `/recipes`). */
export type WireRecipeCreateBody = {
  title: string;
  directions: string | null;
  ingredients: string[];
  ingredients_detail?: WireRecipeIngredientLineCreate[];
  ingredient_sections?: { title: string; ingredients: string }[];
  tags: string[];
  categories: string[];
  category_ids: number[];
  servings: number;
  source_url: string | null;
  description: string | null;
  image_base64: string | null;
  image_mime: string | null;
  prep_time_min: number | null;
  cook_time_min: number | null;
  nutrition: WireRecipeNutrition | null;
};
