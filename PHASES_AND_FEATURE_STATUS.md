# SyncUp PRD Phases and Feature Status

Status legend:
- ✅ Implemented
- 🟡 Partially implemented / in progress
- ❌ Not implemented yet

## Executive summary

The product roadmap is split into four phases in the PRD:

1. Phase 0 — Messenger that feels finished
2. Phase 1 — The wedge
3. Phase 2 — Habit
4. Phase 3 — Communities

Current repo state: Phase 0 is largely built, Phase 1 is partially implemented, and Phases 2–3 are not started.

---

## Phase 0 — Messenger that feels finished

Purpose: ship a polished secure messaging and calling app before expanding into spaces and collaboration.

### Implemented

- ✅ Email/password auth and session flow
- ✅ Account creation, sign-in, sign-out
- ✅ Profile name, username, avatar
- ✅ Username discovery and message requests
- ✅ DM and group chat creation
- ✅ Message send/receive with history
- ✅ Replies, reactions, edits, deletes
- ✅ Delivery/read state and typing indicators
- ✅ Drafts and outbox sync
- ✅ Reconnect catch-up and idempotent retries
- ✅ Encrypted file attachments and encrypted object storage flow
- ✅ 1:1 audio/video calls with call history
- ✅ Block/report/session-revocation controls
- ✅ Desktop/mobile workspace shell
- ✅ Global and in-chat search
- ✅ E2EE for direct messages and groups
- ✅ LiveKit-based calls
- ✅ Local-first resilience and IndexedDB outbox

### Remaining / not yet done in this phase

- ❌ Full public production security review and identity-key recovery process
- ❌ Finalized key recovery / password reset strategy
- ❌ Fully hardened operational launch checklist
- ❌ Some polish items from the PRD: dark mode, push, voice notes, etc. (depending on exact release target)

### Overall status

- Phase 0 status: ✅ Mostly implemented

---

## Phase 1 — The wedge

Purpose: turn the messaging app into a working collaboration product for operators, teammates, and guests.

### Implemented

- ✅ Space/client-room slice exists in the current app
- ✅ Space creation and owner-created `#general`
- ✅ Custom Space name / description / icon
- ✅ Channel categories and channel topics
- ✅ Discussion, announcement, private, and voice channel concepts
- ✅ Username-based member/guest invites
- ✅ Channel-scoped guest grants and permissions
- ✅ Per-channel view/send permissions by role
- ✅ Voice-room support with LiveKit and participant limits
- ✅ `@username` mentions and restricted `@everyone` access logic
- ✅ Space membership and role enforcement logic for channel access
- ✅ Server-readable channel text storage
- ✅ Space-scoped search across accessible channel messages, files, and shared objects, with author/date/type filters
- ✅ Channel file gallery/list with permission-checked upload and download
- ✅ Group membership and invite flow
- ✅ In-place Group → Space conversion with the same chat ID and conversion-member-only access to earlier encrypted history and attachments

### Partially implemented / in progress

- 🟡 Client-room and Space features are present, but not all Phase 1 primitives are complete
- 🟡 Shared objects and Updates are now implemented for Space channels; DM support and some richer assignment behavior remain out of scope
- 🟡 Guest access is implemented in a slice, but broader production-grade governance still needs finishing
- 🟡 Billing/workspace seat model is not a complete, production-ready flow
- 🟡 P1-10 integration coverage is in place but still needs execution against a migrated PostgreSQL-backed API

### Remaining / not yet done in this phase

- ❌ Custom role creation and role reassignment
- ❌ Email invitations and guest invite pipeline
- ❌ Mature notification policy controls for each chat and space
- ❌ Production-level permission hardening and guest isolation validation
- ❌ Advanced operator admin surfaces
- 🟡 Phase 1 exit scenarios J2, J3, and J5 still need end-to-end verification

### Overall status

- Phase 1 status: 🟡 Partial implementation

### Recommended next implementation

Run the P1-10 integration coverage against a migrated PostgreSQL-backed API, then continue with channel/group call exit criteria (P1-11) and per-chat/Space notification policies (P1-12). Before calling Phase 1 complete, verify the J2, J3, and J5 user journeys and automated guest-isolation checks.

---

## Phase 2 — Habit

Purpose: increase daily usage and habit formation without introducing new primitives.

### Implemented

- ❌ None of the Phase 2 features are clearly implemented yet

### Remaining / not yet done

- ❌ Notification schedules
- ❌ Presence visibility refinements
- ❌ Link unfurls
- ❌ Report/admin queue workflow
- ❌ Richer file and media behavior
- ❌ Location objects
- ❌ Product polish and habit-building improvements
- Note: P1-12 notification policies are still a Phase 1 prerequisite; Phase 2 notification schedules build on those controls.

### Overall status

- Phase 2 status: ❌ Not started

---

## Phase 3 — Communities

Purpose: support audience-based communities and scalable public/community interactions.

### Implemented

- ❌ None of the Phase 3 community model is implemented yet

### Remaining / not yet done

- ❌ Audience/community primitive beyond Spaces
- ❌ Join queue and membership rules
- ❌ Contributor role model
- ❌ Announcement fan-out and moderation tooling
- ❌ Community events at scale
- ❌ Community billing / memberships / paid SKU
- ❌ Moderation queue and audit trail

### Overall status

- Phase 3 status: ❌ Not started

---

## Recommended interpretation for this repo

The codebase is best described as:

- A Phase 0 product that is substantially implemented
- A Phase 1 product in early-to-mid slice form
- Phase 2 and Phase 3 work still in the future

That matches the README’s statement that the app currently includes:

- end-to-end encrypted direct/group messaging
- encrypted file attachments
- call infrastructure
- first Phase 1 Space/client-room slice

and that:

- Communities are not implemented yet
- Shared objects / Updates work are not yet complete
- additional product/security work is still required before broad launch

---

## Suggested release view

If the team is tracking delivery by phase, the practical roadmap looks like this:

| Phase | Status | Summary |
|---|---|---|
| Phase 0 | ✅ Mostly done | Secure messaging and 1:1 calling foundation |
| Phase 1 | 🟡 Partial | Spaces, channels, guests, and collaboration features |
| Phase 2 | ❌ Pending | Habit and operational maturity |
| Phase 3 | ❌ Pending | Communities and audience-scale features |

This document is intentionally brief and can be expanded later into a delivery checklist per phase.

---

## Post-MVP differentiators to add

These are the strongest features to add after MVP to help SyncUp stand out in the market without drifting into a generic chat app.

### 1) Decision-first workspaces
- Durable decision records with owner, rationale, status, and linked discussion
- Decision pins that remain discoverable after chat threads move on
- Audit trail for changes to decisions and project direction
- “What was decided?” view for clients and internal teams

### 2) Shared-object system beyond simple polls
- Project briefs and client notes with approval state
- Task/checklist objects with owners and due dates
- Event objects with RSVP and updates
- Structured update objects linked to conversations and spaces

### 3) Guest/client collaboration built for external partners
- One-click guest onboarding
- Role-scoped external access
- Approval gates before guest entry
- Branded client-facing workspaces and shared rooms
- Read-only or limited-view guest modes for more controlled collaboration

### 4) Context retrieval and memory for Spaces
- Searchable decision history and project memory
- “What changed since last week?” summaries
- Space-level timeline of updates, actions, and decisions
- Retrieval of relevant files and decisions without forcing users to read old chat history

### 5) Notification intelligence
- Action-required alerts instead of noisy message pings
- Per-role digest and quiet-hour settings
- Mention and decision-based prioritization
- Weekly recap for client spaces and active threads

### 6) Voice notes and async updates
- Short voice note summaries for decisions and handoffs
- Async voice updates from clients or teammates
- Transcript + action extraction from recorded updates
- Fast, low-friction communication for remote teams

### 7) Trust, moderation, and governance
- Admin moderation queue for reports and flagged content
- Audit log of role changes, message edits, and object updates
- Retention policies and export options
- Better compliance controls for client-facing operations

### 8) Workflow templates for recurring client work
- Kickoff room template
- Weekly status room template
- Approval workflow template
- Handoff and delivery template
- Decision log template

### 9) Operational memory layer
- Shared “project memory” across space, channel, and update history
- Stable record of outcomes, owners, and open actions
- Reduce context drift and repeated explanations

### 10) Better customer-facing “client room” experience
- Branded surface for external stakeholders
- Clear permissions and trust boundaries
- Easy onboarding and low friction for non-Slack users
- Minimal complexity for people who only need updates and approvals

### Recommended prioritization

If the goal is to stand out in the market, the most valuable post-MVP layer is:

1. Decision-first workspaces
2. Guest/client collaboration
3. Context retrieval / memory for Spaces
4. Notification intelligence
5. Workflow templates and governance

This combination makes SyncUp feel like a secure collaboration system for decisions and client work, not just another messaging tool.
