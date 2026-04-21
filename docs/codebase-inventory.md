# Codebase inventory (maintenance phases 0–5)

Snapshot of the **meal-planner** repo for DRY/consistency work. Regenerate when architecture shifts.

## HTTP / API

| Item | Location | Notes |
|------|----------|--------|
| JSON API wrapper | `src/api/client.ts` (`apiFetch`) | Basic Auth, JSON body, `makeApiError` on failure |
| Authenticated raw fetch | `src/api/client.ts` (`fetchWithApiAuth`) | Same auth as `apiFetch` |
| Non-JSON responses | `src/api/client.ts` (`ensureApiOk`) | After `fetchWithApiAuth`, use this so errors match `apiFetch` (`ApiError`) |
| Other `fetch(` call sites | `src/api/client.ts` only | Feature code does not call `fetch` for the backend |
| Axios | — | Not used |
| Env reads | `src/config/env.ts` | `EXPO_PUBLIC_API_URL`, `extra.apiUrl`, Basic user/password |

## Errors

| Item | Location |
|------|----------|
| `ApiError`, `makeApiError`, FastAPI `detail` parsing | `src/api/error.ts` |
| User-facing strings | `getErrorMessage` (handles `ApiError` first); `isApiError` for branching |

## Types vs backend

| Layer | Location |
|-------|----------|
| UI / store models (camelCase) | `src/types/index.ts` |
| API wire types (snake_case JSON) | **`src/api/wire.ts`** — document parity with `backend/app/schemas.py` and `recipe_row_to_api` |
| Mappers | `src/api/recipes.ts`, `src/api/shopping.ts` |
| Validation / server | `backend/app/schemas.py` (Pydantic) |

**Drift risk:** When Pydantic or `recipe_row_to_api` changes, update `src/api/wire.ts` and mappers. Optional: add `openapi-typescript` + `backend/scripts/export_openapi.py` (requires backend venv with `requirements.txt` installed) to generate types from `app.openapi()`.

## Styling

| Approach | Where |
|----------|--------|
| NativeWind / Tailwind | `global.css` + `metro.config.js`; imported in `app/_layout.tsx` |
| React Native Paper + tokens | `src/theme/paper.ts`, `tokens.ts`, screen style modules |

No CSS Modules mix; web styling goes through RN + NativeWind globals.

## State & prop depth

| Area | Pattern |
|------|---------|
| Recipes / categories | `src/store/useRecipeStore.ts` (Zustand) |
| Shopping | `src/store/useShoppingStore.ts` (Zustand) |
| Screens | `app/(drawer)/*.tsx` — review here if props feel deep |

## Phase 1 actions applied

- **`src/config/env.ts`:** single source for `EXPO_PUBLIC_*` API URL and Basic credentials.
- **`fetchWithApiAuth`:** web recipe images use the shared helper instead of ad hoc `fetch`.
- **Barrel cleanup:** `src/api/index.ts` trimmed unused exports; helpers remain in `src/api/endpoints.ts` for direct import.
- **Deps:** removed unused `zod` and `@expo-google-fonts/cormorant-garamond`.

## Phase 2 actions applied

- **`ensureApiOk`:** normalizes failed responses from `fetchWithApiAuth` to `ApiError` (same as `apiFetch`).
- **`RecipeRemoteImage`:** uses `fetchWithApiAuth` → `ensureApiOk` → `blob()`.
- **`getErrorMessage` / `isApiError`:** explicit handling for `ApiError`.
- **Policy comment** at top of `src/api/client.ts` (single entry for backend HTTP).

## Phase 3 actions applied

- **`src/api/wire.ts`:** canonical wire/request types aligned with FastAPI models and dict payloads.
- **`recipes.ts` / `categories.ts` / `shopping.ts` / `endpoints.ts`:** use `Wire*` types; existing `Api*` names kept as aliases where needed for callers.

## OpenAPI (optional)

```bash
cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python scripts/export_openapi.py   # writes src/api/generated/openapi.json
```

Then add `openapi-typescript` and generate `.d.ts` from that JSON if you want machine-checked parity.

## Phase 4 actions applied

- **`useRecipeGridRows`:** `app/(drawer)/planned.tsx` and `recipes.tsx` share responsive `cols` / `rows` / `width` (no duplicated `chunkIntoRows` + `recipeGridColumns` wiring).
- **`ShoppingListItemRow`:** moved to `src/features/shopping/ShoppingListItemRow.tsx`; reads `toggleChecked` / `removeItem` from `useShoppingStore` and `useBreakpoint` locally — list rows no longer take `onToggle` / `onRemove` callbacks through `FlatList.renderItem`.

## Phase 5 actions applied

- **ESLint:** `eslint.config.mjs` (Expo preset via `FlatCompat`) + `no-restricted-globals` for `fetch` outside `src/api/client.ts`; lint scope `app` + `src` only; build outputs ignored.
- **Scripts:** `npm run typecheck`, `npm run lint`, `npm run knip`, `npm run ci`.
- **Knip:** `knip.json` with dependency-focused CI mode (`knip --include dependencies,unlisted,binaries,unresolved`); ignores Expo/RN false positives (`@react-navigation/native`, `babel-preset-expo`, etc.).
- **GitHub Actions:** `.github/workflows/ci.yml` runs `npm ci` + `npm run ci` on push/PR to `main`/`master`.

## Knip (full vs CI)

For a stricter pass (unused exports), run plain `npx knip`. CI uses the narrowed include list so barrel exports under `@/theme` and `@/api` do not fail the build. Treat full knip as hints for refactors.
