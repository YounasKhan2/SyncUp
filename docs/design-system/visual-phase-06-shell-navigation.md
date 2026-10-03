# Visual Phase 06 — Shell + Navigation

## A. Git/base

Repository: `YounasKhan2/SyncUp`. Required and verified `origin/main` base: `bf407baf96aa0e9329f143e1ffa01280d664172a`. Branch: `design/syncup-shell-navigation-06`. Commit: `design: redesign shell and navigation`. The final commit SHA and PR URL are reported in the PR and completion response. Do not merge; stop for review.

This is an intentional visual redesign using the existing Warm Stone + Plum contract. Pixel parity is not its acceptance criterion. Runtime, shared primitives, tokens, packages, server, database and configuration stay frozen.

## B. Baseline

The clean required base passed all six gates before production edits: typecheck, 249/249 tests with zero skips, architecture, client/server build, Media V2 11/11 and real integration 1/1. Logs and command results are in [evidence-06](evidence-06/). The navigation characterization test also passed before styling.

The baseline build always comes from `git archive` of the required base. Candidate builds replace only the six declared production files. Both use the identical test fixture, test API boundary and preinitialization theme bootstrap. The baseline was not generated from candidate code. Initial desktop/mobile observations are retained in `preimplementation.ndjson.gz`; accepted comparison records are in `captures.ndjson.gz`.

## C. Shell ownership audit

[ownership-before.json](evidence-06/ownership-before.json) records 241 relevant rules, including selector-level ownership, declarations, source lines, media nesting and mixed ownership. Categories: SHELL_OWNED, NAVIGATION_OWNED, FEATURE_OWNED, SHARED_PRIMITIVE, GLOBAL_REQUIRED and LEGACY_COUPLING. Mixed selector lists are split without changing their surviving feature declarations or cascade order.

Owned presentation includes the Workspace canvas, desktop rail, its BrandMark presentation, four navigation controls, rail profile trigger, navigation badges, Inbox outer surface and mobile bar. Shared Avatar/BrandMark implementations and feature-owned descendants remain exact.

Compatibility retained: 72px/280px desktop columns; 56px/248px compact columns; mobile 60px row plus safe-area inset; 700px switch; 1100px wide rail split; mobile z-index 8; pane visibility and active-state selectors; global focus rules; feature color overrides. The obsolete rail glyph and duplicate navigation theme overrides are removed with owned declarations.

Three cascade/layout findings required local presentation decisions:

- Global unlayered `button { font: inherit }` overrides layered utility typography on the button. Semantic typography is applied to its label span instead, preserving global and feature fonts.
- Tailwind border-width utilities register `--tw-border-style` globally. Scoped border geometry in the existing CSS avoids that computed-property change on unrelated elements. Color and most presentation remain semantic utilities.
- The pre-existing mobile Calls desktop grid placement collapses the first grid column. The bar uses `ui:w-dvw` so its five controls retain a full-viewport footprint independently of that column. Calls placement/content and the collapsed Inbox column in that scene are unchanged and remain a separate limitation.

## D. Behavior contract

Navigation order remains Chats, Calls, Updates, Spaces, then profile/You. Every callback, `type="button"`, accessible label, `aria-current`, conditional branch, count and badge cap is unchanged. A visual `99+` still announces the real count, including 140. Account-open precedence remains mobile-only as before. Desktop Chats/Calls retain an active chat; mobile entry clears it. Updates/Spaces retain their existing transition contracts.

An AST comparison removes only JSX class attributes and requires every other part of all four changed TSX files to match the base. An 80-case characterization matrix (160 before/after renders) compares destination/account/count combinations and executes all callback identities. Existing full Workspace behavioral tests remain active. Historical frozen-file guards restore only the exact independently checked Phase 06 presentation, then apply their original checks.

## E. Visual goals

Preserve a compact communication workspace. Differentiate sidebar, inbox surface and canvas through existing neutral roles. Make destination selection visible through a contained fill and a directional border, improve navigation labels and profile targeting, and retain plain surfaces without gradients, glass, cards or large spacing.

Every intentional category is COLOR, TYPOGRAPHY, SPACING, RADIUS, BORDER, STATE, SURFACE, ICON_PRESENTATION or RESPONSIVE_SHELL. [css-before-after.json](evidence-06/css-before-after.json) records exact owned selectors/declarations and utilities; `comparisons.json.gz` records each owned computed-style/bounds change.

## F. Desktop rail

The rail frame remains 72px wide, or 56px in compact desktop mode. Semantic gap changes from 18px to 12px; inline padding becomes 4px. Navigation controls use a 48px width and minimum height, a 2px reserved selected edge and the 8px `md` radius. BrandMark becomes a 32px box with a 24px SVG and 10px radius, confined to the rail. Navigation SVG families, paths and 15px dimensions remain unchanged.

The profile trigger expands from the original 31px Avatar footprint to a 48px target, with a small separator and semantic hover/focus treatment. Avatar fallback/image behavior is frozen; only this trigger's child colors use brand-soft and primary text.

## G. Navigation states

Default secondary text sits on sidebar. Hover uses primary text on hover. Selected uses primary text on selected, with a plum left edge on desktop or top edge on mobile. Selection therefore has a shape cue in addition to color and `aria-current`. Mobile selected labels use the label role; other mobile labels use caption.

Focus uses the existing focus token with a 2px outline and 2px offset through a navigation-only selector. Global/feature focus rules remain exact. No disabled destination behavior is introduced: these navigation controls have no disabled state in the existing contract. Counts 0, 1, 99, 100 and 140 are tested; zero removes the badge, while 100/140 show `99+`.

## H. Mobile navigation

Five equal columns retain native button controls. Horizontal padding is 8px, top/bottom padding 4px, and bottom safe-area inset remains supported. The nominal row remains 60px plus inset; captures at 390px show approximately 75×51px targets. All sampled targets are at least 44px, including the 320px layout.

The bar's explicit `100dvw` width prevents overlap under the existing Calls grid coupling. It changes only navigation-owned layout; feature style/bounds comparisons remain exact. User/account ordering and selected precedence remain unchanged.

## I. Surface hierarchy

Workspace canvas: canvas. Rail/mobile bar: sidebar. Inbox outer surface: surface. Separators: border. Selected destinations: selected with brand edge. Profile fallback: brand-soft/primary. Badge: danger/danger-foreground.

The Inbox surface change intentionally changes pixels behind transparent rows. ChatRow markup, text, typography, computed styles and bounds are unchanged. No row or feature-content recolor is included. Conversation welcome, Calls content and Account content match outside owned regions.

## J. Typography

Desktop labels and badges use the approved label role. Mobile labels use caption, switching the selected label to label. No raw size, tracking or line-height token was added. The existing 110% root font scale remains unchanged: sampled label is 13.2px and caption 12.1px. Static utility classes are verified against production source detection.

## K. Spacing/radius

Use the existing scale: 2px icon/label gap, 4px control padding, 8px mobile inline padding, 12px rail gap, 48px control footprint. Existing semantic `md`, `lg` and full radii govern controls, BrandMark and badges. Badge offsets remain the existing -6px/-9px positioning compatibility. Pane widths, heights and all unaffected feature bounds are preserved.

## L. Color/theme

No token changes. Theme initialization is deterministic before CSS/module loading: the test bootstrap stabilizes `(prefers-color-scheme: light/dark)`, sets appearance/effective theme/color-scheme, then the unchanged production appearance function resolves the preference. Light and Dark are explicit. System is captured separately with light and dark OS preferences. Every record verifies effective theme, preference probes, loaded fonts, DPR, viewport and zero browser diagnostics.

This stabilizes a test browser media-query boundary; it does not modify the user's OS preference. Both sides use the same browser/tab, configuration and capture procedure.

## M. Dark mode

Sidebar `#1D1A20`, surface `#211E24`, canvas `#17151A`, selected `#352A33` and brand `#C99ABD` come from the existing contract. All legacy rail/mobile dark patches are removed; unaffected feature dark declarations retain their original order and values. Account modal presentation remains exact in paired Light, Dark and both System modes.

## N. Responsive behavior

1440×900 and 390×844: seven scenes × Light, Dark, System-light, System-dark, yielding 56 pairs. Additional Light/Dark captures at 320, 699, 700, 701, 768, 1024, 1099, 1100 and 1101px yield 18 boundary pairs, all 900px tall. Total 74 pairs.

At/below 700px the rail is hidden and mobile bar is visible; at/above 701px the reverse applies. Compact desktop columns remain until 1099px, with the original wide columns at 1100px. No breakpoint, hook media query or pane width changes.

## O. Accessibility

Measured rendered samples, not a broad product WCAG claim:

| Pair | Light | Dark |
| --- | ---: | ---: |
| Default label/sidebar | 4.57:1 | 7.90:1 |
| Selected label/selected | 11.70:1 | 11.75:1 |
| Badge foreground/danger | 5.00:1 | 6.20:1 |
| Selected accent/selected | 4.82:1 | 5.78:1 |
| Focus/sidebar | 3.41:1 | 8.35:1 |

The lowest measured focus contrast against the selected fill is 3.06:1. [contrast-measured.json](evidence-06/contrast-measured.json) contains actual computed samples. All tested navigation targets meet 44px minimum dimensions.

48 exact native keyboard step pairs cover desktop/mobile in Light/Dark: skip-link Enter, main Tab, destination Enter/Space, forward/backward Tab, profile Enter, existing Escape behavior and close Enter. No focus trap, restoration or Escape behavior is added to Account. Navigation has `animation-name: none` and `transition-duration: 0s` throughout; it adds no motion under any preference.

## P. Legacy CSS removed

`platform.css`: 1301→1274 lines, a 27-line reduction. Physical declarations: 2992→2919, net -73. Owned selector sites: 57→27. Owned declaration-selector sites: 156→53. Counts treat repeated selectors under different theme/media contexts as separate sites; they do not count utility-generated CSS as source declarations.

`platform-shell.css`: 105→105 lines, physical declarations 245→244; only the obsolete Workspace background declaration is removed in favor of its canvas utility. Detailed removal and retained compatibility rules are in [css-removal.json](evidence-06/css-removal.json) and [css-before-after.json](evidence-06/css-before-after.json). All non-owned selectors, declarations and their cascade order pass exact comparison.

## Q. Production files

| File | Reason |
| --- | --- |
| `client/src/features/workspace/WorkspacePage.tsx` | Static canvas class only. |
| `client/src/features/workspace/components/WorkspaceRail.tsx` | Rail/control/profile/BrandMark presentation classes only. |
| `client/src/features/workspace/components/MobileNavigation.tsx` | Bar/control/label/badge presentation classes, including independent viewport width. |
| `client/src/features/workspace/components/InboxPane.tsx` | Root surface/text/border classes only; content remains exact. |
| `client/src/shared/styles/platform.css` | Remove obsolete owned navigation declarations; retain local focus/border geometry and all feature CSS. |
| `client/src/shared/styles/platform-shell.css` | Transfer Workspace background to canvas utility. |

Tests/evidence include two new focused suites, exact before/after fixtures, browser/build/audit/archive helpers and narrowly adapted historical guards. No other production file, token, shared primitive, runtime hook, API, server, package or configuration changes.

## R. Before/after evidence

Representative captures retain full viewport, without overlays or cropping:

| Surface | Before | After |
| --- | --- | --- |
| Desktop Light | [base](evidence-06/base-desktop-light.jpg) | [candidate](evidence-06/head-desktop-light.jpg) |
| Desktop Dark | [base](evidence-06/base-desktop-dark.jpg) | [candidate](evidence-06/head-desktop-dark.jpg) |
| Mobile Light | [base](evidence-06/base-mobile-light.jpg) | [candidate](evidence-06/head-mobile-light.jpg) |
| Mobile Dark | [base](evidence-06/base-mobile-dark.jpg) | [candidate](evidence-06/head-mobile-dark.jpg) |
| Mobile Calls navigation coupling | [base](evidence-06/base-mobile-calls-light.jpg) | [candidate](evidence-06/head-mobile-calls-light.jpg) |

Scenes: Inbox, Calls selected, 140 unread, no badge, actual Account modal activation, native focus and actual pointer hover. Fixtures/debug controls are hidden identically on both sides. An API shim serves synthetic Account data, and the real navigation hook, rail, Inbox, ChatRow, CallsHome, ConversationWelcome, MobileNavigation and AccountPanel are rendered.

444 accepted full screenshots (three per build/case), with native DOM snapshots, all computed properties, bounds, focus, diagnostics and warmups. Both builds use the same IAB browser and DPR `1.190000057220459`; viewport overrides account for that DPR and assert the actual CSS dimensions. An unchanged-base preflight stabilizes capture after resize. No animations, colors or rendering styles are disabled for screenshots.

Every one of the 222 cross-build comparisons changes intentionally: 23,378–580,310 pixels. Example desktop Light Inbox: 263,998 pixels, 20.3702%, bounding box `[0,0,352,900]`; mobile Light Inbox: 304,333 pixels, 92.4575%, `[0,0,390,844]`; mobile Calls Light: 23,378 pixels, 7.1023%, `[0,783,390,844]`. These changes touch actual owned product UI. Per-case percentages, bounding boxes, connected regions and region counts are preserved; none is dismissed as harmless noise.

All 444 same-build final comparisons and 296 warmup comparisons are byte/pixel identical. Zero changed pixels outside the union of baseline/candidate owned rail, Inbox and mobile rectangles. The changed mobile Calls navigation footprint is included explicitly in that union. No input pixels are masked, thresholded, cropped or tolerated.

`captures.ndjson.gz` deduplicates repeated payloads by SHA-256 while retaining every record/path. `comparisons.json.gz` contains decoded comparison results and owned style/bounds changes. `manifest.json` verifies committed evidence files. See [evidence README](evidence-06/README.md) for reproduction and extraction.

## S. Structural regression

All 74 pairs preserve exact node count/tag, non-presentation attributes, IDs, ARIA, text, child order, values and focus. Only declared presentation classes are normalized for semantic comparison. Every computed property and bound outside owned nodes is exactly equal, including ChatRow, ConversationWelcome, CallsHome and Account content. Owned style/bounds differences are recorded rather than normalized away. No new global custom-property differences remain.

Responsive visibility, five nonoverlapping mobile controls, minimum target dimensions and zero navigation animation/transition are also checked. Existing runtime transition tests, full-source guards and feature CSS cascade guards remain enabled.

## T. Test/gate results

| Gate | Baseline | Candidate |
| --- | --- | --- |
| `npm run typecheck` | Pass | Pass |
| `npm test` | 249/249, zero skips | 253/253, zero skips |
| `npm run check:architecture` | Pass | Pass: 276 edges, 21 unchanged informational couplings, zero violations |
| `npm run build` | Pass | Pass, client and server |
| `npm run test:media-v2` | 11/11 | 11/11 |
| `npm run test:integration` | Real 1/1 | Real 1/1 |
| `git diff --check` | Pass | Pass |

Baseline and final precommit logs are committed with evidence. The six gates are repeated on committed branch HEAD before pushing; committed-head logs remain in `.git/visual06/final-*.log` and results/HEAD are reported in the PR and completion response. Existing chunk-size and ineffective-dynamic-import build warnings remain; no package/configuration workaround is introduced.

## U. Known limitations

Evidence uses a single IAB desktop browser with synthetic fixture data; it is not a live authenticated whole-product exploratory session or a multi-browser/device certification. Safe-area inset is retained and is zero in this environment; physical notched devices are not exercised. Account API effects are mocked in browser evidence, while the separate real integration gate exercises the existing server flow.

The pre-existing mobile Calls implicit-grid-column placement still collapses its Inbox column and clips Calls content. This phase fixes only bottom-navigation containment; no Calls feature/layout behavior is altered. Updates/Spaces content is not redesigned or exercised in these visual fixtures; navigation to those destinations is covered by the real hook/native activation and existing Workspace tests. Existing Account Escape/focus-restoration behavior is preserved.

No production uncertainty was hidden by screenshot tolerances. Intentional owned changes are fully recorded, and repeated unchanged captures are identical.

## V. Recommendation for next surface

After ChatGPT review, Inbox row/list presentation is the next coherent visual surface. The separate pre-existing mobile Calls grid coupling should receive a focused review before a Calls visual phase. Neither task is implemented here. Stop without merging or beginning another phase.
