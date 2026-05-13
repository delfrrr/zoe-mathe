# Agents Playbook

## Key Learnings

1. Protect sensitive rendering paths.
- By default, assume no changes in drawing subsystem unless explicitly requested.
- Only add narrowly scoped conditionals for the requested feature.



## Critical Test Note: Arrow/Circle Geometry

Why this is critical:
- Agents can pass build/unit checks while still introducing subtle visual regressions in arrow drawing.
- Arrowhead placement, line trimming, and op/operand label anchors are especially easy to break and hard to catch without deterministic checks.
- Manual visual inspection alone is not reliable enough for this subsystem.

Required safeguard:
- Treat [src/lib/__tests__/layout.test.ts](/Users/vladi/dev/zoe-mathe/src/lib/__tests__/layout.test.ts) as a release-critical regression test for worksheet rendering geometry.
- Any change touching puzzle SVG geometry, positioning math, or marker settings must keep this test green.
- If intentional geometry changes are requested, update the snapshot only after explicit visual confirmation from the user.

## Mandatory Browser Verification Before Handoff

Rule:
- For any UI/print/layout/styling change, the agent must verify behavior in a real browser before handing over.
- Build/tests alone are not sufficient for sign-off.

How to verify (required sequence):
1. Start or confirm local app is running (e.g. `npm run dev`).
2. Open the exact user URL/seed in browser.
3. Validate target selectors/areas directly (not just visual guesswork).
4. Capture evidence:
- one screen screenshot of the changed area
- one print-media check (or print PDF capture if print behavior changed)
5. For print tasks, verify all requested print constraints explicitly:
- page count behavior
- hidden/visible elements
- spacing and overflow
6. Only then report completion, including:
- what was checked
- exact URL used
- pass/fail for each requested behavior
- artifact paths (screenshots/PDF) when available

Suggested implementation approach:
- Prefer Playwright for deterministic checks.
- If Playwright is missing:
1. install dependency (`npm i -D playwright`)
2. install browser binary (`npx playwright install chromium`)
3. run scripted checks for visibility/style assertions
4. save screenshots/PDF to `/tmp` and report paths

Failure policy:
- If browser verification is not possible, do not claim task complete.
- Report the blocker explicitly and ask for permission/direction.
