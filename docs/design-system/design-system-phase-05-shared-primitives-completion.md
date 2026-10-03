# Phase 05 — Shared primitives completion

## A. Git/base
PR #35 was merged at its verified head before starting. Authoritative post-Avatar main: `fe285890cb8bebc71fcceaaea280dc7c50038227`. Clean checkout; branch `design/syncup-shared-primitives-completion-05`.

## B. Baseline
All six baseline gates pass: typecheck, 244/244 tests (zero skips), architecture 276 resolved edges/21 informational dependencies/zero violations, build, Media V2 11/11, real integration 1/1. Exact logs retained for evidence packaging.

## C. Primitive audit
Production TSX inventory: 45 files, 165 raw button sites, 44 inputs, 11 textareas, 10 selects, 59 labels, two shared Dialog consumers and two FullEmojiPicker consumers. These are static JSX occurrences, not runtime rendered counts. `evidence-05/production-ui-inventory.json` records every JSX opening with file, line and props, including conditional/repeated branches.

## D. Classification matrix
This classification was documented before any production implementation. Existing Button, IconButton and Avatar remain approved foundations, unchanged. BrandMark is explicitly excluded.

| Candidate | Classification | Evidence and decision |
|---|---|---|
| Dialog | MIGRATE_EXISTING | Two consumers: AccountPanel and ReportDialog. Stable inline overlay/section and native section extensions; consumer-owned mount/dismissal. Transfer exact overlay position/display/centering/background and panel box sizing only. Retain exact dimensions, shadows, borders and contextual cascade. No lifecycle rewrite. |
| FullEmojiPicker | DEFER | Two messaging consumers. Lazy emoji-picker-react, vendor dimensions/theme/data/focus and feature-positioned reaction/composer shells dominate. Root has no owned CSS class; manufacturing utilities here removes no presentation duplication. |
| Input | DEFER | 44 sites include text/password/email/search/date/datetime/file, poll permissions and checkboxes. Auth/profile already share CSS; username wrapper overrides height/border, safety controls are 34px/7px versus auth/profile 42px/8px, search and composers have different borders/padding. A generic wrapper without transferring this cascade merely moves tags. Evaluate a concrete input contract within its screen migration. |
| Textarea | DEFER | 11 sites: profile 75px vertical resize, new-chat 76px, safety padding/34px baseline, messaging auto-sizing ref/160px maximum, Spaces composer/objects/settings. Native props differ legitimately; no one exact product-wide presentation contract. |
| Select | DEFER | 10 sites. Profile appearance, safety reasons, Spaces categories/permissions/search filters have different dimensions, label patterns and focus styles. Browser-native semantics and feature callbacks remain local. |
| Checkbox/radio | KEEP_FEATURE_LOCAL | Native profile preferences, poll votes, task completion and channel permissions differ in state ownership, disability and domain labels. Radio occurs only in poll type expression; no separate generic radio contract. |
| Switch/toggle | KEEP_FEATURE_LOCAL | Camera/microphone, recording, view filters and aria-expanded menu toggles are buttons with distinct domain operations. No shared switch role implementation. |
| Label/Field | DEFER | 59 label sites, implicit nesting plus explicit Space IDs, username adornments, checkbox compound descriptions and differing label gaps/fonts. Existing CSS already groups consistent subsets; no additional wrapper DOM justified. |
| FieldError/validation | DEFER | Repeated form-error alert markup already has shared CSS. Some fields use hint IDs; others form-level alerts, errors inside sections or asynchronous session errors. A text wrapper alone offers little ownership gain; consolidate alongside actual field association design in screen work. |
| Badge/unread | KEEP_FEATURE_LOCAL | Rail and MobileNavigation use same navigation-badge CSS and 99+ cap, but placement/domain counts belong to workspace; unread chat counts and requests use separate contracts. No broad Badge API. |
| Status pills/chips | KEEP_FEATURE_LOCAL | Connection, outbox sending/failed, calls, invitations, poll/event/checklist state and online dots have differing text, icons/actions, live semantics and permissions. A shared color variant would conflate domain contracts. |
| Tooltip | DEFER | Native title hints predominate; no repeated standalone role=tooltip/focus/hover lifecycle implementation to consolidate. |
| Menus/popovers/dropdowns | KEEP_FEATURE_LOCAL | Message actions, emoji/reaction picker shells, Spaces mentions/object menus and account controls differ in anchors, stacking, outside-click policy and permissions. Shared colors are already CSS aliases; do not extract domain actions. |
| Separators | KEEP_FEATURE_LOCAL | Conversation day boundaries, inbox history groups and structural borders have different content/order semantics. No repeated standalone separator contract. |
| Loading indicators | KEEP_FEATURE_LOCAL | Media video animated spinner, viewer progress, emoji lazy fallback, sessions/search/history textual statuses have different loading meaning, geometry and cancellation. |
| Empty states | KEEP_FEATURE_LOCAL | Inbox/Requests use decorative symbols; messages, Spaces discovery/Updates and legacy history differ in actions, copy and hierarchy. Existing consistent CSS remains. |
| Icon-only/close controls | DEFER | IconButton already handles approved Account/Report close controls. Remaining message/voice/media/navigation controls vary geometry and semantics; additional replacement needs screen-local evidence, not a new generic API. |
| Generic cards/surfaces | KEEP_FEATURE_LOCAL | Request cards, shared objects, welcome content, sessions and call participants differ in content and interactions. Shared tokens already provide semantic colors. |
| Action rows | KEEP_FEATURE_LOCAL | Composer tools, dialog forms, safety inline block, voice actions and shared-object responses own distinct layout and disabling policy. |

No CREATE_SHARED candidate clears both meaningful duplication reduction and exact reusable presentation in this audit. This is an explicit bounded completion decision, not a claim every raw tag must disappear. Remaining primitive work belongs inside the screen migration requiring it.

## E. Existing primitive contracts
Dialog is an inline div role=presentation around section role=dialog aria-modal=true. Required aria-labelledby; overlayClassName/className extensions; backdrop onMouseDown forwarded unchanged. Native section props spread before forced roles/classes. Although the type uses ComponentPropsWithoutRef, a runtime ref spread is preserved rather than expanded into a new API. No hooks, portal, open prop, automatic focus, Escape listener, trap, restoration or body scroll lock. Account dismisses outside even while busy; Report blocks busy outside dismissal but its close button stays enabled. No change proposed to either consumer.

## F. New primitive justification
None created. No theoretical library or variant API.

## G. Consumer inventory
AccountPanel: profile/settings, native form, file ref, implicit labels, profile checkbox/readOnly/context CSS, sessions and safety forms. ReportDialog: safety form/select/textarea, success/error/busy state and contextual report-dialog. Existing production consumers remain byte-frozen. Full inventory includes all raw production patterns.

## H. Characterization
Before production edits: existing and new Dialog characterization passed 14/14, zero skips. Covers busy backdrop/close policy, labelled section, native extensions/callback identity, actual ref forwarding, inline DOM/children, absent lifecycle behavior, submit payload/success/error, consumer mount ownership. Browser baseline is captured from authoritative base, never rebuilt from migrated HEAD.

## I. Dialog
Overlay remains fixed inset zero, z-index 15, grid-centered with 20px padding and exact translucent semantic overlay color. Panel remains min(430px,100%), max-height calc(100svh - 40px), vertical auto overflow, 24px padding, 1px border, 14px radius and historical shadow. Account and Report contextual cascade still wins as before. Portal, consumer mounting, section/overlay order, outside event target comparison, form nesting and scroll remain unchanged. This deliberately does not claim an accessible focus trap: none exists in the baseline. Account/Report currently do not dismiss on Escape.

## J. Emoji picker
Two calls: MessageComposer and MessageList. FullEmojiPicker lazy-imports emoji-picker-react inside Suspense, forwards open, width min(340px,calc(100vw - 32px)), height 400, preview hidden and emoji string callback. Theme is read from documentElement.dataset.theme on ThemedPicker render; no subscription is invented. Escape on the wrapper calls onClose; the wrapper owns no outside-click handler or portal. Vendor owns search/keyboard/focus internals. Composer toggles local state and selection inserts at textarea selection, invokes draft/typing callbacks, closes, then restores textarea selection/focus in requestAnimationFrame. Reaction selection invokes onReact and clears the selected message ID. Distinct parent popovers own absolute offsets, z-index 12 versus 13, border/radius/shadow and theme background. Mobile width uses viewport calculation. These are frozen source observations, not a claim this phase browser-tested vendor interaction. DEFER; no picker/library/data changes.

## K. Forms
Auth/Unlock and profile inputs share one legacy CSS rule, but type, native constraints and nested adornments vary. Profile/readOnly/checkbox and username selectors override it; safety forms have their own smaller contract. Spaces date/search/object/permissions and MessageComposer ref/auto-height/Enter policy belong to their features. Labels mix implicit wrapping and explicit IDs. Field errors are primarily form-level alerts, not a common per-field validation relationship. CREATE_SHARED would currently move markup without consolidating this ownership or require a variant/cascade refactor. Native inputs/textarea/select/labels remain feature-local until their actual screen requirements justify extraction.

## L. Badges/status
Eight badge/unread search matches and 24 status/connection/chip/pill matches overlap in the audit; these are search sites, not eight independent Badge components. Navigation badge uses semantic danger and on-primary plus the shared 99+ convention; other counts, receipt icons, connection states and call/object statuses differ. Workspace-only cap/placement is not promoted to a product-wide variant API. No status palette or live-region semantics changed.

## M. Tooltip/menu/popover
21 tooltip/title candidate matches; zero tooltip CSS ownership rules. Native title metadata is not proof of a custom tooltip system. Seven menu/popover/dropdown opening matches and 20 related CSS rules include distinct emoji, reaction, mention and object surfaces. Anchoring, stacking, keyboard/outside behavior and permissions remain feature-specific. No generic menu/popover introduced. Separator search has zero standalone separator/day-divider matches; structural group headings/borders remain local.

The machine-readable classification inventory includes every matched site, all source files and exact CSS declarations/nesting for each group. Counts overlap and intentionally do not imply interchangeable contracts. Additional match counts: checkbox/radio 13, switch/toggle/aria-pressed 22, FieldError 16, loading 32, empty state 23, icon/close 17, card/surface 8, action row 15. Raw native sites are inventoried independently. The detailed classification matrix above specifies consolidation value/risk; the following contract assessment records state, interaction and accessibility observations for all groups:

| Group | Props/state and interaction | Accessibility/theme and consolidation risk |
|---|---|---|
| Native inputs/textareas/selects | Native values/defaults, type, name, constraints, refs, change callbacks; controlled search/date/composer versus uncontrolled profile submit | Implicit labels, selected explicit IDs, required/readOnly/disabled differences; distinct legacy focus and dark overrides. Medium/high risk from flattening cascade/native behavior. |
| Checkbox/radio/switch candidates | checked/defaultChecked, permission-dependent disabled, poll type selection; camera/voice/filter toggles invoke different callbacks | Native form labels and aria-pressed/expanded buttons are different semantics, not interchangeable switches. Domain-owned theme/geometry. High consolidation risk. |
| Label/field/error | Wrapper/adornment DOM, compound descriptions, form-level alert text, section async error states | No uniform hint/error ID contract; shared CSS already removes presentation duplication. Low wrapper benefit, medium association risk. |
| Badge/status/chip | Counts, cap, connection flags, delivery states, call and object state text | Decorative dots, role=img receipt names, textual statuses and live regions differ. Existing theme selectors; high semantic conflation risk. |
| Tooltip/menu/popover | Native title versus vendor picker/search/feature local state; anchors and dismiss policies differ | No common keyboard/focus contract; feature ARIA and theme surfaces differ. High behavior/stacking risk. |
| Separator/loading/empty | Group order and copy, async loading/progress, retry/start actions | Decorative SVGs versus status text; distinct mobile and theme selectors. Low generic wrapper benefit, medium structure risk. |
| Icon/close/action rows | Existing IconButton plus native media/voice/composer buttons; callback and disabled/pressed policies differ | Labels/title/expanded and icon dimensions differ; shared close primitive already serves selected consumers. Medium parity risk, use screen evidence. |
| Card/surface | Request state/actions, object votes/tasks, participant tiles, sessions and welcome markup | Domain heading/region semantics and contextual colors/geometry. Shared tokens already centralize color; low extraction gain, high domain coupling. |

## N. Tailwind mappings

| Declaration | Utility | Exact backing |
|---|---|---|
| position:fixed | ui:fixed | fixed |
| z-index:15 | ui:z-overlay | --ds-layer-overlay = 15 |
| display:grid | ui:grid | grid |
| place-items:center | ui:place-items-center | center |
| background:var(--color-overlay) | ui:bg-overlay | background-color:var(--ds-color-overlay); compatibility alias resolves to same light/dark value; no image/other background component existed |
| box-sizing:border-box | ui:box-border | border-box |

The actual Vite/source-detection test proves all six classes emit. No unprefixed/dynamic/arbitrary utility, raw color, token, config or package addition. Exact 20px/24px/14px/430px/calculated geometry and historical shadow stay in CSS. No approximate color/spacing/typography mapping.

## O. CSS ownership
Dialog selectors 2 → 2. Overlay declarations 7 → 2; panel declarations 9 → 8; total 16 → 10. Existing account-dialog contextual duplicates remain deliberately untouched. Button/IconButton declarations and all platform.css rules remain exact. Both utility ownership and computed parity are checked; no whole selector is removed.

## P. Native semantics
Production form markup/handlers are frozen. Browser exercises profile required-name invalid Enter (no PATCH), valid Enter (one exact profile PATCH payload), implicit labels, initial defaultValue, readonly email, checked preferences and report reason/details submission. Runtime API boundary is fixture-only; production handler/effects execute normally. No new form primitive/ref API is invented. Unmigrated form variants, upload dialogs and native select popup raster are not exhaustively exercised.

## Q. Accessibility
Labelled section role=dialog aria-modal=true and overlay role=presentation remain exact; close buttons retain accessible names and native button type. No portal/auto-focus/trap/restore/body lock introduced. Keyboard Tab and Shift+Tab follow existing order, including profile photo input. Existing absence of Escape dismissal and focus trapping/restoration is preserved and explicitly documented, not promoted as a best-practice modal implementation. No new WCAG/contrast claim; colors do not change.

## R. Browser interactions
Actual AccountPanel and ReportDialog execute their existing state/effects/handlers using synthetic identities and a fixture-only shared API transport shim. No consumer useEffect is removed. Report success, rejection and pending promise represent closed/error/busy state. Account requests empty sessions/blocked users; valid profile submit resolves fixture user. Desktop/mobile traces cover open, Escape, Tab, Shift+Tab, success submit, busy outside blocked/close enabled, invalid and valid Enter, overflow scroll, close/focus after unmount, reopen and outside close.

## S. Theme/responsive matrix
32 paired cases = two viewports × Light/Dark/System(OS-Light)/System(OS-Dark) × Account/Report/Report-error/Report-busy. Same hidden Codex IAB, DPR 1.190000057220459. Physical viewport 1714×1071 / 464×1004 yields asserted CSS 1440×900 / 390×844. Page bootstrap stabilizes prefers-color-scheme before CSS/module/theme initialization; production applyAppearancePreference remains unchanged. Actual effective theme, appearance, OS media probes, color scheme, font-loaded and empty unexpected diagnostics are asserted before capture. Base/candidate use identical fixture/API/bootstrap hashes and procedure.

## T. Structural parity
Full node snapshots include HTML/body/root descendants, all computed properties in chunks, bounds, native values, IDs, ARIA, child order and focus. Native state supplements checkbox/required/disabled/readOnly/validity/labels, window and panel scroll, API payloads. Normalize only the six named utilities on the two Dialog marker nodes; every surrounding/consumer class remains exact. Do not ignore focus or scroll. Settling captures preserve intermediate samples while waiting for three identical observations of existing transition endpoints.

## U. Raster parity
Final decoded comparison results are stored in evidence-05/summary.json and comparisons.json.gz. RGB comparison checks every channel of every pixel with zero tolerance, no CSS mask/crop/filter. Three final screenshots per side per case plus warmup frames and same-build comparisons are retained.

Final result: 32 exact structural pairs plus 52 exact interaction pairs; 192 final screenshots. All 288 final raster comparisons are byte-identical: 96 base/candidate and 192 unchanged-build repeat comparisons. Changed pixel count/percentage are zero, bounding boxes null, product regions untouched. Across all 422 decoded comparisons, 416 are byte-identical. The other six are warmup hover transitions, not final comparisons: 134 warmup comparisons total; Light/System-Light Report-error differs by 21,515 pixels (1.660108024691358%), bbox [527,504,917,625]; Dark differs by 21,743 pixels (1.6777006172839506%), bbox [527,528,920,625]. These touch actual product Submit/error regions and reproduce with exactly the same counts/bounds on both unchanged base and unchanged candidate. Raw frames and full region/tile reports are retained. They are explicitly accounted for; no pixel tolerance is introduced.

Rejected first-pass evidence is retained separately: 51 cross-build screenshot comparisons differed while consecutive unchanged-build repeats were identical. The largest inspected desktop Dark Account pair differed by 161,396 pixels (12.453395061728395%), bounding box [0,0,963,900], touching actual product UI. After a mobile→desktop viewport cycle, unchanged BASE reproduced that exact raster: rejected candidate and fresh unchanged base were byte-identical, and fresh adjacent base/candidate were byte-identical. This proves the sampled difference follows browser capture/resize state rather than migrated source; it is not an unsupported claim that arbitrary differences are harmless. Preserve all rejected per-case changed counts/percent/bounding/tile/product regions in rejected comparison logs. Capture builds adjacently under the same viewport state to correct the procedure.

The first mobile Light Account capture after resizing had the same issue: 7,738 pixels (2.3508324219224694%), bbox [16,8,336,824]. A fresh unchanged-base render reproduced that exact difference from its previous raster, and fresh base/candidate were byte-identical. That original pair is retained in remaining-diagnostics; the accepted pair uses unchanged baseline source at the settled viewport. The reusable helper includes a base-only resize preflight to avoid accepting the first compositor state after a size change. Final accepted evidence records adjacent builds and the two base-only diagnostic rerenders; no baseline is derived from candidate code.

Initial keyboard snapshots caught ongoing focus border/shadow transitions on the profile file input. A subsequent partial attempt caught Submit-button hover state settling during raster warmup. The final procedure stabilizes rasters before recording settled structures and retains transition samples without changing CSS. Browser connection/batch timeouts required resuming/re-running incomplete traces; those partial artifacts are diagnostic, not accepted final evidence.

## V. CSS reduction
Six primitive-owned declarations transferred; 2 selectors/10 declarations remain. No platform.css reduction/split, unrelated CSS cleanup, BrandMark or page stylesheet change. Completeness is an explicit ownership decision, not a CSS line target.

## W. Production diff
Exactly two files: client/src/shared/components/Dialog.tsx (two literal class-string additions) and client/src/shared/styles/primitives.css (six declaration removals). All feature files, BrandMark component/consumers/CSS, Avatar/Button/IconButton, tokens, theme/bootstrap, server, persistence, crypto, calls, realtime, polling, voice, media, database, packages/config remain frozen. Narrow fixture restoration helpers let earlier historical tests accept only the exact new Dialog change; the new scope test freezes everything else against this phase's authoritative base.

## X. Final verification
Candidate gates pass: typecheck; 249/249 tests, zero skips; architecture 276 edges/21 informational/zero violations; build; media 11/11; real integration 1/1. Baseline/candidate logs are evidence. All six gates will additionally run on committed HEAD, with that exact SHA/results recorded in PR and final response. This avoids a self-referential evidence-log commit loop. git diff --check and final clean tree are required before push.

## Y. Deferred items
Eight deferred groups and ten feature-local decisions are recorded above; no next generic primitive phase is proposed. Browser proof covers one engine/DPR and selected Account/Report states with synthetic API responses, not a live account/report deployment or exhaustive form/vendor feature testing. Native caret/selection and focus transition timing are not silently normalized; accepted final structural states are settled and exact. Account-dialog duplicate CSS limits actual cascade reduction intentionally. Existing modal accessibility limitations remain. A browser resize/compositor raster anomaly reproduced on unchanged code and is documented with raw diagnostic evidence. The browser observation layer redacts username field values; identical synthetic inputs, frozen consumer source and the exact native FormData PATCH payload provide supplementary value evidence. No redaction bypass is attempted.

## Z. Next program recommendation
The shared primitive layer is sufficiently complete for screen-level visual modernization. Recommend Shell + Navigation first, beginning with WorkspaceRail and MobileNavigation alignment, semantic hierarchy and responsive behavior under a separately approved visual brief. New field/badge/menu abstractions should be justified inside the screen migration that needs them. BrandMark stays explicitly excluded. Do not implement Shell/Navigation or recolor/redesign anything in this phase. Open Phase 05 PR, do not merge, then stop for review.
