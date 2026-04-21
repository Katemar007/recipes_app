import { API_BASE_URL } from "@/config/env";
import type {
  Recipe,
  RecipeCategoryRef,
  RecipeIngredientDetail,
  RecipeIngredientSectionRef,
  RecipeNutrition,
  RecipeStatus,
} from "@/types";
import { apiFetch } from "./client";
import type {
  WireIngredientSectionRef,
  WireRecipe,
  WireRecipeCreateBody,
  WireRecipeIngredientDetail,
  WireRecipeIngredientLineCreate,
  WireRecipeNutrition,
  WireRecipesListResponse,
} from "./wire";

/**
 * DB may store `http://localhost:8000/...` while the app uses `EXPO_PUBLIC_API_URL`
 * (LAN IP, different host). Rebase localhost/127.0.0.1 onto API_BASE_URL on every platform.
 */
function rebaseLocalhostImageUrl(absoluteUrl: string): string {
  try {
    const u = new URL(absoluteUrl);
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") {
      const base = new URL(API_BASE_URL);
      u.protocol = base.protocol;
      u.hostname = base.hostname;
      u.port = base.port;
      return u.toString();
    }
  } catch {
    // Fall back to original URL.
  }
  return absoluteUrl;
}

/** Turn `/static/...` or absolute URLs into a fetchable URI for <Image />. */
export function recipeImageUri(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null;
  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    return rebaseLocalhostImageUrl(imageUrl);
  }
  if (imageUrl.startsWith("/")) {
    return `${API_BASE_URL}${imageUrl}`;
  }
  return `${API_BASE_URL}/${imageUrl}`;
}

export type ApiRecipeNutrition = WireRecipeNutrition;
export type ApiRecipe = WireRecipe;

function mapIngredientSectionRefs(
  rows: WireIngredientSectionRef[] | undefined
): RecipeIngredientSectionRef[] | undefined {
  if (!rows?.length) return undefined;
  return rows.map((x) => {
    let title = x.title ?? "";
    const sid = x.section_id;
    if ((sid ?? 0) === 0) {
      const c = title.trim().toLowerCase();
      if (!c || c === "ingredients") title = "";
    }
    return {
      sectionId: x.section_id,
      sectionPosition: x.section_position,
      title,
    };
  });
}

function mapIngredientDetailRow(
  r: WireRecipeIngredientDetail,
  recipeId: number,
  sectionRefs: RecipeIngredientSectionRef[] | undefined
): RecipeIngredientDetail {
  const sid = r.section_id;
  const sp = r.section_position;
  const refTitle = sectionRefs?.find(
    (x) => x.sectionId === sid && x.sectionPosition === sp
  )?.title;
  const legacyTitle = r.section_title?.trim();
  let title = legacyTitle || refTitle?.trim() || null;
  if ((sid ?? 0) === 0) {
    const c = (title || "").trim().toLowerCase();
    if (!c || c === "ingredients") title = null;
  }
  return {
    line: r.line,
    ingredientId: r.ingredient_id,
    recipeId: r.recipe_id ?? recipeId,
    sectionId: r.section_id,
    sectionPosition: r.section_position,
    position: r.position,
    sectionTitle: title,
  };
}

function mapNutrition(n: WireRecipeNutrition | null): RecipeNutrition | null {
  if (!n || Object.keys(n).length === 0) return null;
  return {
    kcal: n.kcal ?? null,
    proteinG: n.protein_g ?? null,
    carbsG: n.carbs_g ?? null,
    fatG: n.fat_g ?? null,
    per100gKcal: n.per_100g_kcal ?? null,
  };
}

export function mapApiRecipeToRecipe(raw: WireRecipe): Recipe {
  const ingredients = [...(raw.ingredients ?? [])]
    .map((s) => String(s).trim())
    .filter(Boolean);

  const cats: RecipeCategoryRef[] = (raw.categories ?? []).map((c) => ({
    linkId: c.link_id,
    id: c.id,
    name: c.name,
  }));

  const ingredientSectionRefs = mapIngredientSectionRefs(
    raw.ingredient_section_refs
  );

  const ingredientsDetail =
    raw.ingredients_detail && raw.ingredients_detail.length > 0
      ? raw.ingredients_detail.map((row) =>
          mapIngredientDetailRow(row, raw.id, ingredientSectionRefs)
        )
      : undefined;

  return {
    id: raw.id,
    userId: raw.user_id,
    title: raw.title,
    description: raw.description,
    directions: raw.directions,
    notes: raw.notes,
    imageUrl: raw.image_url,
    sourceUrl: raw.source_url,
    category: raw.category ?? "",
    categories: cats,
    keywords: raw.keywords ?? [],
    prepTimeMin: raw.prep_time_min,
    cookTimeMin: raw.cook_time_min,
    servings: raw.servings,
    status: raw.status,
    ingredients,
    ingredientsDetail,
    ingredientSectionRefs,
    nutrition: mapNutrition(raw.nutrition),
    createdAt: raw.created_at,
  };
}

export async function fetchRecipesFromApi(): Promise<Recipe[]> {
  const res = await apiFetch<WireRecipesListResponse>("/recipes");
  return res.recipes.map(mapApiRecipeToRecipe);
}

export type ApiIngredientSection = { id: number; title: string };

export async function fetchIngredientSectionsCatalog(): Promise<
  ApiIngredientSection[]
> {
  const res = await apiFetch<{ sections: ApiIngredientSection[] }>(
    "/ingredient-sections"
  );
  return res.sections;
}

export type CreateRecipeNutritionPayload = {
  kcal?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
};

export type CreateRecipePayload = {
  title: string;
  directions: string;
  ingredients: string[];
  /**
   * When set, the API uses these rows (`section_id`, positions, optional `ingredient_id`)
   * instead of inferring sections from plain strings. On edit, include `recipe_id` when
   * sending stable `ingredient_id`s.
   */
  ingredients_detail?: WireRecipeIngredientLineCreate[];
  /** Legacy API shape; merged server-side into `ingredients` if array is empty. */
  ingredient_sections?: { title: string; ingredients: string }[];
  tags: string[];
  /** Ids from GET /categories — linked by primary key (exact table rows). */
  category_ids?: number[];
  /** New category labels not yet in the table (exact string stored). */
  categories: string[];
  servings: number;
  sourceUrl?: string | null;
  description?: string | null;
  image_base64?: string | null;
  image_mime?: string | null;
  prep_time_min?: number | null;
  cook_time_min?: number | null;
  nutrition?: CreateRecipeNutritionPayload | null;
};

function recipeWritePayloadToJson(
  payload: CreateRecipePayload
): WireRecipeCreateBody {
  const lineList =
    payload.ingredients_detail && payload.ingredients_detail.length > 0
      ? payload.ingredients_detail.map((d) => d.line.trim()).filter(Boolean)
      : payload.ingredients;
  const base: WireRecipeCreateBody = {
    title: payload.title,
    directions: payload.directions || null,
    ingredients: lineList,
    tags: payload.tags,
    categories: payload.categories,
    category_ids: payload.category_ids ?? [],
    servings: payload.servings,
    source_url: payload.sourceUrl ?? null,
    description:
      payload.description !== undefined ? payload.description : null,
    image_base64: payload.image_base64 ?? null,
    image_mime: payload.image_mime ?? null,
    prep_time_min: payload.prep_time_min ?? null,
    cook_time_min: payload.cook_time_min ?? null,
    nutrition: (payload.nutrition ?? null) as WireRecipeNutrition | null,
  };
  if (payload.ingredients_detail && payload.ingredients_detail.length > 0) {
    return { ...base, ingredients_detail: payload.ingredients_detail };
  }
  if (payload.ingredient_sections && payload.ingredient_sections.length > 0) {
    return { ...base, ingredient_sections: payload.ingredient_sections };
  }
  return base;
}

export async function fetchRecipeById(id: number): Promise<Recipe> {
  const raw = await apiFetch<WireRecipe>(`/recipes/${id}`);
  return mapApiRecipeToRecipe(raw);
}

export async function createRecipeOnApi(payload: CreateRecipePayload): Promise<Recipe> {
  const raw = await apiFetch<WireRecipe>("/recipes", {
    method: "POST",
    json: recipeWritePayloadToJson(payload),
  });
  return mapApiRecipeToRecipe(raw);
}

/** PUT /recipes/:id — same body as create; omits image fields to keep the existing photo. */
export async function replaceRecipeOnApi(
  id: number,
  payload: CreateRecipePayload
): Promise<Recipe> {
  const raw = await apiFetch<WireRecipe>(`/recipes/${id}`, {
    method: "PUT",
    json: recipeWritePayloadToJson(payload),
  });
  return mapApiRecipeToRecipe(raw);
}

export async function patchRecipeOnApi(
  id: number,
  body: { status?: RecipeStatus; notes?: string | null }
): Promise<Recipe> {
  const raw = await apiFetch<WireRecipe>(`/recipes/${id}`, {
    method: "PATCH",
    json: body,
  });
  return mapApiRecipeToRecipe(raw);
}
