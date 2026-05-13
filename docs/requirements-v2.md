# Change Request v2 — Sticker-based self-check

> Builds on [REQUIREMENTS.md](./REQUIREMENTS.md) (v1). This document lists
> only what changes; everything not mentioned remains as specified in v1.

## 1. What changed and why

### Motivation
Parent-tested workflow: kid covers intermediate answers with physical
round stickers, writes a guess on top, peels the sticker to verify, then
parks the sticker in one of two zones at the bottom of the page —
"You Got It" (right) or "Not Yet" (left). Visible progress, instant
self-correction, no eraser dust, mistakes reframed as a pile instead of
a red mark.

### Worksheet now has two modes
- **Sticker mode** (default) — 4 fixed checkpoint cells along the path
  are rendered with a translucent yellow disc covering them. A footer
  appears below the puzzle with two zones (icon + title + 4 sticker
  placeholders each). Header instructions describe the ritual.
- **Classic mode** — the original v1 worksheet. No intermediate values
  printed, no footer. Kid solves end-to-end.

### Answer key
A new optional second page renders the same puzzle with **every** cell
value filled in, for parents to keep. Prints with `page-break-before`.

## 2. Functional changes

### 2.1 Controls (left sidebar)
| Control                 | v1 state                | v2 state                                   |
|-------------------------|-------------------------|--------------------------------------------|
| Difficulty presets      | Sets ops + tier + nodes + `checkpoints` | Sets ops + tier + nodes only (drop checkpoints) |
| Number of operations    | Slider, 5–100           | Unchanged                                  |
| **Self-check values**   | Slider, 0–12            | **Removed.** Always 4 in sticker mode, 0 in classic. |
| **Mode**                | Did not exist           | **Added.** Segmented control: `Sticker` / `Classic`. |
| **Print answer key**    | Did not exist           | **Added.** Toggle. When on, append a second page. |
| Number range            | Segmented, 4 tiers      | Unchanged                                  |
| Starting value          | Slider, 0–20            | **Removed.** Always 1. (Simplification.)   |
| Operations              | Toggle pills            | Unchanged                                  |
| Stats / seed            | Read-only block         | Unchanged                                  |
| Regenerate / Print      | Buttons                 | Unchanged                                  |

The old "Stickers / Worksheet" sections from intermediate versions
(theme picker, sticker sheet, name field, title field) are all removed.

### 2.2 Worksheet rendering (sticker mode)
- 4 checkpoint cells are picked evenly along the path. Cell 0 (start)
  and the last cell are excluded from the random pick but the last cell
  is **always** revealed (kid needs to verify the final answer).
- Checkpoint cells get a light grey fill (`#ececec`) so they're easy to
  spot beneath the sticker when peeled.
- A solid yellow disc, 25% larger than the cell radius, is rendered on
  top of each checkpoint (group opacity 0.98, no border, no shadow per
  final design — only the offset darker companion was removed in favor
  of an SVG `feGaussianBlur` shadow filter).
- Header instructions read:
  > Solve each circle. Peek under the sticker to check. Park it on the
  > right if you got it — on the left if not.

### 2.3 Houses footer (sticker mode only)
- Two columns separated by a thin vertical divider sitting at the
  horizontal midpoint of the page.
- Each column shows:
  - An outline-only SVG icon (left: ghost, right: crown). No fills,
    neutral tone.
  - A title — left: **Not Yet**, right: **You Got It**.
  - A row of 4 dashed-outline circular placeholders, 54px diameter,
    distributed `space-between` across the column.
- No captions / subtitles — kept minimal.

### 2.4 Answer-key page
- Reuses the same `<PuzzleSVG>` with `showAnswers=true`, `stickerMode=false`.
- Header reads "Answer key — Solutions for the worksheet above. Keep
  this page for the parent."
- Same seed code in the meta corner so parents can pair sheet ↔ key.
- No houses footer on this page.

## 3. Data model deltas

```diff
DEFAULT_CONFIG = {
  operations,
  ops,
  numTier,
- startValue,
- checkpoints,
+ stickerMode: true,      // boolean
+ showSolutions: false,   // boolean
  seed,
}
```

`markCheckpoints(puzzle, count)` is still called, with `count = stickerMode ? 4 : 0`.

## 4. Acceptance criteria (new / updated)

- Toggling Mode between Sticker and Classic with no other change must
  produce a worksheet of identical puzzle layout, only differing in the
  presence of grey checkpoint fills, yellow stickers, and the houses
  footer.
- Sticker mode worksheets always have exactly 4 stickers, regardless of
  `operations`. One of them is always the final cell.
- The vertical divider between the two house zones must be exactly
  centered on the page width (matches the `paper-body`'s horizontal
  middle, not the SVG's middle).
- The answer-key page, when enabled, must print on its own sheet
  (page-break-before).
- Mathematical consistency unchanged from v1: every printed value on the
  answer key must follow from the labelled operations starting from
  `startValue`.

## 5. Out of scope (still)
- Custom sticker count
- Multiple worksheets per print job
- Saving / sharing by URL
- Sticker sheet page (the cut-out stickers v we mocked earlier — removed
  for v2; we'll rely on a separately-supplied physical sticker pack)
- Custom title or student-name fields
- Localisation
- Mobile sidebar layout

---

## 6. Visual specification (mockup → production)

All values below are taken straight from the mockup so the engineer can
reproduce them without guessing. Files referenced live in this project
root: `styles.css`, `puzzle-svg.jsx`, `houses.jsx`.

### 6.1 Design tokens (`:root` in `styles.css`, lines 2–22)
```css
--bg:            oklch(0.99  0.002 90);
--bg-subtle:     oklch(0.975 0.003 90);
--bg-muted:      oklch(0.955 0.004 90);
--paper:         oklch(0.985 0.008 85);  /* worksheet cream */
--paper-edge:    oklch(0.93  0.01  85);
--fg:            oklch(0.18  0.005 90);
--fg-muted:      oklch(0.52  0.008 90);
--fg-subtle:     oklch(0.65  0.008 90);
--border:        oklch(0.91  0.005 90);
--border-strong: oklch(0.84  0.006 90);
--accent:        oklch(0.62  0.16  38);  /* terracotta — primary CTA only */
--accent-hover:  oklch(0.56  0.17  38);
--ink:           oklch(0.16  0.005 90);  /* darkest text + start node fill */
--radius:    10px;
--radius-sm:  6px;
--radius-lg: 14px;
```

### 6.2 Typography
- Sans body: `'Geist', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif`
- Mono numerals/UI accents: `'Geist Mono', 'JetBrains Mono', ui-monospace, monospace`
- Body size: `14px` / line-height `1.45`
- `font-feature-settings: 'cv11', 'ss01', 'ss03'`
- Numerals: always `font-variant-numeric: tabular-nums` in mono contexts

### 6.3 Page (worksheet + answer key)
- Paper size: `816 × 1056 px` (US Letter @ 96 dpi)
- Border: `1px solid var(--paper-edge)`, `border-radius: 4px`
- Header padding: `44px 56px 20px`
- Body padding: `28px 56px 48px`
- Footer padding: `14px 56px 28px`
- Title: `26px / 600 / -0.022em`, color `var(--ink)`
- Subtitle: `13px / 400`, color `oklch(0.45 0.01 85)`, max-width `380px`
- Meta block (right of header): mono, `11px`, `oklch(0.45 0.01 85)`,
  underline placeholder `min-width: 110px`

### 6.4 Puzzle SVG (constants in `puzzle-svg.jsx`)
```js
const SPACING = 78;   // cell-center to cell-center distance, px
const PAD     = 36;   // svg outer padding
const R       = 22;   // cell circle radius
const STROKE  = 2.2;  // cell + edge stroke width
```
- Cell stroke / edge line / arrow: `#1a1a1a`
- Cell fill (regular path cell): `#fefcf6`
- Cell fill (checkpoint, sticker peeled off): `#ececec`
- Cell fill (start node): `#1a1a1a`, text white
- Off-path decoy cells: same stroke + fill, `opacity: 0.5`
- Arrow label (horiz): op text size `14 / 600`, divider `1.6px`,
  operand text `13 / 600 mono`, all `#1a1a1a`

### 6.5 Sticker (yellow disc over checkpoint)
```jsx
// in puzzle-svg.jsx, render only when stickerMode && c.isCheckpoint && !isStart
const SR = R * 1.25;   // 25% larger than the cell
<circle
  cx={x} cy={y} r={SR}
  fill="#f7b918"
  opacity="0.98"
  filter="url(#stickerShadow)"
/>
```
Shadow filter — defined once in `<defs>`:
```jsx
<filter id="stickerShadow" x="-80%" y="-80%" width="260%" height="260%">
  <feGaussianBlur in="SourceAlpha" stdDeviation="3.5" />
  <feOffset dx="1" dy="4" result="offsetBlur" />
  <feComponentTransfer><feFuncA type="linear" slope="0.55"/></feComponentTransfer>
  <feMerge>
    <feMergeNode />
    <feMergeNode in="SourceGraphic" />
  </feMerge>
</filter>
```

### 6.6 Houses footer (`.houses` in styles.css, ~L540 +)
```css
.houses {
  margin-top: 26px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0;
  position: relative;
}
.houses::before {           /* vertical divider, midline of page */
  content: "";
  position: absolute;
  left: 50%; top: 14px; bottom: 14px;
  width: 1px;
  background: oklch(0.55 0.01 85);
  transform: translateX(-50%);
}
.house {
  padding: 8px 28px 12px;
  display: flex; flex-direction: column; gap: 8px;
  min-height: 120px;
}
.house-left  { padding-left:  4px; }
.house-right { padding-right: 4px; }
.house-head  { display: flex; align-items: center; gap: 12px; }
.house-title {
  font-size: 16px; font-weight: 700;
  letter-spacing: -0.01em; color: var(--ink);
}
.parking-grid {
  display: flex;
  justify-content: space-between;   /* distributes 4 slots evenly */
  align-items: center;
  padding: 6px 0 0;
  width: 100%;
}
.parking-slot {
  width: 54px; height: 54px;
  border-radius: 50%;
  border: 1.4px dashed oklch(0.55 0.01 85);
  background: transparent;
}
```

### 6.7 House icons (`houses.jsx`)
Both 44 × 44 px, viewBox `0 0 64 64`, outline-only, `stroke="#1a1a1a"`,
`stroke-width="2"`, no fills.

**Ghost (left, `Not Yet`)**
```jsx
<path d="M14 30 a18 18 0 0 1 36 0 v22 l-5 -5 -5 5 -5 -5 -5 5 -5 -5 -5 5 -5 -5 -1 -1 z" />
<circle cx="26" cy="29" r="1.6" fill="#1a1a1a" />
<circle cx="38" cy="29" r="1.6" fill="#1a1a1a" />
```

**Crown (right, `You Got It`)**
```jsx
<path d="M10 22 l8 22 h28 l8 -22 -11 8 -11 -16 -11 16 -11 -8 z" />
<line x1="16" y1="48" x2="48" y2="48" stroke-linecap="round" />
```

### 6.8 Sidebar primitives (shadcn-on-Radix mapping)
| Mockup class      | Radix / shadcn primitive              | Notes                                |
|-------------------|---------------------------------------|--------------------------------------|
| `.preset`         | `<button>` w/ active outline ring     | `border-color: var(--ink)` + 3px ring at `oklch(0 0 0 / 0.06)` when active |
| `.slider`         | `<Slider>` (Radix)                    | Track 4px @ `--bg-muted`, thumb 16px ring `1.5px solid --ink` |
| `.segmented`      | `<ToggleGroup type="single">`         | Container `--bg-muted` w/ 1px `--border`, active item `--bg` + `--shadow-sm` |
| `.pill` (op)      | `<ToggleGroup type="multiple">`       | 38×38, mono 13px, active `bg/border = --ink`, text `--bg` |
| `.switch`         | `<Switch>`                            | 32×18, on = `--ink` |
| `.btn-primary`    | `<Button>`                            | `--accent` + inset top-light `oklch(1 0 0 / 0.18)` |
| `.btn-secondary`  | `<Button variant="outline">`          | `--bg` + 1px `--border` |

### 6.9 Print rules
```css
@media print {
  @page { size: letter; margin: 0; }
  body, html { background: white; }
  .sidebar, .preview-toolbar { display: none !important; }
  .paper {
    box-shadow: none; border: none;
    width: 100%; min-height: 100vh; border-radius: 0;
    page-break-after: always;
  }
  .solutions-page { page-break-before: always; }
}
```

### 6.10 File map for the engineer
| Mockup file        | Production responsibility |
|--------------------|----------------------------|
| `styles.css`       | Design tokens, all layout, print rules |
| `generator.js`     | `MathFlow.generate()` + `markCheckpoints()` — copy verbatim, no React dependency |
| `puzzle-svg.jsx`   | The puzzle renderer + sticker filter — keep framework-agnostic if possible |
| `houses.jsx`       | Houses footer + outline icons |
| `sidebar.jsx`      | Maps 1:1 to shadcn primitives per §6.8 |
| `app.jsx`          | State container + print invocation |

