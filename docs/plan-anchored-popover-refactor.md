# Plan: Anchored Popover Refactor (Dropdown Reuse)

## Goal

Reduce duplicated dropdown infrastructure by extracting shared anchored popover behavior from:

- `src/components/ui/DropdownMenu.tsx`
- `src/components/ui/MultiSelectDropdownMenu.tsx`

Keep variant-specific rendering and selection logic in each component.

## Why This Matters

Both dropdowns currently carry near-identical logic for:

- modal/backdrop presentation
- anchor measurement and coordinate math
- open/close animation lifecycle
- dismissal wiring

This is manageable with two components, but risky as soon as behavior changes are needed in multiple places. The major risk is behavior drift (different animation timing, incorrect clamping, inconsistent dismissal behavior).

## Best Time To Implement

Implement this refactor when one or more of the following triggers occur:

1. You are about to modify dropdown positioning, animation, safe-area offsets, or dismissal behavior in both components.
2. You find a bug in one dropdown that likely also affects the other (shared logic bug).
3. You plan to add a third anchored menu/popover variant.
4. A current feature PR already touches one or both dropdown files (low context-switch cost).

### Third-Variant Trigger (Strongest Signal)

If a new anchored UI is being added (for example filter menu, action menu, date popover), and it needs two or more of:

- anchored positioning
- modal/backdrop shell
- entrance/exit animation
- outside-tap dismissal

extract the shared `AnchoredPopover` in the same PR (or just before it). This is usually the point where duplication starts to scale poorly.

## When To Defer

Defer this cleanup if:

- release pressure is high and no dropdown behavior is changing
- the current work does not touch dropdown UX
- there is no expected third variant soon

In those cases, log this as a follow-up and wait for the next feature that touches dropdown internals.

## Scope Boundaries

### `AnchoredPopover` should own

- open/close container lifecycle
- measuring anchor and computing placement
- viewport clamping and max size constraints
- enter/exit animation primitives
- backdrop and outside-press dismissal
- optional placement preference API (example: `bottom-start`, `bottom-end`)

### `AnchoredPopover` should not own

- option item rendering
- selected value model
- single-select vs multi-select rules
- business-specific labels/formatting

## Decision Heuristic

Refactor now if either statement is true:

- "I am about to copy more than ~40 lines of popover shell logic into another component."
- "A single positioning bug fix would require editing three files."

If yes, the refactor is no longer just cleanup; it is a risk and speed optimization.

## Suggested Implementation Sequence

1. Create `src/components/ui/AnchoredPopover.tsx` with only shared shell behavior.
2. Move measurement + position math from existing dropdowns into this base component.
3. Move animation and backdrop handling into the base component.
4. Convert `DropdownMenu` to render its content as children of `AnchoredPopover`.
5. Convert `MultiSelectDropdownMenu` similarly.
6. Verify both components preserve current UX behavior.

## Acceptance Criteria

- `DropdownMenu` and `MultiSelectDropdownMenu` no longer duplicate anchor/animation shell code.
- Existing visual behavior remains unchanged by default.
- Shared positioning changes can be made in one place.
- Both components still fully control their selection behavior and list rendering.

## Risk Controls

- Keep public props backward-compatible where possible.
- Avoid changing copy, typography, and spacing unless required by the extraction.
- Add a small smoke test checklist for both dropdowns:
  - open from trigger
  - close on outside press
  - placement near viewport edges
  - long list scrolling
  - orientation change (if applicable)

## Suggested PR Shape

If this is not urgent, do it as an opportunistic refactor in a feature PR that already touches dropdowns.  
If urgent bugs are being fixed, extract the base component first, then apply bug fixes once shared behavior is centralized.
