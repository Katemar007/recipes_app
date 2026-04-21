import re

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class RecipeIngredientLineCreate(BaseModel):
    """
    One ingredient line with explicit graph metadata (UI-assigned ids).

    When ``section_title`` is non-empty (and not the legacy default ``Ingredients``),
    the server resolves it against ``ingredient_sections`` (case-insensitive match) or
    creates a new catalog row, then stores that id on ``recipe_ingredients`` — the
    client ``section_id`` for that line is ignored.

    If ``section_title`` is omitted or empty, ``section_id`` is used (must exist in
    ``ingredient_sections``, or be ``0`` for the unnamed default block).
    """

    line: str = Field(description="Single ingredient line, e.g. '2 cups flour'")
    section_id: int
    section_position: int = Field(default=0, ge=0)
    position: int = Field(default=0, ge=0, description="Order within the section")
    ingredient_id: int | None = None
    recipe_id: int | None = None
    section_title: str | None = Field(
        default=None,
        max_length=200,
        description=(
            "When set, the server looks up or creates this name in `ingredient_sections` "
            "and uses that catalog id (client `section_id` is ignored for the line)."
        ),
    )

    @field_validator("line")
    @classmethod
    def strip_line(cls, v: str) -> str:
        s = (v or "").strip()
        if not s:
            raise ValueError("Each ingredient line must be non-empty.")
        return s


class NutritionIn(BaseModel):
    """Macros and kcal are **per one serving**"""

    kcal: float | None = None
    protein_g: float | None = None
    carbs_g: float | None = None
    fat_g: float | None = None
    # per_100g_kcal: float | None = None


class ConvertRequest(BaseModel):
    quantity: float = Field(gt=0)
    from_unit: str
    to_unit: str
    ingredient_name: str | None = None


class ConvertResponse(BaseModel):
    quantity: float
    unit: str
    method: str  # "global" | "density" | "identity"


class DedupeItem(BaseModel):
    name: str
    quantity: float | None = None
    unit: str | None = None
    category: str | None = None
    source_recipe_id: int | None = None


class DedupeResponse(BaseModel):
    items: list[dict]
    merged_count: int


class RecipeIngredientSectionCreate(BaseModel):
    """Legacy: one block of newline-separated lines (merged into `ingredients`)."""

    title: str = Field(default="", max_length=200)
    ingredients: str = Field(description="One ingredient per line")


class RecipeCreateBody(BaseModel):
    """Create recipe — `ingredients` is a JSON array of strings (legacy shapes coerced)."""

    title: str = Field(min_length=1)
    directions: str | None = None
    ingredients: list[str] | None = Field(
        default=None,
        description="Ingredient lines as a JSON array of strings",
    )
    ingredients_detail: list[RecipeIngredientLineCreate] | None = Field(
        default=None,
        description=(
            "When non-empty, replaces string `ingredients`: each line carries "
            "`section_id`, positions, and optional `ingredient_id` / `recipe_id` metadata."
        ),
    )
    ingredient_sections: list[RecipeIngredientSectionCreate] | None = Field(
        default=None,
        description="Legacy: multiple newline blocks merged in section order",
    )
    tags: list[str] = Field(
        default_factory=list,
        description="Keywords / tags (not recipe categories)",
    )
    categories: list[str] = Field(
        default_factory=list,
        description=(
            "Category names: exact match reuses an existing `categories` row; "
            "otherwise a new row is created."
        ),
    )
    category_ids: list[int] = Field(
        default_factory=list,
        description=(
            "Optional ids from `categories` table — linked by primary key in this order "
            "before applying `categories` names."
        ),
    )
    servings: float = Field(default=4.0, gt=0)
    source_url: str | None = None
    description: str | None = None
    image_base64: str | None = None
    image_mime: str | None = None
    prep_time_min: int | None = Field(default=None, ge=0)
    cook_time_min: int | None = Field(default=None, ge=0)
    nutrition: NutritionIn | None = None

    @model_validator(mode="before")
    @classmethod
    def coerce_legacy_string_ingredients(cls, data: object) -> object:
        if not isinstance(data, dict):
            return data
        out = dict(data)
        raw = out.get("ingredients")
        if isinstance(raw, str):
            out["ingredients"] = [
                line.strip()
                for line in re.split(r"\r?\n", raw)
                if line.strip()
            ]
        return out

    @model_validator(mode="after")
    def merge_ingredient_sources(self):
        lines: list[str] = []
        if self.ingredients_detail:
            lines = [
                li.line.strip()
                for li in self.ingredients_detail
                if li.line and li.line.strip()
            ]
        elif self.ingredients:
            lines = [str(x).strip() for x in self.ingredients if str(x).strip()]
        if not lines and self.ingredient_sections:
            for sec in self.ingredient_sections:
                body = sec.ingredients or ""
                for part in body.splitlines():
                    t = part.strip()
                    if t:
                        lines.append(t)
        if not lines:
            raise ValueError(
                "Add at least one ingredient (non-empty ingredients_detail, "
                "ingredients array, legacy newline string, or ingredient_sections)."
            )
        object.__setattr__(self, "ingredients", lines)
        return self


class RecipePatchBody(BaseModel):
    status: str | None = None
    notes: str | None = None
    categories: list[str] | None = None
    category_ids: list[int] | None = None


class ShoppingListIn(BaseModel):
    id: str
    user_id: str = "demo-user"
    name: str | None = None
    status: str
    saved_at: str | None = None
    list_date: str | None = None
    created_at: str


class ShoppingItemIn(BaseModel):
    id: str
    shopping_list_id: str
    name: str
    quantity: float | None = None
    unit: str | None = None
    category: str | None = None
    checked: bool = False
    source_recipe_id: int | None = None
    source_ingredient_id: int | None = None
    source_recipe_title: str | None = None
    is_manual: bool = False
    position: int = 0


class ShoppingSnapshotIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    snapshot_list: ShoppingListIn = Field(alias="list")
    items: list[ShoppingItemIn]


class ShoppingStateIn(BaseModel):
    active_list: ShoppingListIn
    items: list[ShoppingItemIn]
    saved_snapshots: list[ShoppingSnapshotIn] = Field(default_factory=list)
