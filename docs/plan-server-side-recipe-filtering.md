# Plan: Server-Side Recipe Filtering

## Goal

Move recipe filtering from client-side `useMemo` in `app/(drawer)/recipes.tsx` to backend query parameters, so search/category results are fetched and cached per filter combination.

## Current State

- `useRecipesQuery()` fetches all recipes.
- `recipes.tsx` filters in memory by:
  - free-text query (`q`)
  - optional category (`category`)
- Works well for small datasets, but scales poorly as recipe count grows.

## Target State

- Backend supports query params on `GET /recipes`:
  - `q` (text search)
  - `category` (exact or normalized match)
- Frontend uses `useRecipesQuery({ q, category })`.
- React Query key includes filters: `["recipes", { q, category }]`.
- UI renders server-filtered data directly (no heavy in-memory filtering path).

## Implementation Plan

### 1) Backend API support

- Add optional `q` and `category` query params to the recipes list endpoint.
- Implement filtering in the service/repository layer.
- Keep behavior backward-compatible when params are absent (return full list).
- Define matching behavior explicitly:
  - case sensitivity
  - fields included in text search (title, ingredients, directions, tags)
  - category normalization rules

### 2) API client update

- Update `src/api/recipes.ts` list fetch to accept optional filters:
  - `fetchRecipesFromApi({ q?: string; category?: string })`
- Pass params through to the endpoint.
- Keep the existing return shape (`Recipe[]`) unchanged.

### 3) React Query hook update

- Update `useRecipesQuery` in `src/hooks/api/useServerState.ts` to accept filters.
- Build a stable key:
  - `queryKey: ["recipes", { q: normalizedQ, category: normalizedCategory }]`
- Add `keepPreviousData`-style UX behavior (or equivalent) to avoid flicker during search transitions.

### 4) Screen integration (`recipes.tsx`)

- Replace local `useMemo` filtering with filtered query args.
- Keep local input state for search text.
- Debounce search input (250-400ms) before passing it to the query.
- Continue supporting route params (`q`, `category`) as source-of-truth for initial values.

### 5) Fallback strategy

- If backend filtering fails temporarily, preserve a minimal client fallback path behind a feature flag or guarded branch for resilience.
- Remove fallback after backend filtering is stable in production.

## Rollout Steps

1. Add backend params + tests.
2. Ship API client and hook changes.
3. Switch `recipes.tsx` to filtered query + debounce.
4. Validate performance and correctness with larger datasets.
5. Remove any temporary fallback/filter duplication.

## Validation Checklist

- Search results match old behavior for known test cases.
- Category filtering matches menu/category navigation behavior.
- Query cache reuses recent filter combinations.
- No regressions in deep links:
  - `/recipes?q=...`
  - `/recipes?category=...`
- Slow network behavior remains smooth (no jarring list reset).

## Risks and Mitigations

- **Risk:** Different backend matching semantics vs current client filter.
  - **Mitigation:** Define and test explicit matching rules before cutover.
- **Risk:** Too many requests while typing.
  - **Mitigation:** Debounce query input and ignore empty/short transient values.
- **Risk:** Temporary mismatch between screens using filtered vs unfiltered data.
  - **Mitigation:** Migrate all recipe-list entry points in one small batch.

## Success Criteria

- `recipes.tsx` no longer performs full-list in-memory filtering for normal operation.
- Recipe list requests are parameterized by `q` and `category`.
- React Query cache stores and reuses filtered results by query key.
