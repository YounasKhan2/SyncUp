# Phase 4 — Reusable UI primitives v1

## Baseline and scope

PR #17 was confirmed merged through GitHub; its merge commit and starting main were
`b9ef162c4e218706851f8db2d234161f1ae1b578`. Main was fetched, fast-forwarded and clean.
Baseline typecheck, 41 unit tests, architecture guard (242 edges), and client/server build passed.
Work is on `refactor/syncup-ui-primitives-v1`; zero dependencies added.

## Duplication audit

Counts are **baseline TSX files containing the pattern**, not rendered instances. A file may contain several controls.

| Candidate | Existing pattern / file count | Selected | Reason |
|---|---|---|---|
| Button | `primary-button` in 8 files; secondary/destructive/compact controls also differ | Yes, primary only | Same full-width action in Auth, Unlock, Profile and Report; loading copy remains feature-owned |
| IconButton | `icon-button` in 8 files | Yes, 2 close controls | Identical 30px control and 15px X geometry with explicit names |
| Dialog | `account-dialog` in 6 files, including multiple Spaces overlays | Yes, Profile and Report | Same presentation; retain different outside-dismiss policies in consumers |
| Field/Input | `<input` in 13 files | No | Mixed compound username, checkbox, file picker, search and composer semantics; outside bounded Tier 1 scope |
| Textarea | `<textarea` in 6 files | No | Composer selection/autosizing and ordinary form fields differ |
| Select | `<select` in 4 files | No | Ordinary native labels already work; no need to expand migration |
| Feedback/Status | `form-error` in 8 files plus other error/status patterns | No | Existing shared styles suffice; preserve message and live-region policy |

## APIs and consumers

All three live directly in `client/src/shared/components/`.

- `Button.tsx`: native `ComponentPropsWithRef<'button'>`; one demonstrated full-width primary presentation, optional className. No variant, size, loading, icon-insertion or default-type props. Native omitted type still defaults to submit; migrated consumers explicitly retain `type="submit"`. Loading text, icon visibility and disabling stay outside the primitive.
- `IconButton.tsx`: native button props/ref plus a required string `aria-label`. Forwards title, menu ARIA, type, disabled and handlers; no icon replacement, tooltip, menu, size or dismissal policy. Consumers supply nonempty meaningful names.
- `Dialog.tsx`: section attributes/children, required `aria-labelledby`, required `onBackdropMouseDown`, optional panel className and overlayClassName. Fixed presentation div and labelled `section role="dialog" aria-modal="true"`. The exact mouse event reaches the existing consumer handler. No open state, onClose, Escape listener, focus effect, focus trap/restoration, portal, nested overlay manager or domain code.

| Consumer | Previous | Now | Behavior changed? |
|---|---|---|---|
| Auth submit | Native primary button | Button | No |
| Unlock submit | Native primary button | Button | No |
| Profile save | Native primary button | Button | No |
| Report submit | Native primary button | Button | No |
| Profile close | Native icon button | IconButton | No |
| Report close | Native icon button | IconButton | No |
| Profile shell | Overlay div + labelled section | Dialog | No |
| Report shell | Overlay div + labelled section | Dialog | No |

## Dialog characterization and preserved differences

Six characterization tests passed against the original consumers **before extraction**, then passed against the migrated consumers.
Mounting remains `accountOpen` in Workspace and `reportingMessageId` in Conversation; neither parent was edited.

| Interaction | Profile | Report |
|---|---|---|
| Close button | Existing onClose, enabled even while saving | Existing onClose, enabled even while submitting |
| Outside mouse down | Closes even while saving | Closes only when not submitting |
| Content mouse down | Does not close; bubbles normally | Does not close; bubbles normally |
| Escape | No listener; does not dismiss | No listener; does not dismiss |
| Focus | No automatic focus, trap or restoration | No automatic focus, trap or restoration |
| Content action | Existing save and appearance handlers | Existing form payload, success-close/error-stay paths |

The shell does not stop propagation. These consumers have ordinary native selects and no managed nested overlay. Native select interaction was exercised through Report's reason selector. Complex Search (Escape listener + autofocus), NewConversation, Calls, conversion and Spaces dialogs remain unmigrated; no promise of safe arbitrary nested popovers is made.

## Styling and accessibility

`App.css` imports the new `shared/styles/primitives.css` after platform styles. Narrow classes:
`ui-button`, `ui-icon-button`, `ui-dialog-overlay`, `ui-dialog`.
Tokens consumed: on-primary, primary, primary-hover, text-secondary, bg-hover, overlay, border, bg-elevated;
existing type-body/title-sm/title-xs sizing tokens and the existing global focus-ring rule remain.

Button geometry, hover lift/transition, disabled opacity/wait cursor, and dialog geometry/shadow are copied unchanged.
Light close-button background intentionally moves from legacy `#f1f3ee` to approved `bg-hover` (`#E9E4E0`) for semantic consistency; Dark stays `#302B33`. No palette values change.
At 1440×900 Report remains 430×348, padding 24px; primary action remains 380×44; close remains 30×30 with 15px X. At 390×844 the dialog is 350px wide.

No legacy CSS is removed: remaining consumers still require it. `account-dialog` remains a compatibility hook for heading/descendant styles. Platform CSS, tokens, appearance lifecycle and persistence are unchanged. The same legacy shadow literal is retained to preserve appearance.

Native buttons retain type, disabled, keyboard activation, form association and ref forwarding. IconButton requires an accessible label at the TypeScript boundary. Existing 2px focus-visible outlines (2px offset) use Light `#98728F` / Dark `#D5A7C9`. Dialog labels and modal semantics are preserved, without claiming full modal keyboard management. Fields and their labels/type/autocomplete/required/validation attributes are untouched.

## Tests and visual evidence

- `tests/ui-dialog-characterization.test.mjs` (6): close/outside/content/busy policies for both dialogs; no Escape/focus behavior introduced; Report success/error payload and close path; parent mount conditions.
- `tests/ui-primitives.test.mjs` (7): native Button attributes/ref/default type; IconButton name/title/disabled/menu attributes/icon geometry and handler forwarding; all four consumers' submit/busy copy/icon policies; Dialog event identity and labelled section.
- `tests/helpers/ui-harness.mjs`: executes production JSX/handlers with isolated state slots and explicit effect/API boundaries. It does not model DOM focus or native disabled activation. React server rendering checks emitted attributes; browser checks cover native behavior.
- `tests/fixtures/ui-primitives-preview.html` and `.tsx`: actual Auth, Unlock, AccountPanel, ReportDialog, plus isolated native activation probes. Synthetic identity, in-memory fetch only; sessions/blocks return empty; writes wait for the preview's error completion control. No backend request, real authentication, database or worker flow is exercised.

Rendered all four real consumers in Light and Dark at **1440×900 and 390×844**. No horizontal overflow in the narrow snapshots. Profile's Save was also inspected after keyboard scrolling into view. Report's original and migrated shells were screenshot/computed-style compared at desktop in both themes; the original Dark button sample was captured mid-transition, so its intermediate RGB was not treated as a palette difference.

Checked Report loading/disabled and error recovery in both desktop themes; Profile busy state and outside dismissal; Report Escape/outside/busy close; native disabled buttons/icons generated **0 actions**, Enter/Space generated one each, and an icon click generated one more. Hover primary color/lift and keyboard focus on both primitive control families were inspected across Light/Dark desktop/narrow samples. Icon hover adds no styling beyond its existing static treatment. System resolved Light to match the browser media query. Native select selection was exercised in the fixture.

Screenshots are local evidence outside the repository under the current Codex visualizations directory (`phase4-*` files). They are not an automated pixel-diff suite.

Not performed: authenticated backend journeys, successful real profile/report persistence, real OS theme switching, mobile touch/device emulation, full screen-reader/a11y audit, arbitrary nested popovers, or exhaustive responsive/state combinations for every consumer. Auth/Unlock busy semantics are unit-characterized; their loading/error browser journeys were not run. No danger variant exists. Phase 3 lifecycle tests cover System media-query changes.

## Verification and preservation

Final root typecheck passed without heap overrides; all 54 unit tests passed (13 new); architecture guard passed with 250 edges; client/server build and diff/scope checks passed. The standalone preview also typechecked. Build retains the existing LiveKit chunk-size and jobStore ineffective-dynamic-import warnings. The fixture retains its React root through Vite hot data to prevent duplicate-root warnings during refresh; appearance listeners are disposed on refresh.
Phase 2's 19 characterization tests and Phase 3's five lifecycle tests are unchanged.
No functional/domain behavior changed: auth/session, API implementation/calls, database/migrations/SQL, crypto, messaging, Calls, media, Spaces, realtime, polling/retry and navigation remain unchanged. Consumer handlers, validation, state, labels and icons retain their existing code.

Remaining legacy Buttons: service error, NewConversation, ChatDetails and Spaces; secondary/photo/destructive/compact buttons also remain. Remaining icon controls: InboxPane, RequestsPanel, SearchDialog, NewConversation, conversion and Spaces. Remaining shells: Search/NewConversation/conversion/Spaces/Calls. Field/status styles and legacy literal/dark CSS debt are deliberately retained for later bounded work.

Stop after opening the Phase 4 PR; do not merge or begin Phase 5.
