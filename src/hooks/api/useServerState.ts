import {
  fetchCategoriesFromApi,
  fetchRecipeById,
  fetchRecipesFromApi,
  fetchShoppingStateFromApi,
  mapApiShoppingState,
  patchRecipeOnApi,
} from "@/api";
import type { ApiCategory } from "@/api/categories";
import type { Recipe, RecipeStatus } from "@/types";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";

export const queryKeys = {
  recipes: ["recipes"] as const,
  categories: ["categories"] as const,
  shoppingState: ["shopping-state"] as const,
  recipeById: (id: number) => ["recipe", id] as const,
};

export function useRecipesQuery() {
  return useQuery({
    queryKey: queryKeys.recipes,
    queryFn: fetchRecipesFromApi,
    staleTime: 1000 * 60 * 5,
  });
}

export function useCategoriesQuery() {
  return useQuery({
    queryKey: queryKeys.categories,
    queryFn: async (): Promise<ApiCategory[]> => {
      const rows = await fetchCategoriesFromApi();
      return [...rows].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
      );
    },
    staleTime: 1000 * 60 * 10,
  });
}

export function useRecipeByIdQuery(id: number | undefined) {
  return useQuery({
    queryKey: id == null ? ["recipe", "missing-id"] : queryKeys.recipeById(id),
    queryFn: () => fetchRecipeById(id as number),
    enabled: id != null,
    staleTime: 1000 * 60 * 5,
  });
}

export function useShoppingStateQuery() {
  return useQuery({
    queryKey: queryKeys.shoppingState,
    queryFn: async () => mapApiShoppingState(await fetchShoppingStateFromApi()),
    staleTime: Infinity,
  });
}

type RecipeMutationContext = { previous: Recipe[] };

function replaceRecipeInList(list: Recipe[], nextRecipe: Recipe): Recipe[] {
  return list.map((r) => (r.id === nextRecipe.id ? nextRecipe : r));
}

export function useUpdateRecipeStatusMutation(): UseMutationResult<
  Recipe,
  unknown,
  { id: number; status: RecipeStatus },
  RecipeMutationContext
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }) => patchRecipeOnApi(id, { status }),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.recipes });
      const previous = queryClient.getQueryData<Recipe[]>(queryKeys.recipes) ?? [];
      queryClient.setQueryData<Recipe[]>(queryKeys.recipes, (current = []) =>
        current.map((r) => (r.id === id ? { ...r, status } : r))
      );
      return { previous };
    },
    onError: (_error, _vars, context) => {
      queryClient.setQueryData(queryKeys.recipes, context?.previous ?? []);
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<Recipe[]>(queryKeys.recipes, (current = []) =>
        replaceRecipeInList(current, updated)
      );
      queryClient.setQueryData(queryKeys.recipeById(updated.id), updated);
    },
  });
}

export function useUpdateRecipeNotesMutation(): UseMutationResult<
  Recipe,
  unknown,
  { id: number; notes: string },
  RecipeMutationContext
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }) => {
      const normalized = notes.trim() ? notes : null;
      return patchRecipeOnApi(id, { notes: normalized });
    },
    onMutate: async ({ id, notes }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.recipes });
      const previous = queryClient.getQueryData<Recipe[]>(queryKeys.recipes) ?? [];
      const normalized = notes.trim() ? notes : null;
      queryClient.setQueryData<Recipe[]>(queryKeys.recipes, (current = []) =>
        current.map((r) => (r.id === id ? { ...r, notes: normalized } : r))
      );
      return { previous };
    },
    onError: (_error, _vars, context) => {
      queryClient.setQueryData(queryKeys.recipes, context?.previous ?? []);
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<Recipe[]>(queryKeys.recipes, (current = []) =>
        replaceRecipeInList(current, updated)
      );
      queryClient.setQueryData(queryKeys.recipeById(updated.id), updated);
    },
  });
}
