# Plan: Initial Codebase Commit Slices (New Repository)

## Goal

Split the current working tree into a clean sequence of initial commits for a brand-new repository.  
Each commit should represent a coherent part of the product, with messages that read as foundational work (not migration/removal history).

## Commit Principles

- Use "initialize", "add", "implement", "introduce", "document" language.
- Group files by runtime boundary: schema/backend, data tooling, API client, shared UI, app flows, docs/assets.
- Keep each commit runnable where possible, but optimize for clear history over perfect intermediate runtime.
- Avoid historical framing such as "legacy", "deprecated", "migrate", or "remove old".

## Proposed Commit Sequence

### Commit 1 - Initialize backend domain and schema

**Intent:** Establish the core backend + database contracts that define recipes, ingredients, and API payload shapes.

**Files:**

- `db/schema.sql`
- `db/schema.dbml`
- `backend/app/db_models.py`
- `backend/app/schemas.py`
- `backend/app/recipe_db_service.py`
- `backend/app/main.py`
- `backend/app/services/__init__.py`

**Commit message options:**

- `feat: initialize backend domain models and database schema`
- `feat: add core recipe backend services and schema contracts`

**Suggested body:**

```text
Set up the initial backend data model and schema contracts for recipes and ingredients.
Wire core service and API entrypoints around the foundational database shape.
```

---

### Commit 2 - Add seed and import toolchain

**Intent:** Add reproducible data setup flows for local and demo environments.

**Files:**

- `backend/app/seed_bundle.py`
- `backend/scripts/import_seed_bundle.py`
- `backend/scripts/reset_and_seed.py`
- `backend/seed_data/demo_bundle.json`
- `backend/scripts/import_external_recipes.py`
- `backend/scripts/import_notion_jsonld.py`
- `backend/scripts/import_recipe30_recipes.py`

**Commit message options:**

- `feat: add seed bundle and recipe import tooling`
- `feat: introduce reset-and-seed workflow for local setup`

**Suggested body:**

```text
Add initial data bootstrap scripts and demo seed bundle assets.
Provide a repeatable import/reset workflow for local and test environments.
```

---

### Commit 3 - Add frontend API integration layer

**Intent:** Introduce typed API client and server-state hooks that connect app features to backend endpoints.

**Files:**

- `src/api/endpoints.ts`
- `src/api/recipes.ts`
- `src/api/wire.ts`
- `src/hooks/api/useServerState.ts`

**Commit message options:**

- `feat: add frontend API client and server-state hooks`
- `feat: implement typed recipe API integration layer`

**Suggested body:**

```text
Introduce the frontend API wiring for recipe endpoints and shared wire contracts.
Add server-state hooks used by feature screens to fetch and mutate data.
```

---

### Commit 4 - Add shared UI primitives and cross-feature utilities

**Intent:** Build reusable UI controls and utility helpers used across screens and feature modules.

**Files:**

- `src/components/ui/DropdownMenu.tsx`
- `src/components/ui/DropdownTrigger.tsx`
- `src/components/ui/MultiSelectDropdownMenu.tsx`
- `src/lib/ingredientLine.ts`
- `src/lib/webPressable.ts`
- `src/types/index.ts`

**Commit message options:**

- `feat: add shared dropdown primitives and interaction utilities`
- `feat: introduce common ingredient and pressable helper utilities`

**Suggested body:**

```text
Add reusable dropdown primitives and shared interaction helpers for app-wide use.
Extend common type and ingredient utilities to support feature-level rendering.
```

---

### Commit 5 - Implement app screens and feature flows

**Intent:** Wire user-facing recipe/planning/shopping behavior across navigation and feature components.

**Files:**

- `app/(drawer)/_layout.tsx`
- `app/(drawer)/index.tsx`
- `app/(drawer)/new-recipe.tsx`
- `app/(drawer)/planned.tsx`
- `app/(drawer)/recipe/[id].tsx`
- `app/(drawer)/recipes.tsx`
- `src/components/TopNavigationBar.tsx`
- `src/features/recipes/RecipeCard.tsx`
- `src/features/shopping/ShoppingListItemRow.tsx`
- `src/theme/screens/shoppingStyles.ts`
- `src/store/useRecipeStore.ts` (delete in this commit as part of initial architecture shape)

**Commit message options:**

- `feat: implement drawer screens for recipes, planning, and shopping`
- `feat: add end-to-end recipe browsing and planning app flows`

**Suggested body:**

```text
Implement the initial drawer navigation flows and feature components for recipes and planning.
Align shopping and recipe UI behavior with the shared API/state architecture.
```

---

### Commit 6 - Add documentation plans

**Intent:** Capture product and technical direction alongside initial implementation.

**Files:**

- `docs/plan-dual-ingredient-lines-ai-units.md`
- `docs/plan-server-side-recipe-filtering.md`
- `docs/plan-initial-codebase-commit-slices.md`

**Commit message options:**

- `docs: add initial product and backend implementation plans`
- `docs: document ingredient-unit and recipe-filtering approach`

**Suggested body:**

```text
Add architecture and implementation planning docs for ingredient display and server-side filtering.
Document the intended execution path for upcoming feature refinements.
```

---

### Commit 7 - Add initial media assets

**Intent:** Add image/media artifacts used by the app UI.

**Files:**

- `assets/0qrMT7CfQheTDuGKpRKM_marinated-swordfish-halibut-1526.jpg`

**Commit message options:**

- `chore: add initial recipe media asset`
- `chore: add app image assets for recipe presentation`

**Suggested body:**

```text
Add the initial media asset set used by recipe presentation screens.
```

## Handling Deleted Files in a New Repo Context

The working tree includes deletions:

- `backend/.env.example`
- `backend/app/services/nutrition.py`

For a brand-new repo, treat these as "not part of the initial baseline" rather than historical removals.  
You have two clean options:

1. **Preferred:** Do not stage these deletions if those files never existed in the new remote baseline.
2. **If they are staged anyway:** keep messaging neutral, e.g. "align initial backend service surface".

## Staging Checklist (By Commit)

Use this checklist while staging to avoid cross-contamination:

1. Stage only Commit 1 files, commit, verify.
2. Stage only Commit 2 files, commit, verify.
3. Repeat through Commit 7.
4. Run `git status` after each commit to confirm only intended files remain.

## Final Sanity Checks Before Push

- Confirm commit messages consistently use initial-build language.
- Ensure each commit contains one coherent theme.
- Ensure docs/assets are isolated from runtime code commits.
- Run backend and app smoke checks after Commit 5 (or at minimum before push).

## One-Line Recommended Message Set

1. `feat: initialize backend domain models and database schema`
2. `feat: add seed bundle and recipe import tooling`
3. `feat: add frontend API client and server-state hooks`
4. `feat: add shared dropdown primitives and interaction utilities`
5. `feat: implement drawer screens for recipes, planning, and shopping`
6. `docs: add initial product and backend implementation plans`
7. `chore: add initial recipe media asset`

## Exact Command Sequence (Copy/Paste)

Run from repository root:

```bash
cd /Users/ekaterinamarantidi/SDEprojects/meal-planner
git status
```

### 1) Commit backend domain + schema

```bash
git add \
  db/schema.sql \
  db/schema.dbml \
  backend/app/db_models.py \
  backend/app/schemas.py \
  backend/app/recipe_db_service.py \
  backend/app/main.py \
  backend/app/services/__init__.py

git commit -m "$(cat <<'EOF'
feat: initialize backend domain models and database schema

Set up the initial backend data model and schema contracts for recipes and ingredients.
Wire core service and API entrypoints around the foundational database shape.
EOF
)"

git status
```

### 2) Commit seed + import tooling

```bash
git add \
  backend/app/seed_bundle.py \
  backend/scripts/import_seed_bundle.py \
  backend/scripts/reset_and_seed.py \
  backend/seed_data/demo_bundle.json \
  backend/scripts/import_external_recipes.py \
  backend/scripts/import_notion_jsonld.py \
  backend/scripts/import_recipe30_recipes.py

git commit -m "$(cat <<'EOF'
feat: add seed bundle and recipe import tooling

Add initial data bootstrap scripts and demo seed bundle assets.
Provide a repeatable import/reset workflow for local and test environments.
EOF
)"

git status
```

### 3) Commit frontend API layer

```bash
git add \
  src/api/endpoints.ts \
  src/api/recipes.ts \
  src/api/wire.ts \
  src/hooks/api/useServerState.ts

git commit -m "$(cat <<'EOF'
feat: add frontend API client and server-state hooks

Introduce the frontend API wiring for recipe endpoints and shared wire contracts.
Add server-state hooks used by feature screens to fetch and mutate data.
EOF
)"

git status
```

### 4) Commit shared UI primitives + utilities

```bash
git add \
  src/components/ui/DropdownMenu.tsx \
  src/components/ui/DropdownTrigger.tsx \
  src/components/ui/MultiSelectDropdownMenu.tsx \
  src/lib/ingredientLine.ts \
  src/lib/webPressable.ts \
  src/types/index.ts

git commit -m "$(cat <<'EOF'
feat: add shared dropdown primitives and interaction utilities

Add reusable dropdown primitives and shared interaction helpers for app-wide use.
Extend common type and ingredient utilities to support feature-level rendering.
EOF
)"

git status
```

### 5) Commit app screens + feature flows

```bash
git add \
  "app/(drawer)/_layout.tsx" \
  "app/(drawer)/index.tsx" \
  "app/(drawer)/new-recipe.tsx" \
  "app/(drawer)/planned.tsx" \
  "app/(drawer)/recipe/[id].tsx" \
  "app/(drawer)/recipes.tsx" \
  src/components/TopNavigationBar.tsx \
  src/features/recipes/RecipeCard.tsx \
  src/features/shopping/ShoppingListItemRow.tsx \
  src/theme/screens/shoppingStyles.ts \
  src/store/useRecipeStore.ts

git commit -m "$(cat <<'EOF'
feat: implement drawer screens for recipes, planning, and shopping

Implement the initial drawer navigation flows and feature components for recipes and planning.
Align shopping and recipe UI behavior with the shared API/state architecture.
EOF
)"

git status
```

### 6) Commit docs

```bash
git add \
  docs/plan-dual-ingredient-lines-ai-units.md \
  docs/plan-server-side-recipe-filtering.md \
  docs/plan-initial-codebase-commit-slices.md

git commit -m "$(cat <<'EOF'
docs: add initial product and backend implementation plans

Add architecture and implementation planning docs for ingredient display and server-side filtering.
Document the intended execution path for upcoming feature refinements.
EOF
)"

git status
```

### 7) Commit assets

```bash
git add assets/0qrMT7CfQheTDuGKpRKM_marinated-swordfish-halibut-1526.jpg

git commit -m "$(cat <<'EOF'
chore: add initial recipe media asset

Add the initial media asset used by recipe presentation screens.
EOF
)"

git status
```

### 8) Handle current deletions for fresh-repo framing

If these deletes are not intended as part of initial baseline:

```bash
git restore backend/.env.example backend/app/services/nutrition.py
git status
```

If they are intended, commit neutrally:

```bash
git add backend/.env.example backend/app/services/nutrition.py

git commit -m "$(cat <<'EOF'
chore: align initial backend service surface

Finalize the initial backend file set and configuration surface for the new repository baseline.
EOF
)"

git status
```

### 9) Push to new remote

```bash
git remote add origin <NEW_REPO_URL>
git branch -M main
git push -u origin main
```
