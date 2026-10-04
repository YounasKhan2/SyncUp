# Visual Phase 11 — Updates

Base: `df4f1751fb8df0fee3bcf21926444a63dc00de0a` · Branch: `design/syncup-updates-11`

## Existing surface and behavior

Updates already has Needs You, Happening and Decided sections, source space/channel labels, search, All/Spaces controls, live-call targets and Open in channel. Items use the existing shared poll, checklist, event and decision renderer. Event date/timezone, response counts and state labels are existing metadata; there is no general activity timestamp, actor feed or unread/new state.

Initial fetch runs on mount with an unmount guard. Search fetches the existing endpoint; the Spaces filter only restricts live calls. Response/state actions refetch, with existing saving status and error alert. There is no polling or separate initial-loading indicator. No new states or workflows were introduced.

## Production changes

- `client/src/features/spaces/UpdatesPage.tsx`: semantic root utilities and an owned error class only.
- `client/src/features/spaces/components/UpdateItem.tsx`: semantic foreground utility only.
- `client/src/features/spaces/spaces.css`: replace Updates cards/grid with compact rows, dividers, source metadata, restrained actionable/resolved hierarchy and semantic controls, focus, error and saving presentation.
- `client/src/shared/styles/platform.css`: remove replaced Updates-owned rules; preserve Shell placement.

SharedObjectCard source, all handlers/effects, IDs, labels, ARIA and ordering are unchanged. Shared-object overrides are bounded to Updates items. All unowned CSS declarations, nesting and cascade order remain exact. No tokens, packages, configuration, runtime, APIs or other screens changed.

CSS line counts (LF split, including final empty line): platform **928 → 911 (−17)**; existing Spaces stylesheet **273 → 301 (+28)**. The combined change is +11 lines; responsive rules moved into the feature owner. No new stylesheet or raw palette values.

## Focused verification

Three new tests protect the complete TSX syntax outside classes, exact shared renderer source, four-file production scope, unowned CSS and semantic ownership. Existing behavioral characterization covers mounted fetch cancellation, search payload, response/state refresh, Needs You → Decided, ordering, filters and navigation.

Browser checks used actual production components with local synthetic transport. Voting changed Vote to Update vote; completing the assigned checklist moved it from Needs You (2 → 1) to Decided (2 → 3). Spaces hid only the direct call; search returned the matching closed poll. Open in channel forwarded `project:general:message`; Open channel forwarded `call`; RSVP Maybe became pressed. Keyboard Search focus had a visible Plum outline.

Six manually inspected screenshots, no pixel certification:

- [Desktop Light, Needs You](screenshots-11/desktop-light.jpg) — 1440×900.
- [Desktop Dark, Decided and keyboard focus](screenshots-11/desktop-dark-decided.jpg) — 1440×900.
- [Mobile Light, long actionable text](screenshots-11/mobile-light.jpg) — 390×844.
- [Mobile Dark, Happening and event actions](screenshots-11/mobile-dark-happening.jpg) — 390×844.
- [Mobile Light, error](screenshots-11/mobile-light-error.jpg) — 390×844.
- [Mobile Dark, empty](screenshots-11/mobile-dark-empty.jpg) — 390×844.

Effective theme and viewport were checked before capture; fonts were loaded. No horizontal overflow was observed. Metadata and long titles wrap, mobile navigation remains available, and event/channel actions are reachable by scrolling. A 320px pass was unnecessary for the inspected layouts.

## Gates and limits

- Typecheck: pass, client and server.
- Unit tests: 274/274 pass, no skips; only this gate was rerun after the historical guard correction.
- Architecture: pass, 276 resolved edges.
- Build: pass, client and server; existing large-chunk and mixed dynamic/static import warnings remain.
- Media V2: 11/11 pass, no skips.
- Integration: 1/1 pass, no skips.
- Diff whitespace check: pass.

The first unit run found one historical CSS-region digest reading the current stylesheet directly. Its test now restores only the exact approved Phase 11 hash before checking the unchanged historical baseline; the focused ownership tests pass. Historical baseline files were not regenerated.

Screenshots use a synthetic fixture, not a signed-in production session. The fixture exercises production callbacks and fetching against local replies, records navigation targets rather than opening real channels, and filters synthetic object titles rather than reproducing server search semantics. Live realtime, persistence, OS System mode and all possible object variants were not visually recertified; their implementation remains unchanged. Saving feedback is styled but was not captured because fixture responses complete immediately.

Stop for review. Do not merge or begin Phase 12.
