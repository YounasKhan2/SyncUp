# SyncUp

SyncUp is a compact React/TypeScript web app with a TypeScript modular-monolith API backed by PostgreSQL. Its current vertical slice includes account identity, end-to-end encrypted direct/group messaging, message requests, read state, reactions, local drafts/outbox, realtime sync hints, encrypted file attachments, end-to-end encrypted group plus 1:1 audio/video calls, and the first Phase 1 Space/client-room slice.

## Architecture

- `client/src/App.tsx` only composes the app router. Session/key-unlock selection lives in `client/src/app/AppRouter.tsx`; reusable views and feature behavior live under `client/src/features/<feature>/`, with shared API/types/utilities/components under `client/src/shared/`.
- Workspace navigation, inbox rows, conversation headers, message lists, composers, attachments, calls, account, and authentication each have their own component modules. UI icons use `lucide-react`.
- Shared design tokens live in `client/src/shared/styles/tokens.css`; `client/src/App.css` is an import-only entry for the shared platform stylesheet. Global document/reset styles live in `client/src/index.css`.
- `server/index.ts` is the API composition root. Feature routers are under `server/features/`; authentication additionally separates schemas, session helpers, middleware, and request types. Messaging discovery, chats, requests, and message endpoints are separate route modules with shared validation/rate-limit modules.
- Feature route modules currently own their SQL operations. Extract dedicated domain services/repositories as feature complexity grows, rather than returning route logic to a root-level server file.

This is a modular monolith, not a set of deployable microservices. Feature boundaries are intended to support shared infrastructure and future scale without prematurely introducing network/service boundaries.

## Requirements

- Node.js 20.19+ or 22.12+
- Docker Desktop (for local PostgreSQL and LiveKit); an Appwrite Cloud project for attachment storage

## Run locally

1. Copy `.env.example` to `.env`, set unique local passwords/secrets, and replace `AUTH_SECRET` with at least 32 random bytes. Generate it with `node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"`. The LiveKit `devkey`/`secret` pair is for local development only.
2. Configure `APPWRITE_ENDPOINT`, `APPWRITE_PROJECT_ID`, `APPWRITE_STORAGE_BUCKET_ID`, and `APPWRITE_API_KEY` in the root `.env`. The server API key needs `files.read` and `files.write`; keep it out of client variables and source control. Start local dependencies with `docker compose up -d`. PostgreSQL applies the ordered migrations to a fresh data volume. For an existing database, apply each new migration once, in order; do not re-run migrations against populated data.
3. Run `npm install` and `npm run dev`, then open `http://localhost:5173`. The API is at `http://localhost:4000`, Appwrite Cloud stores encrypted attachments, and local LiveKit is at `ws://localhost:7880`.

The development Compose file runs PostgreSQL and local LiveKit; the React client and TypeScript API run on the host with hot reload. PostgreSQL uses a named persistent volume.
LiveKit's development configuration advertises loopback and is for clients on this computer only. Production deployments must use a reachable LiveKit URL/IP, production API credentials, and firewall rules for the selected ICE ports.

## Appwrite project preparation

The official Appwrite web and Node.js SDKs are installed. The Appwrite project has a private `syncup-encrypted-attachments` bucket configured for encrypted `.bin` files, file-level security, and a maximum upload size of 25 MiB plus the 16-byte AES-GCM tag. Permissions are empty, transformations are disabled, and antivirus scanning is disabled because the stored payloads are already ciphertext. SyncUp's API remains responsible for checking chat membership before upload or download.

All encrypted attachments are stored in Appwrite Storage. The API proxies encrypted bytes to Appwrite so custom SyncUp sessions remain the authorization boundary. This adds API bandwidth and latency compared with direct-to-S3 transfers. The local RustFS objects were copied to Appwrite and their PostgreSQL references updated; RustFS is no longer part of the development stack.

PostgreSQL remains the source of truth for messages, memberships, and attachment metadata. Realtime continues to use PostgreSQL notifications and the existing authorized SSE endpoint; Appwrite Realtime is not enabled because clients do not have Appwrite identities. Appwrite Auth and TablesDB are not connected.

For a production build, run `npm run build` followed by `npm start` with the same environment variables. Serve `client/dist` from a same-origin web host and route `/api` to the API, preserving event-stream connections. In a replicated deployment, each API replica can use the shared PostgreSQL notification channel for realtime hints; scale its connection pool deliberately against the database connection budget.

## Integration test

With the Compose services and API running, run `npm run test:integration`. The test creates isolated accounts and verifies Space/channel creation, guest channel isolation, per-role channel view/send/speak permissions, channel mentions and `@everyone` authorization, voice-room access, server-readable channel messages, encrypted first-contact requests, request privacy and acceptance, recipient decryption, authorization, idempotent retries, concurrent message ordering, read cursors, reactions, groups, encrypted object uploads/downloads, call authorization/token/history, message edit/delete/pin controls, safety reports, and user blocking. Set `TEST_API_URL` to target an API other than `http://localhost:4000`.

## Current scope

- Responsive account creation/sign-in screen and compact authenticated workspace shell.
- PostgreSQL user, device, session, and refresh-token schema.
- Password hashing, parameterized database queries, validation, login rate limiting, UUIDv7 IDs, HTTP-only SameSite cookies, 15-minute signed access tokens, rotating refresh tokens with reuse-family revocation, profile editing, and per-session revocation.
- Message bodies and per-recipient AES-GCM keys are encrypted in the client; the API stores opaque ciphertext and the recipient-specific RSA-OAEP envelopes. The private identity key is AES-GCM wrapped with a PBKDF2 key derived from the account password. Never log message envelopes or credential payloads.
- Messaging API routes are separated from authentication, and tenant/member access is checked in PostgreSQL for every operation. Server sequence assignment is transactional; `(sender_id, idempotency_key)` makes retries safe. PostgreSQL notifications carry chat IDs and sequence numbers only; clients fetch authorized durable history over the API.
- The browser outbox stores encrypted payloads in IndexedDB. Local key material remains in memory and the user unlocks it again after a reload; key recovery/password reset and independently verified identity fingerprints still need dedicated product/security review before a public production launch.
- Messages support encrypted replies with navigable decrypted previews, toggleable reactions, chat-visible pins, and clipboard copy for text-only messages. Call history is interleaved with messages chronologically. Text messages support encrypted edits within 15 minutes and delete-for-me/delete-for-everyone within 15 minutes (sender or chat admin). Deleting for everyone clears the stored ciphertext/envelopes; per-user hides remain separate.
- Users can block/unblock accounts and report users or messages with a reason and optional details. Blocks close pending requests and direct-chat membership; reports are stored in the internal review table and rate-limited. There is not yet an administrator review UI.
- Direct-chat files are encrypted in the browser with a per-file AES-GCM key wrapped for each chat member. Object storage holds ciphertext; download links are short-lived and membership-checked. Calls use LiveKit with short-lived participant tokens. One-to-one call media is transport-encrypted but **not end-to-end encrypted**. Group-call media uses LiveKit frame E2EE with a fresh 256-bit call key wrapped to every current group member's RSA identity key; the server stores only opaque key envelopes. Every other current group member is rung, and each can answer or decline for 60 seconds. A group membership change ends the room rather than continuing with a stale key; starting another call creates a fresh key.
- Group members can invite discoverable mutual contacts and leave; if the owner leaves, ownership passes to the longest-tenured remaining member. New members can decrypt messages/files sent after joining, not earlier history. Groups remain capped at 32 members.
- Typing indicators and online presence are ephemeral and scoped to a chat with an active realtime connection; they are not persisted or a global presence directory.
- Global search finds discoverable people and chats the signed-in user may access. Conversation message search filters decrypted messages already loaded in the current browser; encrypted message plaintext is never sent to or indexed by the server.
- Conversations open at the latest messages and load older authorized history in pages while scrolling upward, preserving the current reading position as earlier messages are added.
- Initial Spaces support provides a client-room template, customizable Space name/description/icon, an owner-created `#general`, collapsible channel categories, channel topics, discussion/announcement/private/voice channels, username-based member/guest invites, and channel-scoped guest grants. Owners and admins can configure per-channel view/send permissions for moderators, members, and guests, plus speak permissions for voice channels; owner/admin access is fixed, and role permissions never create channel membership or expose private channels without an explicit grant. Defaults preserve prior behavior, including announcement posting restrictions. Text channels support `@username` mentions and permission-restricted `@everyone` pings, delivered only to users who can view the channel. Persistent Space voice rooms reuse LiveKit, admit up to 16 participants, and disclose that voice media is not end-to-end encrypted; role and individual channel access govern joining and speaking. Space channel text is server-readable (unlike E2EE personal chats) and is stored separately. Custom role creation, member removal, role reassignment, group-to-Space conversion, email invitations, shared objects/Updates, and channel media are not yet implemented.
- Communities and the remaining Phase 1 shared objects/Updates work are not implemented yet.
- Architecture/product work still required before a broad production launch includes identity-key verification and recovery, a security review of the cryptographic design, operational deployment/monitoring, and the remaining PRD phases listed above.
