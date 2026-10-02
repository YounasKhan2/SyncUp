# Verification inventory

## Commands

| Command | Purpose |
| --- | --- |
| `npm run typecheck` | Client application + Vite configuration, then server; no emitted JS/build info |
| `npm run typecheck:client` | Client's two direct project checks, with noEmit and incremental disabled |
| `npm run typecheck:server` | Server direct project check, with noEmit and incremental disabled |
| `npm test` | Discover every root tests/*.test.mts or *.test.mjs except *.integration.test.*; run through existing tsx loader |
| `npm run test:media-v2` | Existing focused media crypto/scale subset |
| `npm run test:integration` | Existing infrastructure-dependent API test; never included in npm test |
| `npm run check:architecture` | Fail shared -> features; list known client cross-feature dependencies |
| `npm run build` | Client TypeScript/Vite build, then server production emission |
| `npm run build:server` | Server output to dist/server |
| `npm run build --workspace client` | Client build to client/dist, plus TypeScript build metadata |
| `npm run lint --workspace client` | Existing oxlint React/TypeScript/Oxc rules |

Development scripts remain `dev`, `dev:server` (tsx watch), and `dev:client` (Vite). `start` runs compiled server output; client `preview` previews its Vite build. Neither is verification. There is no existing repository CI workflow. Server strict TypeScript and client compiler/lint settings remain unchanged.

Previously root typecheck invoked build. Root test scripts covered only integration and the two media suites; group-call and polish tests were omitted. npm test now discovers all four safe suites. Place new safe suites directly under tests with the same suffix. Infrastructure-dependent suites must use `.integration.test.*` and have an explicit separate command; discovery is non-recursive.

## Existing suite inventory

| File | Assertions | Coverage |
| --- | --- | --- |
| tests/media-v2-crypto.test.mts | 5 | Records/framing, tampering, AAD substitution, reordering, malformed framing |
| tests/media-v2-scale.test.mts | 6 | Manifest calculations for source sizes, source limits, invalid inputs; not actual large transfers |
| tests/group-call-crypto.test.mts | 1 | Unsupported browser fails closed; not a real browser call |
| tests/phase0-polish.test.mts | 5 | Unread count, timeline, safe links, emoji insertion, appearance preference parsing |
| tests/messaging.integration.test.mjs | One dependent scenario with many assertions | Auth, requests/messaging, receipts, media, calls, Spaces permissions/objects/files and conversion |

No browser/component test runner or rendered theme/contrast suite exists. The default workflow must not be described as complete runtime/security certification.

## Integration execution and reporting

The existing test uses TEST_API_URL, defaulting to http://localhost:4000. It probes /api/health and skips if the probe fails or is not 200. After a successful probe it creates accounts, uploads storage objects, and changes database records through APIs. It is not a read-only health test, and does not establish that its target is isolated.

Only run after the operator explicitly verifies a disposable API deployment with an isolated PostgreSQL database migrated through all historical SQL files, isolated Appwrite storage and any configured LiveKit resources. Use TEST_API_URL to select that deployment. Do not point it at production, shared development, or an arbitrary existing localhost service. Some infrastructure-dependent branches can accept unavailable services, so report exercised coverage as well as suite status.

compose.yaml uses a named PostgreSQL volume and initializes SQL only on first volume creation. It is not an isolated test/reset harness. Do not automatically start, reset, or remove that infrastructure. Never infer safety solely from a health response.

- **PASS:** assertions executed and succeeded; report any unexercised optional infrastructure branches.
- **FAIL:** assertions or test execution failed; inspect TAP output and exit status.
- **SKIPPED / INFRASTRUCTURE UNAVAILABLE:** health prerequisite failed and Node reports a skipped test. A zero exit code with a skip is not integration verification.
- **NOT EXECUTED:** isolation/prerequisites were not established. State `Integration verification not executed` and the reason.

Before claiming no emission, compare hashes/paths of dist, client/dist and client/node_modules/.tmp (including missing paths) before and after typecheck. Run typecheck before build, since build intentionally emits artifacts.

## Phase 1 verified baseline (2026-10-02)

- `npm run typecheck`: client application, Vite configuration and server passed. Before/after SHA-256 inventories of dist, client/dist and client/node_modules/.tmp were identical.
- `npm test`: all four safe suites passed, 17 assertions, zero failures/skips.
- `npm run check:architecture`: 242 resolved internal edges; no shared -> features violations; 21 informational client cross-feature dependencies.
- Enforcement probe: a temporary shared module with a feature re-export and literal dynamic import was rejected with exit code 1; the probe was removed.
- `npm run build`: client and server passed. Existing warnings: a chunk above 500 kB and jobStore's ineffective dynamic import.
- Client lint completed with 14 existing warnings in runtime files; no runtime cleanup was performed.
- **Integration verification not executed:** no deliberately disposable API/database/Appwrite/LiveKit environment was established. The existing development Compose setup is persistent and is not a safe isolated test harness. This is not an integration pass or an executed skip.
