# SyncUp Design System Foundation 01

## A. Current styling architecture

Base/main: `0c74acf8f54a7dc1a8a235eae43dea9893d264fd`; verified after fetch/clean fast-forward. Branch `design/syncup-design-system-foundation-01`. The architecture program is closed; no decomposition is performed. This phase changes documentation and test-only audit/capture helpers only. Production rendering, tokens, CSS, runtime/API/auth/crypto/realtime/database/features/configuration/packages are unchanged.

`index.css` imports tokens.css, supplies browser reset/root defaults, inherited control font, global focus-visible and selection. `App.css` imports platform-shell.css, Spaces-owned spaces.css, platform.css, then primitives.css. CSS remains a layered legacy cascade with later theme overrides rather than a semantic utility system; values in early rules can be dormant under later selectors. The inventory preserves source line, selector and media ancestry, not just a value list. Current file ownership remains intact; platform.css is not split into new feature CSS files.

| Production CSS file | Lines |
|---|---:|
| client/src/App.css | 4 |
| client/src/features/spaces/spaces.css | 272 |
| client/src/index.css | 22 |
| client/src/shared/styles/platform-shell.css | 105 |
| client/src/shared/styles/platform.css | 1301 |
| client/src/shared/styles/primitives.css | 12 |
| client/src/shared/styles/tokens.css | 119 |

## B. Current token inventory

Seven CSS files, 1,835 lines, 4,682 declarations. There are 59 unique custom-property names and 103 declarations including repeated Light/Dark/OS fallback branches: 37 color names, font-sans/font-scale and 20 type sizes. Colors already contain the approved Warm Stone + Plum palette, legacy bg/primary names, some semantic aliases, on-primary, overlays, border-strong and 10% sRGB status-soft fills. Current aliases include canvas/surface/subtle/muted, brand/strong/accent/soft, text and focus.

Missing: a complete semantic naming contract, context-safe foreground companions, explicit shared state mapping, typography roles with all six fields, spacing/radius/elevation/motion/dimension/breakpoint/layer tokens. Canonical future naming is `--ds-color-<role>` and equivalent ds namespaces for other domains. Existing variables remain compatibility aliases until separately verified migration. This prevents same-name/self-referential Tailwind aliases.

## C. Hard-coded value inventory

`evidence/style-inventory.json` contains every declaration, token, media rule, literal occurrence, JSX inline style and exact frequency table; `tests/helpers/design-system-audit.mjs` regenerates the read-only audit. Counts include overwritten legacy declarations and all theme branches; color literals are distinct spellings/function strings, not deduplicated perceived colors. 745 literal color occurrences, 512 distinct literal spellings; duplicated occurrences beyond first spelling: 233. Common duplication: #fff 20, #304237 17, #42634a 12, #d8ebd8 11. Gradients, alpha literals and old green palettes remain. No automatic color replacement is authorized.

Semantic color groups are overlapping selector/property/value-based audit classifications: canvas 43; surfaces 130; borders 194; text 536; muted 135; brand 82; message fills 24; interactive states 210; status 56; overlays 57. They are review aids, not a claim that every declaration wins the cascade. Existing pure token definitions are included. Text-transform, tracking, line heights, dimensions, motion and shadows retain exact per-value counts in the inventory.

Typography uses token sizes in most selectors; only two direct font-size literals remain (9px and 10px). Existing weight values: 400/500/550/600/650/700; 550 appears twice and 650 sixteen times. Line heights range 1 to 1.75 with a 20px glyph line. Three serif declarations use Georgia/Times New Roman, alongside the root sans stack. Current root scale is 110%: with a 16px browser default, micro/caption/small/label resolve to 7.7/8.8/9.9/11px. Small and label size references occur 111 and 78 times respectively; these are density/readability debt, not silently normalized.

Spacing recurrence is irregular: 0 (54), 5px/6px/8px (33 each), 10px (30), 3px (27), 9px (26), 7px (24), 12px (23), 4px (20), 2px (18). These are entire property values; shorthand parts are not counted twice. There are 24 distinct radius expressions; 7px (28), 5px/8px (24 each), 6px (19), 50% (18), 9px (17), 10px (14) recur. Preserve asymmetric message-tail corners as a legitimate exception.

Seven JSX style attributes implement media zoom, two live/draft waveform heights, a media progress custom property, download width and two attachment waveforms. Five imperative assignments cover Avatar image-error hiding, appearance root colorScheme, and MessageComposer textarea auto height, capped height (160px) and overflow. These are data-dependent behavior rather than arbitrary palette declarations: preserve and allowlist narrowly. No blanket inline-style ban.

## D. Approved Warm Stone + Plum palette

The exact approved values already present in tokens.css remain authoritative. No recoloring occurs.

| Semantic role | Light | Dark |
|---|---|---|
| canvas | #F5F2EE | #17151A |
| sidebar | #EEEAE5 | #1D1A20 |
| surface | #FAF8F5 | #211E24 |
| elevated | #FFFCF8 | #29252C |
| hover | #E9E4E0 | #302B33 |
| border | #D9D2CD | #3D3741 |
| text-primary | #272228 | #F1ECEF |
| text-secondary | #6F676D | #B7ADB4 |
| text-muted | #8C8389 | #8F858D |
| brand | #76546F | #C99ABD |
| brand-hover | #64465E | #D6A9CA |
| brand-soft | #EADDE6 | #3C2C38 |
| selected | #E7DCE3 | #352A33 |
| message-incoming | #ECE7E3 | #29262B |
| message-outgoing | #DED0D9 | #4A3545 |
| focus | #98728F | #D5A7C9 |
| success | #35745A | #67C79B |
| warning | #A7682A | #E6AC65 |
| danger | #B34D55 | #ED858D |
| info | #536F91 | #83ACD8 |

## E. Semantic color contract

`semantic-contract.json` is the machine-readable proposed contract, not a loaded stylesheet. Every palette role exposes `--ds-color-<role>`; future consumer aliases conceptually equivalent to --color-canvas/sidebar/surface/elevated/hover, border/border-strong, text-primary/secondary/muted/inverse, brand/brand-hover/brand-soft/selected, message-incoming/outgoing, focus and four statuses are defined by that contract.

Legacy mappings: bg-app→canvas, bg-navigation→sidebar, bg-surface→surface, bg-elevated→elevated, bg-hover→hover, primary→brand, primary-hover→brand-hover, primary-soft→brand-soft, focus-ring→focus. border-strong uses text-secondary; text-inverse is a contextual on-fill alias, not universal white. Retain approved overlay values Light rgb(39 34 40 / 45%) and Dark rgb(23 21 26 / 70%), plus restrained shadow tint. Status-soft keeps the existing 10% status/90% surface mixture.

State matrix: default surface/primary text/border; hover hover/primary text; active and selected selected/primary text plus state semantics; disabled hover/secondary text plus native disabled; focus explicit focus ring; loading retains action palette and accessible status; error danger-soft/primary text/danger border; success success-soft/primary text/success icon; warning warning-soft/primary text/warning icon. Info mirrors status-soft/primary text/info icon. Do not use opacity as a universal disabled implementation or color alone to communicate state. Parent-owned busy/error behavior is untouched.

## F. Foreground/background pairs

Brand, success, danger and info solid fills use #FFFCF8 in Light and #272228 in Dark. Warning solid fill proposes #FFFFFF in Light and #272228 in Dark. The Light warning companion is an explicitly justified foreground-only addition: warm white is insufficient on #A7682A; pure white reaches 4.50967:1. This narrow margin is a concern, so prefer warning-soft with primary labels; no palette or consumer adjustment is applied. `status-soft-foreground` maps to text-primary. On message fills, use primary for small metadata in both modes; current late overrides already do so.

Full opaque-pair calculations are in `evidence/contrast.json`. Text-secondary is a surface role, not a universal readable foreground on hover/selected/message backgrounds. Muted is restricted to contrast-appropriate large/decorative roles, not informative small labels. Native inputs use primary text and secondary placeholders; necessary boundary indicators should use border-strong where fill/border contrast is insufficient.

## G. Typography scale

Keep `--font-sans`: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif. No font install is performed; rendered font depends on availability. Current serif story treatment remains a documented brand exception. All roles centrally specify family, size, unitless line height, weight, tracking and transform. Sizes reuse current token scale steps and raise future informative metadata targets above the current micro scale; this is a proposed later visual change, not an alias that is guaranteed geometry-neutral. Preserve 110% root scaling pending dedicated approval; do not reset it during Tailwind setup.

| Role | Size | Line height | Weight | Tracking | Transform | Product rationale |
|---|---|---:|---:|---|---|---|
| display | 1.5rem | 1.2 | 650 | -.025em | none | existing display-xs compact page/empty-state heading |
| h1 | 1.125rem | 1.3 | 650 | -.015em | none | existing title: main workspace heading |
| h2 | 1rem | 1.35 | 600 | -.01em | none | existing title-xs: panel/section heading |
| h3 | .9375rem | 1.4 | 600 | 0 | none | existing subtitle: subordinate heading |
| body-lg | .875rem | 1.5 | 400 | 0 | none | existing control: introductory readable paragraph |
| body | .8125rem | 1.5 | 400 | 0 | none | existing body-lg: ordinary communication text |
| body-sm | .75rem | 1.5 | 400 | 0 | none | existing body: compact supporting rows |
| label | .75rem | 1.4 | 600 | 0 | none | body-sized readable form/action labels |
| caption | .6875rem | 1.4 | 400 | 0 | none | existing body-xs: small informative metadata; replaces sub-11px targets later |
| overline | .6875rem | 1.4 | 700 | .06em | uppercase | existing body-xs size with compact section distinction |

Effective body/body-sm/caption sizes at the current root are 14.3/13.2/12.1 CSS px; h1 is 19.8px and display 26.4px. This keeps a compact communication density while avoiding routine 8–10px information. Headings do not automatically qualify as WCAG large text. Future text-h1/text-h2/text-body/text-body-sm/text-caption utilities must carry complete role metadata, not size alone. Bold/emphasis may be explicit contextual variants. Rare auth hero/story responsive sizes remain exceptions until that surface migrates.

## H. Spacing scale

Reusable steps (px): 2, 4, 6, 8, 12, 16, 24, 32, 48. Inline icon/text gaps 4 (roomy 8); control inline/block padding 12/8; compact row 8; panel/section 24; shell 16. Preserve zero/auto and safe-area/viewport-derived geometry as layout primitives. Proposed mappings: 3/5/7/9/10→nearest reviewed step; 14/18/20→reviewed 16/24 based on actual layout role. These are migration candidates, never automatic rounding. Border widths and progress/waveform geometry are not spacing tokens. Current selectors keep all old values in this phase.

## I. Radius scale

xs 4px, sm 6px, md 8px, lg 10px, xl 14px, full 9999px. Existing controls 6–8→sm/md after comparison; cards/popovers 9–12→lg; dialog 14→xl; avatar/pill→full. 5/7/9/11/13/15/16/18/20 values require per-surface decisions, not global substitution. Message tail corners and bottom sheets keep named asymmetric exceptions until verified migration.

## J. Elevation

none: no shadow, decorative border allowed; raised: 0 2px 8px at 8% shadow; overlay: 0 8px 24px at 12%; modal: 0 18px 50px at 18%. Suggested light shadow tint rgb(39 34 40); dark rgb(0 0 0), with border/alpha chosen during actual visual verification. Existing ui-dialog modal 18px/50px and Spaces popovers 8px/24px supply geometry; current old green shadow colors remain unchanged. Avoid adding elevation to every card. The exact shadow/overlay/border inventory remains in evidence.

## K. Motion

fast 100ms, normal 150ms, slow 250ms. Standard cubic-bezier(.2,0,0,1); enter (0,0,.2,1); exit (.4,0,1,1). Current .15s ease transitions map to normal, .12s opacity to fast after verification. Existing progress/spin/shimmer/pulse/highlight durations (.8/1/1.35/1.4/1.6s) are functional named exceptions, not decorative slow transitions. Current CSS has three reduced-motion queries, global near-zero transitions and targeted animation suppression. Future reduced-motion must disable nonessential transforms/animations and preserve textual progress/status. No animation is introduced.

## L. Control dimensions

Proposed dimensions reuse current button/input density: compact button 30px, standard primary 44px, icon button 30px, text input 42px, composer icon 30px, rail row 48px, chat-list row min-height 50px. Current call action is 29px, reaching 44px at the narrow breakpoint: document this existing distinction. Mobile ergonomic target 44px uses layout/hit area rather than shrinking desktop efficiency; it is a future review target, not a claim that every current icon has that area. Composer textarea grows with content; do not fix its height globally. No dimension changes now.

## M. Responsive/breakpoint contract

Actual layout queries: max 420 (two), max 620 (one), max 700 (two), max 760 (two), min 701/max 1099 (one). Plus hover:none, OS dark and three reduced-motion queries: thirteen media rules total. Intent: mobile messenger through 700px; two-pane from 701px; desktop workspace at 1100px; 420px narrow-phone controls, 620px voice and 760px media exceptions remain scoped.

Future breakpoint tokens: narrow-phone 420px, voice-compact 620px, two-pane 701px, media-wide 761px, workspace-wide 1100px. Preserve actual max bounds 420/620/700/760/1099; mobile-first equivalents do not license gaps at fractional viewport sizes. Use explicit max variants for exact legacy limits until the responsive conversion is proven. Tailwind theme should use one consistent px unit set and reset default breakpoint names; do not substitute default sm/md/lg values. No responsive redesign now.

## N. Layer/z-index contract

Fourteen distinct current numeric values: 1,2,3,4,8,9,10,12,13,15,25,30,45,100. Existing overlay/dialog 15, emoji 12, reactions 13, call overlay 25, incoming banner desktop 9/mobile 30, Spaces modal 45, media viewer/skip-link 100. Local positioned child layers 1–4 are not automatically global layers.

Future semantic target: base 0, sticky 1, popover 12, dropdown 13, overlay 15, modal 45, toast 50, call-overlay 60, media 70, accessibility 100. This target expresses desired ownership, not immediate current ordering. Potential collisions: media and skip-link share 100; desktop incoming banner can sit below overlays; call 25 sits below Spaces modal 45. Stacking contexts/source order matter; these are risks to inspect in overlapping real states, not proven cross-context defects. Dedicated layer migration must preserve behavior or obtain explicit stacking-change approval.

## O. Primitive audit

| Primitive | Classification | Finding |
|---|---|---|
| Button | keep; extend later | Native props/ref forwarding; one full-width primary style, parent owns loading/disabled/type. Future semantic variants must preserve consumers. |
| IconButton | keep; extend later | Native button, required aria-label; 30px style; later review touch area, focus and state variants. |
| Avatar | keep | Name/image fallback and error hiding; contextual sizes/classes remain caller-owned. |
| Dialog | keep shell; extend later | Presentation/backdrop callback, labelled modal; account-dialog coupling, focus trap/Escape/restore policies remain consumers' responsibility. No accessibility-complete modal claim. |
| BrandMark | keep | Product logo; logo-specific visual treatment may be an intentional exception. |
| FullEmojiPicker | keep adapter; extend later | Third-party lazy picker, root-theme mapping and Escape callback; vendor styling/live-theme changes need dedicated checks. |
| Input / Textarea / Select | missing shared primitive | Native feature forms exist; add only demonstrated repeated contract in later primitive migration. |
| Badge | missing shared primitive | Existing nav/object/status badges are contextual; do not globalize domain state logic. |
| Tooltip | missing shared primitive | Native title/feature hints are not a shared tooltip contract. Later keyboard/touch behavior needs explicit design. |
| Voice/Call/object controls | feature-specific — do not globalize | Domain permissions/status/media behavior stay in features. |

Shared styles own tokens and reusable product primitives. Feature components remain feature-owned. No component library construction or relocation now.

## P. Existing theme integration

`appearance.ts` remains unchanged: localStorage key syncup-appearance; parse/read/save; system/light/dark; effective data-theme plus data-appearance and inline colorScheme; root lifecycle listens to OS preference changes only for System. Tokens provide Light root, Dark data-theme and OS-dark fallback before root initialization. New canonical ds values should use exactly these selectors; legacy aliases bridge to them. Theme-independent utilities consume the current semantic variable value, without a new storage key, .dark class or lifecycle rewrite.

## Q. Accessibility/contrast findings

Opaque sRGB luminance calculations compare against unrounded thresholds. Normal informative text targets 4.5:1; large text 3:1, and necessary non-text controls/indicators 3:1 against adjacent colors. These targets follow [W3C text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) and [W3C non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html). This is a pair audit, not a WCAG conformance certificate.

| Pair | Light ratio | Dark ratio | Interpretation |
|---|---:|---:|---|
| Primary / surface | 14.72 | 14.10 | Suitable ordinary body/input text |
| Secondary / surface | 5.16 | 7.56 | Suitable supporting text |
| Muted / surface | 3.46 | 4.63 | Light small text fails; Dark cannot generalize to other fills |
| Secondary / incoming | 4.46 | 6.86 | Light normal text fails without rounding |
| Secondary / outgoing | 3.68 | 5.12 | Light normal text fails; prefer primary metadata |
| Muted / elevated | 3.59 | 4.23 | Normal informative text fails both |
| Warning / surface | 4.25 | 8.19 | Light small warning labels fail; primary text plus accent |
| Focus / surface | 3.86 | 7.99 | Non-text surface pair passes; colored controls need adjacent-pair check |
| Border / surface | 1.41 | 1.43 | Decorative separator only; insufficient as sole necessary input boundary |
| Brand foreground / brand | 6.28 | 6.57 | Proposed solid primary button pairs pass |

The matrix has 192 opaque pairs. Existing late overrides use primary text for bubble metadata and primary-on-soft for errors; preserve them. Proposed corrections are role changes to approved readable text, stronger necessary borders, and an inverse separator for focus on colored fills. Do not silently darken the approved palette. Selected state must have readable primary text plus visible selection/ARIA; fill difference alone is insufficient. Gradients, alpha mixtures, disabled opacity, actual focus-ring area/occlusion, mobile hit areas, keyboard modal behavior and loaded fonts require later rendered/accessibility testing. Very small current type remains debt even when color contrast passes.

## R. Legacy CSS → semantic mapping

| Current selector/value family | Future semantic ownership |
|---|---|
| :root / .workspace canvas | canvas |
| .primary-rail / .space-sidebar / navigation panels | sidebar; brand storytelling exceptions reviewed separately |
| .inbox-pane / .conversation-pane / .updates-page | canvas or surface by panel role |
| .account-dialog / .space-dialog / popovers | elevated + modal/overlay elevation |
| .rail-item:hover / .chat-list-item:hover | hover with primary readable text |
| .rail-item-active / .selected / aria-current | selected + primary text + explicit state marker |
| .message-bubble / .message-mine | message-incoming/outgoing; primary body and metadata |
| .reply-quote | surface with context-checked secondary/primary text |
| .primary-button / .ui-button / composer-send | brand/hover + brand-foreground |
| .form-error / .list-error / .inline-error | danger-soft + primary text + danger boundary |
| .form-success | success text when contrast passes; otherwise primary + success marker |
| .decline-call-button / .call-end-button / navigation badge | danger + danger-foreground; parent behavior stays local |
| input/textarea/select / focus-within | surface, primary, readable placeholder, necessary border-strong, focus |
| .message-time / .micro / .small / eyebrow | reviewed caption/body-sm/overline role; preserve geometry until migration approval |
| overlay / media viewer / incoming call banner | distinct modal/media/call overlay roles, not one global alpha fill |

Use the final cascade-winning declarations and actual context; no search/replace by color equality. Platform-shell old green brand storytelling, Call/media dark-scrim surfaces, vendor emoji styles and asymmetric message geometry are named exceptions. Do not split platform.css into feature files; gradually replace selectors with semantic utilities/primitives, leaving only browser/global exceptions until deletion.

## S. Tailwind integration design

Tailwind is absent from root/client dependencies, lockfile and configurations; Vite has React plus API proxy only. No installation/upgrade/configuration or utility migration now. Current [official Tailwind theme documentation](https://tailwindcss.com/docs/theme) supports a CSS-first semantic theme design using top-level @theme namespaces. In Phase 02, evaluate the then-current supported version and browser/build requirements before pinning; do not add Tailwind solely to prove this document.

Illustrative future wiring (not loaded anywhere):

```css
@theme inline {
  --color-canvas: var(--ds-color-canvas);
  --color-brand: var(--ds-color-brand);
  --text-body: var(--ds-type-body-size);
  --text-body--line-height: var(--ds-type-body-line-height);
  --text-body--font-weight: var(--ds-type-body-weight);
  --text-body--letter-spacing: var(--ds-type-body-tracking);
}
```

Avoid `--color-canvas: var(--color-canvas)` circular aliases. Complete roles carry font/transform via bounded shared utility definitions where the theme namespace alone cannot express them. Future px breakpoint constants remain compile-time theme values. Reset default palette/type/radius/breakpoint namespaces to prevent unauthorized direct palette use. Do not enable Preflight blindly: first compare its reset/control defaults with index.css and legacy cascade. Wire semantic theme without recoloring, then migrate bounded surfaces with preserved baselines; do not combine setup with layout/runtime changes.

## T. Static enforcement design

Future AST/PostCSS checks run on production source, excluding explicit test fixtures and vendor/generated assets. Ratchet against the frozen current inventory: reject new literal hex/rgb/hsl feature colors, arbitrary text-[Npx]/font-[N], unapproved radii/shadows/palette utilities, new feature CSS without architectural justification, and platform.css growth. Initially report existing debt; enforce only new violations so migration remains possible. Count cascade/selector changes, not just file line totals. Dynamic progress/waveform/zoom values are narrowly permitted data bindings.

Escape registry fields: exact file/selector/property or AST span, category, concrete rationale, owner, linked issue, intended phase/expiry and review evidence. Reject broad wildcard exceptions, expired exceptions and exceptions no longer matching source. Changes to the registry require explicit review; CI prints location/reason. Genuine browser/vendor/safe-area/asymmetric geometry exceptions can remain, while decorative arbitrary styling cannot hide under them. No new enforcing gate is enabled in this phase.

## U. Migration sequence

1. Implement canonical semantic tokens/compatibility aliases with unchanged initial values and verified selectors.
2. Pin/install and wire semantic Tailwind theme, controlled reset/namespace policy and initial ratchet.
3. Migrate shared primitives with explicit consumer/native/focus/state contracts.
4. Shell/navigation; verify pane/rail/mobile modes.
5. Account/simple forms; preserve defaults/submission/theme/session semantics.
6. Updates; preserve grouping/status/navigation and current refresh ownership.
7. Spaces presentation and dialogs; preserve permissions/runtime boundaries.
8. Conversation presentation and details/dialogs; keep crypto/realtime outside styling work.
9. Message bubbles/composer; verify selection/reply/edit/progress/voice/accessibility geometry.
10. Calls presentation; include feasible window/media fixtures without runtime migration.
11. Audit residual selectors and register justified browser/vendor exceptions.
12. Delete platform.css only when every consumer has migrated and equivalent evidence exists.
13. Full visual consistency, keyboard/accessibility and system regression validation.

Each step needs a bounded PR, baseline comparisons at both viewports/all themes, DOM/interaction verification, decoded raster analysis for unequal images and unchanged-build repeat evidence; no blanket harmless classification. Type/radius/spacing changes are explicit reviewed visual migrations, not hidden token setup.

## V. Known exceptions/debt

Legacy duplicate palette rules and high-specificity theme overrides; tiny font-scale steps; irregular spacing/radii/weights; contextual overlay colors; two direct size literals; variable progress/waveform/zoom; third-party emoji styling; fallback font differences; old serif auth storytelling; reduced-motion functional animation policy; conditional z-index collisions; primitive modal focus-policy limitations. Current screenshots preserve these facts rather than masking them.

Fresh migration baseline: 64 cases, 192 final screenshots and 384 decoded same-build/warmup comparisons. All 384 comparisons are byte-identical and pixel-identical: zero changed pixels/regions. 512 indexed raw snapshots/frames/warmup manifests, 36 unique raster byte hashes, archived without masks/crops/thresholds. Actual CSS viewports 1440×900 and 390×844, fixed DPR 1.190000057220459; Light/Dark/System with OS Light/Dark emulated before theme initialization and effective theme/probes/fonts/diagnostics asserted. Account sessions region uses the identical existing fixture scroll procedure; debug controls hidden.

Coverage: real Workspace rail/inbox/navigation, CallsHome and IncomingCallBanner; real Conversation presentation hook/header/MessageList/bubbles/MessageComposer and ReportDialog; real Account and Updates with test-build seeded root state and API effects explicitly suppressed; real SpacesPage with seeded state/effects suppressed. No authenticated browser runtime, real upload/crypto, multi-user realtime, LiveKit session or active CallsWindow capture is claimed. CallsWindow requires authenticated call/media setup and is identified for future dedicated evidence. Production source for all fixtures comes from the required main archive, not prior-phase visual snapshots.

## W. Phase 02 recommendation

Approve this semantic contract and context-specific foreground policy first. Phase 02 should be limited to alias-safe semantic token implementation and Tailwind theme wiring, with existing appearance/persistence unchanged. Resolve reset policy and review typography/layer/accessibility exceptions before consumers migrate. No Tailwind or visual migration has begun.

All six baseline and final gates pass; see verification-ledger.json and full archived logs for exact durations. Standard suite stays 226/226, Media V2 11/11, integration 1/1 with zero skips; architecture 276 resolved edges, 21 informational, zero violations. Build retains existing size/dynamic-import warnings. git diff --check passes. This PR is documentation/audit/evidence only; after opening it, stop unmerged for review.
