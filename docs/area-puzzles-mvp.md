# Area Sticker Puzzles MVP

## Context

Parents need a second printable puzzle family beside the existing Math-Flow worksheet. The new puzzle trains multiplication, division, and geometry reasoning through connected rectangle area puzzles inspired by the supplied reference image.

The MVP adds rectangle-only Area Sticker Puzzles. Each puzzle has exactly one sticker-covered unknown answer. The child solves the missing side length or missing area, then peels one sticker to check the final answer.

## Current State

Verified on June 27, 2026.

The app currently has one puzzle family: Math-Flow worksheets.

| File | Current behavior |
|------|------------------|
| `src/App.tsx:12` | UI config contains `stickerMode` and `showSolutions` for the current Math-Flow puzzle. |
| `src/App.tsx:336` | Generates exactly one path puzzle per seed/config. |
| `src/App.tsx:442` | Exposes Sticker/Classic mode for Math-Flow. |
| `src/App.tsx:479` | Exposes current number range tiers. |
| `src/lib/generator.ts:179` | Generates arrow/circle path puzzles with arithmetic operations. |
| `src/App.css:444` | Contains print media rules for current worksheet and answer key pages. |
| `src/lib/__tests__/layout.test.ts:76` | Locks exact current circle/arrow geometry for regression safety. |
| `docs/requirements-v2.md:113` | Current Math-Flow requirements explicitly exclude custom sticker count and multiple worksheets per page. |

The new work must be implemented as a separate puzzle family and must not change the current Math-Flow SVG geometry, marker settings, arrow trimming, label anchoring, or the inline snapshot unless the user explicitly confirms a visual geometry change.

## Proposed Change

Add a second puzzle type: Area Sticker Puzzles.

Parents can select this puzzle family from the existing app UI. The worksheet preview switches from the current Math-Flow path puzzle to an area-puzzle worksheet.

Each generated area puzzle contains connected axis-aligned rectangles. Known values are printed inside rectangles or along rectangle edges. Exactly one value is hidden by one sticker per puzzle.

The hidden value can be either:

- a missing side length
- a missing rectangle area

No measurement units are printed in MVP. Labels use plain numbers and `?`, not `in` or `in^2`.

## MVP Controls

Area Sticker Puzzle mode has three sliders.

| Control | Range | Behavior |
|---------|-------|----------|
| Puzzles per page | 1-6 | Requested number of puzzles on one printed page. |
| Number size | Small to large numeric range | Controls side lengths and derived areas without using difficulty presets. |
| Boxes per puzzle | 2-6, constrained by page density | Controls how many rectangles are in each connected puzzle. |

The app must preserve the current Regenerate, Print, Seed, and optional Answer Key concepts.

## Readability Constraints

The UI must prevent impossible or unreadable combinations at the control level.

There is no silent fallback. The visible slider values are the generated values.

Rules:

- `Puzzles per page` range is `1-6`.
- `Boxes per puzzle` range is `2-6`.
- Some combinations are invalid and must be prevented by clamping, disabled slider positions, or dynamic max values.
- The app must never render a worksheet where labels overlap, stickers cover unrelated geometry, or puzzle groups overflow the printed page.

Proposed control constraint matrix:

| Puzzles per page | Max boxes per puzzle |
|------------------|----------------------|
| 1 | 6 |
| 2 | 5 |
| 3 | 4 |
| 4 | 3 |
| 5 | 3 |
| 6 | 3 |

If the parent increases `puzzles per page` beyond what the current `boxes per puzzle` supports, `boxes per puzzle` is reduced to the allowed max immediately and visibly.

If the parent increases `boxes per puzzle`, the `puzzles per page` slider must only allow readable values for that box count.

## Puzzle Generation Rules

The generator must create varied connected rectangle layouts, not only fixed screenshot templates.

MVP constraints:

- Rectangles are axis-aligned.
- Rectangles connect edge-to-edge or through a shared aligned segment.
- Layouts must be geometrically valid: no accidental overlaps except intended shared boundaries.
- Every puzzle has exactly one unknown.
- Every puzzle has exactly one final answer.
- The unknown can be side length or area.
- All generated values must be integers.
- Every puzzle must be solvable from printed information using multiplication, division, and rectangle adjacency logic.
- No units are printed.
- No worked steps are printed on the worksheet or answer key.

## Number Generation Rules

Generated numbers must be integer-only and non-trivial.

Rules:

- All side lengths, areas, and answers are positive integers.
- Do not generate side lengths of `1`.
- Do not generate area facts where one side is `1`.
- Do not generate unknowns solved by identity operations such as `x * 1`, `x / 1`, or `x / x = 1`.
- Do not generate immediate cancellation chains equivalent to `1 * 2 / 2 * 1`.
- Prefer varied factors, areas, rectangle sizes, unknown positions, and layout shapes across puzzles on the same page.
- Repeated facts on one worksheet should be minimized unless the selected number range makes alternatives impossible.

## Sticker Behavior

Each puzzle renders one sticker covering the unknown answer.

Worksheet page:

- The unknown label is shown as a sticker-covered `?`.
- The sticker target must be visually obvious and large enough for a physical sticker workflow.
- The child writes the answer on or near the sticker, then peels/checks.

Answer key:

- Shows the same puzzles with final answers revealed.
- Shows only final answers.
- Does not include worked explanations.

## UX Integration

The feature should fit natively in the existing app:

- Add a puzzle-family selector or equivalent mode control near the current worksheet controls.
- Reuse the existing visual language: paper preview, sidebar controls, seed badge, Regenerate, Print worksheet, answer key toggle.
- Avoid a landing page or separate disconnected flow.
- Keep the first screen as the usable worksheet generator.

## Acceptance Criteria

1. The app offers Math-Flow and Area Sticker Puzzles as separate puzzle families.
2. Switching to Area Sticker Puzzles shows the three requested sliders: puzzles per page, number size, boxes per puzzle.
3. Area Sticker Puzzle controls prevent unreadable combinations instead of silently falling back.
4. The visible slider values are the generated values.
5. Area Sticker Puzzles generate 1-6 puzzles per page.
6. Each area puzzle contains connected axis-aligned rectangles only.
7. Each area puzzle has exactly one sticker-covered unknown.
8. The unknown can be either a side length or a rectangle area.
9. Generated puzzles contain no unit labels.
10. All generated values are positive integers.
11. Generated puzzles avoid trivial identity and immediate cancellation patterns.
12. Generated worksheets maximize variation across shapes, values, unknown type, and rectangle arrangements.
13. Every generated puzzle is mathematically solvable from the printed known values.
14. Answer key mode reveals only the final answers, with no worked steps.
15. Existing Math-Flow output remains deterministic for existing seeds/configs.
16. `src/lib/__tests__/layout.test.ts` remains green without snapshot changes unless the user explicitly approves a current Math-Flow geometry change.
17. Browser verification is completed before implementation handoff: exact URL/seed, screenshot of worksheet preview, and print-media/PDF check.

## Testing Plan

| Layer | What | Count |
|-------|------|-------|
| Unit | Area puzzle generator determinism by seed/config | +3 |
| Unit | Generated rectangle layouts have selected box counts and no invalid overlaps | +4 |
| Unit | Every generated unknown has a single integer solution | +6 |
| Unit | Number-size slider bounds generated side lengths/areas | +3 |
| Unit | Readability constraints clamp or disable impossible slider combinations | +3 |
| Unit | Non-trivial generation rejects side length 1, area facts with 1, identity operations, and immediate cancellations | +5 |
| Unit | Worksheet-level variation across layouts, values, and unknown types | +3 |
| Regression | Existing Math-Flow generator and layout tests remain unchanged | existing tests |
| Browser | Area mode renders selected controls and puzzle preview | +1 scripted check |
| Browser | Print media hides sidebar and keeps selected area puzzles on printable page | +1 scripted print/PDF check |
| Browser | Answer key reveals only final answers | +1 scripted check |

## Files Reference

| File | Change |
|------|--------|
| `src/App.tsx` | Add puzzle family selection and Area Puzzle UI state/rendering. |
| `src/App.css` | Add Area Puzzle worksheet, sticker, grid/page-density, control constraint, and print styles. |
| `src/lib/generator.ts` | Do not modify current Math-Flow generator behavior unless extracting shared seed utilities only. |
| `src/lib/areaGenerator.ts` | New deterministic area puzzle generator. |
| `src/lib/__tests__/areaGenerator.test.ts` | New area puzzle math/geometry/control tests. |
| `src/lib/__tests__/layout.test.ts` | Must remain green; no snapshot update for this feature. |
| `docs/area-puzzles-mvp.md` | Locked product and implementation spec. |

## Out of Scope

- Non-rectangle shapes.
- Custom student name.
- Custom worksheet title.
- Saving multiple generated pages.
- Interactive browser solving.
- Worked explanations in the answer key.
- Printing units such as `in` or `in^2`.
- Changing current Math-Flow arrow/circle geometry.
- Updating the existing geometry snapshot without explicit visual approval.

## Rollback Plan

Revert the Area Sticker Puzzle files and UI switch. Existing Math-Flow behavior should remain untouched, so rollback should not require snapshot updates or migration work.

## Effort Estimate

| Work | Estimate |
|------|----------|
| Area puzzle data model and generator | 4-6 hours |
| Area puzzle renderer | 4-6 hours |
| Sidebar/state integration | 2-3 hours |
| Control constraints and print readability layout | 3-5 hours |
| Tests | 4-6 hours |
| Browser verification and PDF/screenshot artifacts | 1-2 hours |

Total: 18-28 hours.
