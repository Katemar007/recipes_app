from __future__ import annotations

from sqlalchemy import (
    Boolean,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.ext.associationproxy import association_proxy

from .database import Base


class CategoryRow(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String, unique=True, index=True)

    recipe_links: Mapped[list["RecipeCategoryLinkRow"]] = relationship(
        back_populates="category",
    )


class RecipeRow(Base):
    __tablename__ = "recipes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String, index=True, default="demo-user")
    title: Mapped[str] = mapped_column(String)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    directions: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(String, nullable=False, default="")
    keywords_json: Mapped[str] = mapped_column(Text, default="[]")
    prep_time_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
    cook_time_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
    servings: Mapped[float] = mapped_column(Float, default=1.0)
    status: Mapped[str] = mapped_column(String, default="library")
    nutrition_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    ingredients_json: Mapped[str] = mapped_column(Text, default="[]")
    created_at: Mapped[str] = mapped_column(String)

    ingredients: Mapped[list["RecipeIngredientRow"]] = relationship(
        back_populates="recipe",
        cascade="all, delete-orphan",
    )
    category_links: Mapped[list["RecipeCategoryLinkRow"]] = relationship(
        back_populates="recipe",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    linked_categories = association_proxy("category_links", "category")


class RecipeCategoryLinkRow(Base):
    """Join table: one row per (recipe, category) with a stable surrogate `id` for APIs."""

    __tablename__ = "recipe_categories"
    __table_args__ = (
        UniqueConstraint(
            "recipe_id",
            "category_id",
            name="uq_recipe_categories_recipe_category",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    recipe_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("recipes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    category_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("categories.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    recipe: Mapped["RecipeRow"] = relationship(back_populates="category_links")
    category: Mapped["CategoryRow"] = relationship(back_populates="recipe_links")


class IngredientSectionRow(Base):
    """
    Global ingredient section catalog (shared across recipes).

    id=0 is reserved for the default unnamed section (empty catalog title). Which section a recipe
    uses is expressed on each `recipe_ingredients` row (section_id + section_position).
    """

    __tablename__ = "ingredient_sections"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=False)
    title: Mapped[str] = mapped_column(String)
    position: Mapped[int] = mapped_column(Integer, default=0)

    ingredients: Mapped[list["RecipeIngredientRow"]] = relationship(
        back_populates="section",
        foreign_keys="[RecipeIngredientRow.section_id]",
    )


class RecipeIngredientRow(Base):
    __tablename__ = "recipe_ingredients"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    recipe_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("recipes.id", ondelete="CASCADE"), index=True
    )
    section_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("ingredient_sections.id", ondelete="SET NULL"), nullable=True
    )
    position: Mapped[int] = mapped_column(Integer, default=0)
    section_position: Mapped[int] = mapped_column(Integer, default=0)
    line: Mapped[str] = mapped_column(Text, default="")

    recipe: Mapped[RecipeRow] = relationship(back_populates="ingredients")
    section: Mapped["IngredientSectionRow | None"] = relationship(
        back_populates="ingredients",
        foreign_keys=[section_id],
    )


class ShoppingListRow(Base):
    __tablename__ = "shopping_lists"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(String, index=True, default="demo-user")
    name: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String)
    saved_at: Mapped[str | None] = mapped_column(String, nullable=True)
    list_date: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[str] = mapped_column(String)

    items: Mapped[list["ShoppingListItemRow"]] = relationship(
        back_populates="shopping_list",
        cascade="all, delete-orphan",
    )


class ShoppingListItemRow(Base):
    __tablename__ = "shopping_list_items"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    shopping_list_id: Mapped[str] = mapped_column(
        String, ForeignKey("shopping_lists.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String)
    quantity: Mapped[float | None] = mapped_column(Float, nullable=True)
    unit: Mapped[str | None] = mapped_column(String, nullable=True)
    category: Mapped[str | None] = mapped_column(String, nullable=True)
    checked: Mapped[bool] = mapped_column(Boolean, default=False)
    source_recipe_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    source_ingredient_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    source_recipe_title: Mapped[str | None] = mapped_column(String, nullable=True)
    is_manual: Mapped[bool] = mapped_column(Boolean, default=False)
    position: Mapped[int] = mapped_column(Integer, default=0)

    shopping_list: Mapped[ShoppingListRow] = relationship(back_populates="items")
