import { apiFetch } from "./client";
import type { WireCategoriesListResponse, WireCategory } from "./wire";

export type ApiCategory = WireCategory;

export async function fetchCategoriesFromApi(): Promise<ApiCategory[]> {
  const res = await apiFetch<WireCategoriesListResponse>("/categories");
  return res.categories ?? [];
}
