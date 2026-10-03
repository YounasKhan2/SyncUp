# SyncUp Design System Foundation 02 â€” Semantic Tokens + Tailwind Wiring

## A. Git/base

Verified clean main at `d9324b16475783681aece801fcb5b0a7935ad77d`; branch `design/syncup-tailwind-semantic-wiring-02`. Approved Phase 01 report and semantic-contract.json were read completely and remain unchanged. Production source is identical between this main and the preserved raster base `0c74acf8f54a7dc1a8a235eae43dea9893d264fd`. No architecture decomposition or consumer migration.

## B. Baseline

All six gates ran before production changes, exit 0, zero skips: client/server typecheck; 226/226 standard tests (42,164.3884ms); architecture 276 edges / 21 informational / 0 violations; build; Media V2 11/11 (208.2227ms); real integration 1/1 (26,856.5076ms). Existing large-chunk/dynamic-import build warnings remain. Baseline/candidate ledgers and full logs: evidence-02/verification-ledger.json and verification-logs.ndjson.gz.

## C. Tailwind version/integration

Registry latest resolved to tailwindcss 4.3.3 and @tailwindcss/vite 4.3.3, consistent with [official Vite integration](https://tailwindcss.com/docs/installation/using-vite). Plugin peer range `^5.2.0 || ^6 || ^7 || ^8` covers installed Vite 8.3.1. Install command: `npm install --workspace client --save-dev --save-exact tailwindcss@4.3.3 @tailwindcss/vite@4.3.3`. Exact pins; no obsolete major, CLI/UI/component library.

## D. Package/config changes

client/package.json adds exactly two development dependencies. Lockfile changes only the existing client dependency entry; all pre-existing package versions/metadata remain identical. There are 38 necessary new lock entries including platform-optional Oxide/Lightning CSS binaries; 17 packages installed on Windows. dependency-diff.json lists exact names/versions. npm reported zero vulnerabilities and an esbuild install-script warning; no install-script policy change.

Vite preserves React and API proxy, appending `tailwindcss({optimize:false})`. Existing Vite minification stays authoritative rather than applying an additional whole-stylesheet optimizer. This is a conservative legacy-pipeline boundary. Raster sharpness variation was initially attributed to optimization after a single-scene check; broader unchanged-build observations disproved that attribution. This option is not claimed as a proven raster fix.

## E. Canonical token implementation

150 unique canonical variables: 33 colors/companions/aliases, one shadow RGB, 60 typography fields, 17 spacing steps/roles, six radii, eight control dimensions, five breakpoints, ten layers, four elevations, three durations and three easings. Namespaces: ds-color, ds-type-role-field, ds-space, ds-radius, ds-control, ds-breakpoint, ds-layer, ds-elevation, ds-duration, ds-ease and ds-shadow-rgb.

Exact approved Light/Dark palettes and five solid-fill companions; border-strong aliases secondary text, inverse aliases brand foreground, status-soft foreground aliases primary. The prose status-text policy consumes primary text when accent contrast fails. Four soft fills preserve 10% sRGB mixes. Shadow RGB is Light 39 34 40 / Dark 0 0 0. Elevation-none's prose rationale becomes CSS none; optional border is a future consumer decision. No contract redesign.

## F. Light/Dark/System resolution

Existing selectors preserved: Light root; Dark data-theme; OS Dark media / root without data-theme. Light fallback is root. appearance.ts, storage, main lifecycle and listeners unchanged; no dark class/new persistence.

Four browser modes invoke real production applyAppearancePreference after OS matching is stabilized before initialization: Light, Dark, System OS Light, System OS Dark. theme-proof.json records 150 canonical variables, 59 legacy/font/type properties and 35 utility probes per mode. Approved palette/companions, effective theme, colorScheme and OS probes are verified. Native pre-initialization fallback selectors/values are statically checked; live OS switching is not claimed.

## G. Legacy compatibility

Canonical colors own values; every existing color consumer remains an alias. Font stack, 110% root and 20 old type sizes unchanged. Recursive resolution checks every historical custom property across all three root branches, including color-mix and overlays, with missing/cyclic references rejected. Existing rendered computed values are compared exactly; new infrastructure properties are enumerated separately. No old variable removed.

## H. Tailwind semantic mapping

Utilities-only import into a low-priority layer, without Preflight/default theme, follows [selective import guidance](https://tailwindcss.com/docs/preflight). Theme uses inline prefix(ui), separate framework --ui namespace and mandatory ui: classes. Prefix on the theme is tested to prevent legacy collisions/self-aliasing. Default namespaces reset with --*: initial.

| Example | Canonical meaning |
|---|---|
| ui:bg-canvas/sidebar/surface/elevated/hover | Corresponding color role |
| ui:text-primary/secondary/muted/inverse | Text roles |
| ui:border-default/strong | Border / stronger border |
| ui:bg-brand / ui:bg-brand-hover | Brand / hover |
| ui:text-brand-foreground | Contextual companion |
| ui:bg-message-incoming/outgoing | Message fills |
| ui:ring-focus | Focus color; width/separator explicit |
| ui:text-body / ui:text-caption | Complete typography role |
| ui:p-1 / ui:gap-panel | 2px / 24px |
| ui:rounded-xs/full | 4px / 9999px |
| ui:shadow-raised/modal | Themed elevation |
| ui:duration-fast / ui:ease-standard | 100ms / standard curve |
| ui:two-pane:bg-canvas | Minimum 701px |
| ui:z-call-overlay / ui:z-a11y | Future 60 / 100 |

Proof CSS is archived, never imported by normal users. Existing unlayered selectors retain priority; future migrations deliberately retire competing selectors.

## I. Typography wiring

Ten custom text utilities carry family, size, line-height, weight, tracking and transform. They avoid competing built-in size-role definitions. Family resolves through unchanged font-sans.

| Role | Size | Line-height | Weight | Tracking | Transform |
|---|---|---:|---:|---|---|
| display | 1.5rem | 1.2 | 650 | -.025em | none |
| h1 | 1.125rem | 1.3 | 650 | -.015em | none |
| h2 | 1rem | 1.35 | 600 | -.01em | none |
| h3 | .9375rem | 1.4 | 600 | 0 | none |
| body-lg | .875rem | 1.5 | 400 | 0 | none |
| body | .8125rem | 1.5 | 400 | 0 | none |
| body-sm | .75rem | 1.5 | 400 | 0 | none |
| label | .75rem | 1.4 | 600 | 0 | none |
| caption | .6875rem | 1.4 | 400 | 0 | none |
| overline | .6875rem | 1.4 | 700 | .06em | uppercase |

No current consumers adopt intentional future visual changes. Proof body computes 14.3px, overline uppercase. Tiny-type/accessibility debt is retained.

## J. Spacing/radius/elevation/motion wiring

Spacing 1â€“9: 2/4/6/8/12/16/24/32/48px, plus approved named roles. Radii xs/sm/md/lg/xl/full: 4/6/8/10/14/9999px. Elevation none, raised 0 2px 8px at 8%, overlay 0 8px 24px at 12%, modal 0 18px 50px at 18%, using theme RGB. Durations 100/150/250ms; curves standard(.2,0,0,1), enter(0,0,.2,1), exit(.4,0,1,1). Existing transitions/animations/reduced-motion selectors frozen. Control dimensions available, unapplied.

## K. Breakpoints/layers

Compile-time px breakpoints and canonical constants: narrow-phone420, voice-compact620, two-pane701, media-wide761, workspace-wide1100. No default sm/md/lg assumptions. Existing max420/620/700/760/1099 queries unchanged; fractional conversions need later evidence. Layers base/sticky/popover/dropdown/overlay/modal/toast/call-overlay/media/a11y = 0/1/12/13/15/45/50/60/70/100. Current stacking unchanged.

## L. Source detection

source(none) disables repository-wide discovery; source ../../ relative to shared/styles resolves exactly to client/src, including future client TS/TSX. Server, evidence, .git, node_modules and dist are outside this root or normally excluded. Isolated proof adds only its own explicit TSX source; proof classes never enter production discovery.

## M. Static checks

Six new standard tests protect approved theme/companion/scales; exact cycle-free legacy resolution; source/prefix/Preflight/Vite wiring; frozen feature TS/TSX/appearance/legacy CSS after Git checkout newline normalization; approved-only new literals; and actual Vite compilation of 35 representative utilities with full typography/breakpoint/layer assertions.

The obsolete token-file hash guard conflicted with authorized infrastructure changes. It now preserves the original-token digest and checks every legacy resolved value and non-custom root declaration across every theme branch. Primitive/import-order protections and platform text/multiplicity/media/keyframe ownership checks remain. Narrow Phase 02 correction, not a legacy-debt waiver.

## N. Cascade proof

Ordering: tokens, semantic utility infrastructure, unchanged index root/reset, platform-shell, spaces, platform, primitives. Four legacy stylesheets and App.css unchanged. No Preflight/global reset/feature migration. Real fixtures cover Workspace/inbox/CallsHome/incoming banner, Conversation/composer/report dialog, Account sessions, Updates and Spaces text.

Historical bytes/hash manifest are preserved, not regenerated. Separate unchanged-main full-style observations supplement the original 200-property/depth-limited serializer, without replacing any historical screenshot.

## O. DOM/style/bounds/focus parity

64 cases: CSS1440Ã—900 /390Ã—844, DPR1.190000057220459, Light/Dark/System OS Light/System OS Dark. Effective theme, appearance, colorScheme, pre-init OS probes, loaded fonts, empty diagnostics and dimensions/DPR asserted.

10,584 element observations per side; 5,704,776 existing computed-property comparisons. DOM/classes/IDs/ARIA/child order/values/bounds/focus and all existing properties require exact equality. New ds/ui variables are separately enumerated infrastructure additions. Flat nodes and 100-property chunks avoid serialization caps; historical truncation locations recorded explicitly. Account scrolling/debug hiding identical. No exhaustive keyboard focus-state claim.

## P. Raster comparison

Authoritative totals and per-case decoded counts/percentages/bounds/connected regions/product intersections are in visual-summary.json and visual-comparisons.json.gz. RGB/channel equality with zero masks/crops/tolerance; three final frames and stable warmups/repeats per side. Historical differences remain reported, including repeated unchanged-base comparisons.

The capture backend produces different sharpness after viewport/tab initialization despite identical effective dimensions/DPR and full styles. Unchanged builds reproduce this; it cannot be attributed to production CSS. Setup captures are separate from stabilized paired measurements. Earlier optimizer attribution was disproved; diagnostic reports/raster/encoding tables are retained. Same-batch base/HEAD evidence is the direct product parity proof. Exact internal sharpness mechanism remains unresolved.

Final paired result: **192/192 base-versus-HEAD comparisons byte- and pixel-identical**, zero changed pixels/regions. Same unchanged HEAD and base repeats: 384/384 equal; warmup-to-warmup/final comparisons: 384/384 equal. Total decoded comparisons 1,344, of which 1,182 are equal. The 162 unequal comparisons are 81 historical-to-HEAD plus 81 historical-to-unchanged-base. Historical images match directly in 111/192 frames (37/64 cases); the other 27 cases differ identically on the unchanged base and HEAD. Changed count, percentage, bounding box, connected regions and maximum channel difference are exactly reproduced on unchanged base for every historical discrepancy. This is evidence of capture variation, not a blanket harmless assertion. The exact backend mechanism is still unknown.

Historical differences, one row per case (all three repeats reproduce each row; all touch the product root). Full connected regions/product intersections are retained in compressed evidence:

| Case | Changed pixels | Percent | Bounding box |
|---|---:|---:|---|
| desktop-dark-light-account-updates-account-sessions | 186171 | 14.365046296 | [474, 8, 966, 900] |
| desktop-dark-light-account-updates-updates-items | 247277 | 19.412910904 | [111, 31, 1297, 892] |
| desktop-dark-light-conversation-conversation | 143724 | 11.089814815 | [0, 0, 1440, 900] |
| desktop-dark-light-conversation-report | 174485 | 13.463348765 | [0, 0, 1440, 900] |
| desktop-dark-light-spaces-text | 135412 | 10.448456790 | [0, 0, 1440, 456] |
| desktop-dark-light-workspace-calls | 77358 | 5.968981481 | [0, 0, 1073, 900] |
| desktop-dark-light-workspace-direct | 99270 | 7.659722222 | [0, 0, 1440, 900] |
| desktop-dark-light-workspace-inbox | 80591 | 6.218441358 | [0, 0, 1440, 900] |
| desktop-light-light-account-updates-account-sessions | 217660 | 16.794753086 | [0, 0, 1440, 900] |
| desktop-light-light-account-updates-updates-items | 213083 | 16.728451470 | [111, 31, 1297, 892] |
| desktop-light-light-conversation-conversation | 132689 | 10.238348765 | [0, 0, 1440, 900] |
| desktop-light-light-conversation-report | 219595 | 16.944058642 | [0, 0, 1440, 900] |
| desktop-light-light-spaces-text | 115070 | 8.878858025 | [0, 0, 1440, 456] |
| desktop-light-light-workspace-calls | 70747 | 5.458873457 | [0, 0, 1073, 900] |
| desktop-light-light-workspace-direct | 85854 | 6.624537037 | [0, 0, 1440, 900] |
| desktop-light-light-workspace-inbox | 68974 | 5.322067901 | [0, 0, 1440, 900] |
| desktop-system-light-account-updates-account-sessions | 219511 | 16.937577160 | [0, 0, 1440, 900] |
| desktop-system-light-account-updates-updates-items | 213083 | 16.728451470 | [111, 31, 1297, 892] |
| desktop-system-light-conversation-conversation | 132689 | 10.238348765 | [0, 0, 1440, 900] |
| desktop-system-light-conversation-report | 219595 | 16.944058642 | [0, 0, 1440, 900] |
| desktop-system-light-spaces-text | 115070 | 8.878858025 | [0, 0, 1440, 456] |
| desktop-system-light-workspace-calls | 70747 | 5.458873457 | [0, 0, 1073, 900] |
| desktop-system-light-workspace-direct | 85854 | 6.624537037 | [0, 0, 1440, 900] |
| desktop-system-light-workspace-inbox | 68974 | 5.322067901 | [0, 0, 1440, 900] |
| mobile-light-light-workspace-calls | 45504 | 13.824279985 | [0, 0, 360, 844] |
| mobile-light-light-workspace-direct | 29935 | 9.094361405 | [16, 16, 390, 832] |
| mobile-light-light-workspace-inbox | 47133 | 14.319176085 | [0, 0, 390, 844] |

A transient mobile Conversation pair differed by 2,575 pixels (0.782294325%), including product regions. Repeated navigation of the same unchanged builds reproduced the capture variation; final paired repeats match exactly. Both rejected raw frames and decoded cross-navigation differences are retained in same-build-navigation-diagnostic.json. No screenshot is edited to obtain equality.

## Q. Architecture/build

276 edges /21 informational /0 violations. Checker supplies no general cycle count; none claimed. Typecheck/build pass; existing chunk/dynamic-import warnings remain. React/Vite/proxy/aliases unchanged.

## R. Integration

Real baseline/candidate HTTP integration 1/1, zero skips. Repeated candidate runs hit unchanged 15-minute/10-attempt authentication limit; failed log retained, retry passed after normal expiry (45,849.4926ms). No limit reset, service restart, database reset or configuration workaround. Media V2 11/11. All six gates run again on committed HEAD before push; PR records exact final SHA/results, avoiding a self-referential evidence hash.

## S. Production diff

Exactly six files: client/package.json, package-lock.json, client/vite.config.ts, client/src/index.css, client/src/shared/styles/tokens.css, new client/src/shared/styles/tailwind.css. Root package unchanged. Feature TS/TSX, appearance, server/database, legacy selectors and all runtime/API/auth/crypto/realtime/media/Calls behavior unchanged. Other changes are tests/helpers/docs/evidence.

## T. Limitations

Fixtures seed root state/suppress API effects as Phase 01. No authenticated browser, active CallsWindow/LiveKit, live upload/crypto/realtime UI or exhaustive keyboard/modal claim. Real integration reported separately. Live OS switching/fractional responsive migration not proven. Historical serializer and renderer sharpness limits explicit; no fabricated historical equality or blanket harmless classification.

## U. Phase 03 recommendation

Bounded shared Button/IconButton presentation migration, preserving native/ref/disabled/focus/callback contracts, before pages/dialogs. Touch-area/type/state redesign needs explicit review. No migration starts here; stop after open, unmerged PR.
