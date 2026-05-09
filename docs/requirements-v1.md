# Pathwise — Math-Flow Worksheet Generator

## 1. Product overview
A web tool for parents/educators to generate printable single-page math
worksheets. Each worksheet is a grid of circles connected by directional
arrows; every arrow carries a math operation (e.g. `+15`, `−7`, `×3`,
`÷4`). The student starts at a marked node with a known value, follows the
arrows, and computes each subsequent circle's value in their head or on
paper. Designed for ages ~6–12, mental-arithmetic practice.

## 2. Primary user flow
1. User lands on the app — a worksheet is already generated with sensible
   defaults (Standard preset).
2. User picks a difficulty preset OR adjusts individual controls.
3. The preview updates live on every change.
4. User presses **Regenerate** until they like the layout, then **Print**.
5. The browser's native print dialog opens; the worksheet prints
   full-bleed, one page (A4), no UI chrome.

## 3. Functional requirements

### 3.1 Generation controls (left sidebar)
- **Difficulty presets**: Starter / Standard / Expert. Each preset sets
  operations, op-set, number range, and self-check count in one click.
- **Number of operations** — slider, 5–100 (path length = ops + 1).
- **Self-check values** — slider, 0–12. Number of *correct* intermediate
  cell values printed along the path so the child can verify progress.
  Cell 0 (start) and the last cell are always visible; this slider only
  controls the cells between them, distributed evenly.
- **Number range tier** — segmented control: `0–9`, `10–99`, `100–999`,
  `1k–9k`. Bounds the operand printed on each arrow.
- **Operations** — toggle pills for `+`, `−`, `×`, `÷`. At least one must
  remain selected.
- **Estimated time** — derived, not editable. Shown as a badge in the
  Generation section header (e.g. `≈ 5 min`). Formula:
  `operations × secPerStep(tier, opSet)`.
- **Generated stats** — read-only: step count, time estimate, final
  value, seed code.
- **Regenerate** button — picks a new random seed (keyboard: `R`).
- **Print** button — calls `window.print()` (keyboard: `P`).

### 3.2 Generator algorithm
- **Path** — randomized DFS on a 4-connected grid with no revisits, using
  a Warnsdorff-like heuristic (prefer next cells with most free exits) to
  produce long, snake-like paths. Multiple attempts; longest wins.
- **Grid sizing** — auto-fit roughly square: `side = ceil(sqrt(nodes/0.7))`,
  clamped to `[4, 16]`. Aim for ~70% path coverage so empty-circle decoys
  appear around the path.
- **Operations** — each step picks an op from the user's set:
  - `+`, `−` use an operand drawn from the tier range.
  - `×` uses a small factor (2–9) regardless of tier so values don't blow up.
  - `÷` only fires when the running value has a clean integer divisor in
    [2, 12]; otherwise the generator falls back to another op.
- **Determinism** — every (config, seed) pair produces the same puzzle.
  Use a mulberry32 PRNG. Display the seed as a 6-char base-36 code.
- **Output** — `{ cols, rows, cells[], pathCells[], edges[], startValue,
  finalValue, stats }`.

### 3.3 Worksheet (right pane)
- US Letter portrait, 816 × 1056 px @ 96dpi, cream paper background.
- **Header**: title (`Math-Flow Quest`), one-line instructions,
  date + seed in monospace top-right.
- **Body**: stats strip (Steps · Range · Ops · ≈ Time) above the SVG
  puzzle.
  - Path cells: ringed circles. Start cell is filled black with white
    starting value.
  - Self-check cells: same ringed circle but with their correct value
    printed inside.
  - Decoy cells: same ringed circle, slightly faded (50% opacity), no
    value.
  - Edges: black arrow with arrowhead between consecutive path cells.
    Label is op above a short bar, operand below (mirrors the reference
    image), monospace, tabular numerals.
- **Footer**: app name + final-value sanity check.

### 3.4 Print
- `@page { size: letter; margin: 0; }`.
- Sidebar hidden, paper fills page edge to edge, no shadows or borders.
- One puzzle per page; no pagination logic needed.

## 4. Non-functional requirements
- **No persistent storage** required; state lives in memory + URL seed.
- No analytics, no auth, no backend.

## 5. Tech stack (recommended)
- **Tailwind CSS** with the shadcn token preset; extend the palette with
  one warm terracotta accent (`oklch(0.62 0.16 38)`).
- **Geist Sans + Geist Mono** (self-hosted woff2).
- Generator and SVG renderer are framework-agnostic plain JS / SVG —
  reuse the prototype's `generator.js` and `puzzle-svg.jsx` directly.

## 6. Component map
| Component        | Radix/shadcn primitive       | Notes                          |
| ---------------- | ---------------------------- | ------------------------------ |
| Difficulty cards | `<button>` with active style | Click selects whole preset     |
| Operations slider| `<Slider>` (Radix)           | min 5, max 100                 |
| Self-check slider| `<Slider>` (Radix)           | min 0, max 12                  |
| Number range tabs| `<ToggleGroup type="single">`| 4 options                      |
| Op pills         | `<ToggleGroup type="multiple">`| At least one selected         |
| Regenerate / Print | `<Button>`                  | Primary = terracotta accent    |


## 8. Acceptance criteria
- A user can generate, regenerate, and print a worksheet without ever
  reading documentation.
- Every printed worksheet is mathematically self-consistent: starting
  from `startValue` and applying each labelled operation in path order
  always yields the printed `finalValue`.
- Self-check values, when present, match what the kid would compute.
- No two regenerations within one session produce identical puzzles
  (seed must change).
- Prints to a single page on US Letter and A4 with no clipped content.
