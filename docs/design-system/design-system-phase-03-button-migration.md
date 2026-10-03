# Phase 03 — Shared Button and IconButton semantic consumer migration

## A. Git/base

Required and verified clean starting main: `531a8be1c112d830f76d969b561c793678b19a3b`.
Branch: `design/syncup-button-tailwind-migration-03`.
Commit subject: `design: migrate shared button to semantic Tailwind`.
The PR targets main and must remain unmerged. No Phase 04 work is included.

## B. Baseline

All six gates ran before production edits. Typecheck passed; standard tests 232/232;
architecture 276 resolved edges / 21 informational dependencies / zero violations;
production client/server build passed; Media V2 11/11; real integration 1/1.
Zero failures, cancellations, skips or todos. Logs are preserved in
`evidence-03/verification-logs.ndjson.gz`; gate results in `verification-ledger.json`.

## C. Existing Button contract

`Button({className, ...props}: ComponentPropsWithRef<'button'>)` returns one native
`button`, spreading props unchanged and applying the primitive marker before consumer
classes. There is no forwardRef wrapper: React 19 receives and forwards the native
ref prop through the spread. The migration does not introduce a new ref API.
No default type attribute is supplied; native default submit behavior remains.
Explicit button/submit/reset types, form, disabled, name/value, data attributes,
ARIA, title, tabIndex, callbacks, children and refs remain native props.
No variants, sizes, loading prop, spinner or icon slot exist. Consumers own disabled
state, loading text and children. Icons/text retain their supplied order.

Original presentation: full-width flex action, 44px height, 10px gap, 3px top margin,
zero border, 8px radius, inherited font with legacy body size and weight 600.
Background/foreground are existing primary tokens. Enabled hover changes background
and translates vertically -1px. Background and transform transition for .15s ease.
Disabled cursor is wait and opacity .7. Descendant spans retain legacy title-sm size
and line-height 1. No special active rule exists. Global focus-visible supplies a
2px focus-token outline and 2px offset; it remains unchanged.

## D. Consumer inventory

Production inventory: four Button call sites in four files; two IconButton call
sites in two of those files. Test fixtures are excluded from these counts.

| File under client/src/features | Primitive | Props and child policy | Classification |
| --- | --- | --- | --- |
| auth/AuthScreen.tsx | Button | type submit; disabled loading; sign-up/sign-in/loading copy; ArrowRight 14 when not loading | standard, form, layout and runtime sensitive |
| auth/UnlockScreen.tsx | Button | type submit; disabled loading; unlocking copy; ArrowRight 14 when not loading | standard, form, layout and runtime sensitive |
| account/AccountPanel.tsx | Button | type submit; disabled loading; Saving…/Save profile; ArrowRight 14 when not loading | standard, dialog/form, layout and runtime sensitive |
| messaging/components/ReportDialog.tsx | Button | type submit; disabled submitting; Submitting…/Submit report; Flag 13 remains during busy state | standard, dialog/form, layout and runtime sensitive |
| account/AccountPanel.tsx | IconButton | type button; onClick onClose; aria-label Close profile; X 15 aria-hidden | compact icon, dialog and runtime sensitive |
| messaging/components/ReportDialog.tsx | IconButton | type button; onClick onClose; aria-label Close report; X 15 aria-hidden | compact icon, dialog and runtime sensitive |

All six use the single existing style/size; none supplies className, ref, name/value,
data attributes or title. IconButtons supply labels; Button names come from text.
Four submit callbacks belong to their enclosing forms, unchanged. Neither IconButton
passes disabled. There are zero style-extended production consumers and no primitive
secondary/destructive variant. Existing raw neutral/destructive controls remain in
the actual Profile/Report scenes as surrounding cascade checks, without migration.

Search covered every client TS/TSX source and stylesheet. Only primitives.css has
ui-button/ui-icon-button selectors. No responsive or feature selector overrides those
markers. Surrounding form/dialog rules, inherited typography, global button focus,
index reset, platform-shell/platform/spaces styles and raw primary/icon selectors
remain frozen. No production consumer JSX changed.

## E. IconButton decision

Migrate the real existing shared primitive; create none. Its API is
`ComponentPropsWithRef<'button'> & {'aria-label': string}`. It returns one button and
forwards native props/ref/events/children with the same class extension convention.
It has one 30px grid size, flex 0 0 auto, centered content, zero border, 7px radius,
secondary text/hover-surface colors, inherited font and legacy title-xs size.
No hover/active/disabled opacity rule or additional variant exists. Native disabled
semantics and global focus-visible behavior remain.

## F. Characterization

Before production edits, added `tests/button-contract.test.mjs` and ran it alongside
the existing ui-primitives tests: 9/9 passed, zero skips. Frozen contracts include
native tag, default/explicit types, disabled forwarding, name/value, data/ARIA/title,
tabIndex, exact callback/ref/children identity, icon-before-text order, marker-first
and consumer-classes-last semantics, and falsy className handling. Existing tests
cover all four actual busy consumer branches and their icon policies.
The unchanged base browser additionally exercised pointer, Enter, Space, native
submit/non-submit behavior, disabled suppression and actual HTMLButtonElement refs.
The before-edit test log is archived. Browser-disabled behavior is not inferred by
calling a JavaScript callback directly.

## G. Tailwind mapping

| Primitive declaration | Literal static utility | Semantic backing |
| --- | --- | --- |
| Button display flex | ui:flex | layout |
| Button width 100% | ui:w-full | layout |
| Button align-items center | ui:items-center | layout |
| Button justify-content center | ui:justify-center | layout |
| Button border-radius 8px | ui:rounded-md | --ds-radius-md |
| Button foreground | ui:text-brand-foreground | --ds-color-brand-foreground |
| Button background | ui:bg-brand | --ds-color-brand |
| Button enabled hover background | ui:[&:hover:not(:disabled)]:bg-brand-hover | --ds-color-brand-hover |
| Button pointer cursor | ui:cursor-pointer | native state styling |
| Button disabled wait cursor | ui:disabled:cursor-wait | native state styling |
| Button disabled opacity .7 | ui:disabled:opacity-70 | exact original value |
| IconButton display grid | ui:grid | layout |
| IconButton place-items center | ui:place-items-center | layout |
| IconButton foreground | ui:text-secondary | --ds-color-text-secondary |
| IconButton background | ui:bg-hover | --ds-color-hover |
| IconButton cursor | ui:cursor-pointer | native state styling |

All 16 class occurrences are literal, prefixed and emitted in the actual production
CSS, separately checked from the test proof build. The arbitrary selector preserves
the original hover predicate without Tailwind's hover-device media restriction.
There are no arbitrary color values, raw new hex colors, important flags, dynamic
class construction, token additions, package or configuration changes.

## H. Legacy CSS ownership transfer

Remove only the declarations listed in G. The unlayered residual marker rules retain
typography, native border reset, legacy geometry and transitions, descendant-span
styling and hover transform. Utilities own the removed properties in the utilities
layer. No residual primitive declaration competes for a transferred property.
The existing global unlayered font reset is why typography stays entirely legacy
owned. No broad important or layer reorganization is used.

Keep 10px gap, 3px margin, 7px icon radius and .15s ease transition exactly; they are
not replaced with nearest approved spacing/radius/easing values. Height/dimensions
and flex sizing also stay in the bounded geometry rule; geometry-token migration is
deferred rather than adding arbitrary dimension syntax or infrastructure utilities
to this first color/layout ownership pass. Existing 44px/30px values remain exact.

The background shorthand becomes background-color utilities. Every computed
background longhand is included in exact parity checks; no image/reset difference
exists in the actual consumers. Unrelated Dialog declarations are byte-identical.
The candidate transfer was accepted only after exact browser parity proved it.

## I. DOM/native semantics

64 paired cases have identical tag structure, IDs, ARIA, values, child order,
non-migrated classes, bounds and focus. The sole accepted class normalization removes
the new ui: tokens on the two primitive markers; marker and consumer extension order
must still match. No wrapper or nested span was introduced. There are no truncated
observation placeholders in the archived full snapshots.

## J. Ref behavior

Static tests preserve ref identity. The real React browser fixture mounts refs;
both builds return BUTTON/default and BUTTON/icon for the two forwarded refs.
No forwardRef wrapper or other lifecycle behavior was added.

## K. Events/form behavior

Identical 14-step base/head native traces are archived. Default Button pointer click
submits once; explicit type button Enter and Space activate without submission;
IconButton Enter and Space each activate once without submission; explicit submit
pointer adds one submission. Final action count is six, submit count two. Parent
click bubbling is identical. Disabled forced pointer attempts change neither count.
The actual Report form click enters Submitting… and disables its Button in both
builds. This browser fixture holds the transport promise and never contacts a server.
The real separate integration gate exercises the actual backend.

## L. Disabled behavior

Both disabled primitives reject pointer activation. Tab sequence is default →
explicit → submit → icon, skipping disabled Button and disabled IconButton.
Button retains wait/.7; IconButton retains its original pointer/normal opacity.
Consumer loading copy/icon behavior remains parent-owned and characterized.

## M. Focus behavior

Mouse clicks on enabled actions focus the native button with focus-visible false;
keyboard activation/Tab gives focus-visible true. The focus capture scene uses real
Tab into default Button. Every theme/viewport preserves the outline's computed
color, 2px width, 2px offset, style and geometry. Global focus CSS is unchanged.
Disabled actions do not remain focused following forced pointer attempts.

## N. Accessibility

Native accessible names and disabled attributes are preserved; IconButton's required
label type is unchanged. Enabled primary text contrast from captured computed colors:
Light 6.282666328:1, Dark 6.569403991:1. Icon foreground/background contrast:
Light 4.336514711:1, Dark 6.352700926:1. System matches its respective effective theme.
These are enabled-state foreground/background ratios, not a general WCAG audit or
disabled-composite contrast claim. No accessibility redesign is included.

## O. Responsive/theme evidence

Matrix: CSS 1440×900 and 390×844; Light, Dark, System/OS Light, System/OS Dark;
eight scenes per combination: Auth, Unlock, Profile, Report, native controls,
keyboard focus, pointer hover and actual Report busy state. Total 64 pairs.
One hidden Codex browser tab, identical capture procedure, DPR 1.190000057220459.
The test bootstrap stabilizes page-world prefers-color-scheme matchMedia before
CSS/modules and appearance initialization, then the unchanged production appearance
function applies the preference. Persisted OS probes, effective data-theme,
data-appearance and inline color-scheme are verified before capture. Fonts must be
loaded; browser diagnostics must be []. Fixture/debug overlays are absent on both
sides. Both builds use the same Tailwind configuration and fixture, archived from
required main; only the three candidate production files overlay the head build.
The baseline is never regenerated from the refactored files.

## P. Computed-style/bounds parity

Zero structural differences in 64 cases. All enumerated computed properties,
including custom properties and background longhands, are captured in bounded
chunks to avoid browser serialization limits. Every element bound matches exactly.
Focus and values match. No stylesheet-property tolerance or rounding is used.
Evidence: `summary.json`, `comparisons.json.gz`, full raw `captures.ndjson.gz`.

## Q. Raster evidence

384 final screenshots; 192/192 cross-build comparisons byte-identical and zero
decoded changed pixels (0%, no bounding boxes or touched product regions).
384/384 same-build final repeat comparisons and 256/256 consecutive warmup
comparisons also byte/pixel-identical. Total 832/832 decoded comparisons identical.
Every RGB pixel is compared; any unequal channel counts as changed. No masks,
cropping, thresholds or tolerated redesign. Three consecutive equal warmups precede
three final captures. All original frames and snapshots are retained with SHA256
inside captures.ndjson.gz; standalone desktop/mobile Profile samples are included.

## R. CSS reduction

| Owned scope | Selectors before → after | Declarations before → after |
| --- | --- | --- |
| Button, including span and states | 4 → 3 | 22 → 11 |
| IconButton | 1 → 1 | 12 → 7 |
| Combined | 5 → 4 | 34 → 18 |

Exactly 16 declarations transferred. The sole whole selector removed is
`.ui-button:disabled`; enabled-hover transform and span selector remain.
The earlier rough progress estimate of 12 Button declarations is superseded by
this AST inventory: 11 Button and five IconButton. Platform CSS changes: zero.
All counts are author declarations, not expanded shorthand longhands or build bytes.

## S. Architecture/build/integration

Final typecheck passes client/server; standard tests 238/238; architecture remains
276 edges / 21 informational / zero violations; client/server build passes;
Media V2 11/11; real integration 1/1. Zero skips, cancellations and todos.
Git diff --check passes. Actual production CSS contains all 16 static class
occurrences. Existing large-chunk and ineffective dynamic-import warnings remain.
The Phase 02 freezes are adapted only by reconstructing these exact three
characterized files; any other edit still fails. Four narrow enforcement tests cover
exact source change, every other production/config file, removed CSS/unrelated
Dialog freeze and actual utility generation. Two added characterization tests raise
the standard count from 232 to 238.

## T. Production diff

Exactly three production files:

- client/src/shared/components/Button.tsx: static classes only.
- client/src/shared/components/IconButton.tsx: static classes only.
- client/src/shared/styles/primitives.css: exact ownership removals only.

Tests, fixtures, helpers, report and evidence are the remaining changes. No feature
markup, raw button, platform.css, typography infrastructure, tokens, packages,
configuration, runtime API, auth/session, appearance implementation, realtime,
crypto, voice, Calls, Spaces permissions, server or database change.

## U. Limitations

Verification uses synthetic identity and isolated request boundaries with real
production consumers; it does not claim browser end-to-end authentication/crypto
submission or profile persistence. Those behaviors are unchanged and the separate
real integration gate passes. No held-down pointer :active screenshot is claimed;
there was no primitive active rule to migrate, and native activation is exercised.
Element computed styles are exhaustive; pseudo-element styles are not separately
enumerated because these primitives define no pseudo-element rules. OS color
preference is emulated at the pre-initialization page boundary, not by changing the
user's OS. Browser engine/DPR coverage is the one recorded environment, not all
engines or devices. Disabled composited contrast is not claimed. Future external
class extensions are not a new exhaustive cascade contract; all current extensions
and consumers are audited. Legacy dimensions/typography/transition remain intentionally.

## V. Phase 04 recommendation

Avatar is the best next bounded candidate: an existing span/image/fallback contract,
accessible name, class extensions and image-error behavior can be characterized.
Its local geometry overrides need inventory first. Input, Badge and Tooltip are
not currently shared primitives. Dialog has overlay sizing, consumer classes and
focus/lifecycle coupling, making it a higher-risk next step. This is a recommendation
only; no Avatar, Dialog or Phase 04 implementation is started.
