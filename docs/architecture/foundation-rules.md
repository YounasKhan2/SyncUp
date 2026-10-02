# Foundation rules

Phase 1 baseline: `main` at `7776b8878fb13800f9a259913eec7c8327c2ed6f`, unchanged from the Phase 0 audit after fetching origin. This phase changes verification and documentation only.

## Ownership and dependency direction

SyncUp remains a React/TypeScript client and Express/TypeScript modular monolith. Preserve existing feature ownership; do not introduce microservices, a new event bus, or a state framework as part of foundation work.

- Client `shared` must never import `features`; shared code stays feature-independent.
- Cross-feature dependencies should use intentional public capabilities rather than implementation internals. Expose a capability only when a real consumer needs it.
- Workspace may compose features, but feature owners retain domain processing, delivery, encryption orchestration, and call rules.
- Generic UI belongs in shared only when equivalent usage across features or platform responsibility is demonstrated. Domain UI stays local.
- Server routes should trend toward HTTP composition. Extract domain logic, SQL, and infrastructure only where responsibility warrants it; no mandatory controller/service/repository stack for every handler.
- Extracted services own transaction scope. Transactional repositories receive the active transaction client, rather than querying through the pool independently.
- Keep authorization predicates inside the appropriate query/transaction boundary. Preserve locks, error mapping, middleware order, and external teardown sequencing.

## Security-sensitive freeze list

These are review boundaries, not permanent prohibitions. Require focused regression coverage before structural changes, and separate review for behavioral corrections:

- Auth crypto and identity-key wrapping/unlocking: `client/src/features/auth/crypto/crypto.ts`, AuthScreen/UnlockScreen, server auth schemas and initialization.
- Refresh/session rotation and revocation: `server/features/auth/session.ts`, middleware/routes.
- Shared HTTP refresh coordination: `client/src/shared/api.ts`; characterize Calls' separate refresh path before changing it.
- Message encryption/envelopes, outbox durability/idempotency, and sequencing: Conversation/outbox, server messaging validation and message/request routes.
- Browser-persisted encrypted/local state: messaging outbox/drafts, media caches/jobs/staging; characterize account switching before changing ownership.
- Media v2 framing, staging, upload state, hydration and recovery: client media/v2 and server media/v2Routes.
- Group-call E2EE, key lifetime, and membership teardown: groupCallCrypto, CallWindow, server groupRoutes/groupCallService.
- Space authorization and converted-group encrypted-history access: server Spaces, messaging history, realtime, client legacy history, migration 018.
- Database constraints/migrations: preserve historical files, schemas, uniqueness and sequence invariants.

## Known dependency debt

Run `npm run check:architecture`. The TypeScript AST/resolver scan checks static imports, re-exports, literal dynamic imports, require calls, and import types in client/server source. Any resolved shared-to-feature edge fails. Other client cross-feature edges are informational; Workspace composition is omitted from that listing. Computed imports and unresolvable modules are outside its coverage; typecheck remains mandatory.

Existing debt to characterize in later phases:

- `client/src/features/messaging/Conversation.tsx` -> Media v2 preparation, runtime, uploadManager and dynamic jobStore imports; Calls groupCallCrypto.
- `client/src/features/messaging/MessageAttachment.tsx` -> Media hydration and localMediaCache.
- `client/src/features/messaging/MessageList.tsx` -> MediaViewer and uploadManager types.
- `client/src/features/spaces/SpacesPage.tsx` -> Messaging MessageAttachment for converted encrypted history.
- Media, Messaging, Calls and Workspace depend on Auth's crypto capability.
- Workspace imports SearchableMessage from SearchDialog, and directly processes the messaging outbox.
- Server Messaging mounts Spaces; domain routers import realtime publishing from its routes module.

Do not fix these dependencies, the Spaces permission fallback discrepancy, account ownership, or Calls refresh behavior in Phase 1.

## Refactoring and verification

Use small vertical slices with independent review and rollback. Preserve runtime/API/encryption/database/authorization behavior; separate fixes from mechanical extraction. Do not restructure directories, split large components/routes/styles, alter theme visuals, rename migrations, or introduce primitives during Phase 1.

Before each refactor: establish relevant tests, record Git state, and verify the current baseline. Before completion: run non-emitting typechecks, all safe suites, architecture scan, and production build; inspect diff/status. Run integration only against deliberately isolated infrastructure. A skipped suite is never a pass. See [verification.md](verification.md) for commands and limitations.
