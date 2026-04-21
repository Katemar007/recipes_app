import type { Recipe, RecipeCategoryRef } from "@/types";

export type CategoryDirectoryEntry = { id: number; name: string };

/**
 * After GET /categories succeeds (`categoriesHydrated`), only category ids still present
 * in the directory are valid. Before hydration, return null (do not filter client data).
 * When hydrated with an empty directory, returns an empty Set (no valid links).
 */
export function validCategoryIds(
  directory: CategoryDirectoryEntry[],
  categoriesHydrated: boolean
): Set<number> | null {
  if (!categoriesHydrated) return null;
  return new Set(directory.map((c) => c.id));
}

export function filterLinkedCategories(
  recipe: Recipe,
  validIds: Set<number> | null
): RecipeCategoryRef[] {
  if (validIds == null) return recipe.categories;
  return recipe.categories.filter((c) => validIds.has(c.id));
}

const norm = (s: string) => s.trim().toLowerCase();

/**
 * Single-line primary label (featured card, detail chip). Empty when nothing is still valid.
 */
export function primaryCategoryLabel(
  recipe: Recipe,
  filteredLinks: RecipeCategoryRef[],
  directory: CategoryDirectoryEntry[],
  categoriesHydrated: boolean
): string {
  if (!categoriesHydrated) {
    return (recipe.category ?? "").trim();
  }
  if (directory.length === 0) {
    return "";
  }
  const dirNames = new Set(directory.map((c) => c.name));
  if (filteredLinks.length > 0) {
    const linkedNames = new Set(filteredLinks.map((c) => c.name));
    const rc = (recipe.category ?? "").trim();
    if (rc && linkedNames.has(rc)) return rc;
    return filteredLinks[0].name;
  }
  const rc = (recipe.category ?? "").trim();
  if (rc && dirNames.has(rc)) return rc;
  return "";
}

export function categoryPreviewLine(
  recipe: Recipe,
  filteredLinks: RecipeCategoryRef[],
  directory: CategoryDirectoryEntry[],
  categoriesHydrated: boolean
): string {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const c of filteredLinks) {
    const n = c.name.trim();
    if (!n) continue;
    const key = norm(n);
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(n);
    if (names.length === 3) break;
  }
  if (names.length > 0) return names.join(" · ");
  const primary = primaryCategoryLabel(
    recipe,
    filteredLinks,
    directory,
    categoriesHydrated
  );
  return primary || "—";
}

export function recipeMatchesCategoryWithDirectory(
  recipe: Recipe,
  selected: string,
  directory: CategoryDirectoryEntry[],
  categoriesHydrated: boolean
): boolean {
  const sel = norm(selected);
  if (!sel) return true;
  const validIds = validCategoryIds(directory, categoriesHydrated);
  const filtered = filterLinkedCategories(recipe, validIds);
  if (filtered.some((c) => norm(c.name) === sel)) return true;
  if (
    norm(
      primaryCategoryLabel(recipe, filtered, directory, categoriesHydrated)
    ) === sel
  )
    return true;
  return recipe.keywords.some((k) => norm(k) === sel);
}
