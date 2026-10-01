# SyncUp
## Product Requirements Document

| | |
|---|---|
| **Product** | SyncUp |
| **Document** | Product Requirements Document (PRD) |
| **Version** | 1.0 — Approved for implementation |
| **Status** | Final |
| **Date** | 29 September 2026 |
| **Owner** | Product |
| **Audience** | Engineering, design, and implementation |
| **Supersedes** | *SyncUp — Product Vision & Platform Overview* (vision), plus strategy addendum (wedge, taxonomy, pricing, E2EE, phasing) |

This document is the system of record. Where it conflicts with the vision PDF, **this PRD wins**. The vision remains the long-range north star; this PRD defines what we build, in what order, and what we refuse.

---

## 1. One-line product

SyncUp is a conversation-first communication platform: a fast private messenger that can grow into a structured client/team workspace and, later, an audience community — without changing apps, identity, or history.

**Launch positioning (use this, kill the rest):**

> Slack is too much to invite a client into. WhatsApp is too little to run the work. SyncUp is the shared room.

---

## 2. Problem

Professionals who work with people *outside* their company currently split work across WhatsApp (where the outsider already lives), email/Drive (where files go to die), and Slack (which the outsider will not install).

Consequences:

- Decisions disappear in chat scrollback.
- Files are unsearchable and unpermissioned.
- There is no guest vs member boundary.
- A birthday group and a paid client room are the same object.
- Teams either over-invite outsiders into Slack (cost, friction, oversharing) or under-structure WhatsApp (chaos, no audit, no topics).

SyncUp exists to own **external collaboration that feels like a messenger**.

---

## 3. Goals and non-goals

### 3.1 Product goals

1. Two people can run a real working relationship on SyncUp and not open WhatsApp for that person.
2. An operator can run multiple **client rooms** (Spaces) with **free guests**, private internal channels, files, and decisions that remain findable.
3. A group chat can become a Space without exporting history.
4. Structured outcomes (polls, events, checklists, pins) stay attached to the conversation that produced them, and surface in **Updates**.
5. Personal chats are actually private (E2EE). Workspaces are honest about being server-readable.

### 3.2 Business goals (18 months)

- Workspace SKU is the revenue line: operators pay, guests do not.
- Personal messenger is the acquisition graph, not the business.
- Communities, paid memberships, SSO, bots, and self-host are sequels.

### 3.3 Explicit non-goals (v1 / Phases 0–2)

| Out | Why |
|---|---|
| Project management (boards, sprints, issue IDs) | We are not Linear/Jira |
| Email client or calendar suite | Events exist; we do not replace Google Calendar |
| Course / LMS platform | We are not Circle-the-school |
| Public social feed | We are not a network |
| E2EE Spaces | Contradicts search, guests, objects |
| Self-host | Sales objection, not a v1 product |
| Bots / webhooks / app store | Operators asked for guests and files |
| Call recording, transcription, meeting AI | Privacy + scope |
| Semantic / AI search on E2EE chats | Forbidden; optional later on Spaces only |
| Discord-scale fan-out | Phase 3, different infra |
| Replacing Slack for internal engineering at 200+ companies | Lost war |

### 3.4 Success metrics

**Phase 0 (messenger) — 30-day exit test**

- Two seeded users can complete: sign in, DM, reply, react, send image, 1:1 call, see the same history on a second session, and observe message delivery/read receipts.
- Message round-trip (send → appear on peer) p95 < 400ms on a healthy link.
- Duplicate delivery rate = 0 for idempotent retries.
- Offline send while disconnected, appear once after reconnect.

**Phase 1 (wedge) — 30-day exit test**

- Operator creates 5 Spaces, invites guests, keeps `#internal` hidden from guests.
- Guest finds a pinned decision from 6+ messages ago in < 10 seconds (Updates or search).
- Guest never sees channels they were not invited to (automated ACL tests).
- Group → Space upgrade preserves full history in `#general`.

**North-star (post-launch)**

- WAU operators who have ≥ 1 guest in a Space
- Messages sent in Spaces that include at least one guest
- Weekly retrievals of a shared object (poll/event/checklist/pin) older than 7 days — proof that context is not dying

---

## 4. Personas

| Persona | Job | Pays? | Primary surfaces |
|---|---|---|---|
| **Ava — Operator** | Runs a 8-person studio. 8 clients, currently in WhatsApp groups. | Yes — Workspace seat | Spaces, Updates, search |
| **Chris — Teammate** | Designer on Ava’s team. Needs `#internal` plus client channels. | Yes — Workspace seat | Chats + Spaces |
| **Nadia — Guest / client** | Marketing lead at the client company. Will not install Slack. Wants WhatsApp-simple. | No | Invited channels, Updates (needs you), files, calls |
| **Omar — Personal user** | Uses SyncUp like WhatsApp with a few colleagues. Acquisition graph. | No (Free) | DMs, groups, calls |

Communities (Phase 3) add **Owner-of-audience** and **Member-of-community**. They are not in the launch loop.

---

## 5. Product principles (normative)

1. **Conversation first.** Messaging is fast and familiar. Advanced capabilities appear in the composer `+` when needed — never as chrome that slows a DM.
2. **Private-to-public continuum.** Direct chats, groups, Spaces, Channels, Communities share one interaction model. Upgrades are additive, not migrations.
3. **Local-first resilience.** The composer always accepts input. Outbox queues, retries, reconciles. Realtime is a hint; durable store is truth.
4. **Context over fragmentation.** If it did not happen in a conversation, it does not exist. Objects always have a parent chat.
5. **Outsider is a first-class user.** Guests are free, fast to invite, and strictly scoped. Designing only for the operator is a bug.
6. **Attention is a feature.** Default Space notifications are mentions + Updates, not every message. One badge = things that expect a reply.
7. **Security is infrastructure.** UI hiding is not authorization. Server checks every resource. E2EE is a mode with real constraints, not a badge.
8. **Honesty over magic.** Personal chats are sealed. Spaces are workspace-grade confidential, not sealed. We say so.

---

## 6. Domain model

### 6.1 User-facing objects (three + one view)

| Object | What it is | User never has to know |
|---|---|---|
| **Chat** | A conversation. Direct, group, or channel. | “Conversation type” beyond DM / group / channel |
| **Space** | Private container: members, roles, home, channels, files, guests. | That channels are internally chats |
| **Community** | A Space with an audience policy (Phase 3) | A new primitive — it is not one |
| **Updates** | Cross-cut view of structured objects | A “layer” of the platform |

### 6.2 Invariants

1. Every Channel is a Chat (`kind = channel`), parented by a Space (or, Phase 3, a Community which is a Space).
2. Every Space contains at least one chat: `#general`, created at Space creation, not deletable, only archivable by owner.
3. A Community **is** a Space (`space.audience_mode ≠ private`). Opening as Community does not clone data.
4. Direct chats never live inside a Space. DMs are the personal graph.
5. Groups are not Spaces until upgraded. Upgrade is in-place: the group chat becomes `#general`.
6. Every shared object has `chat_id` (parent) and optional `space_id` (denormalized for listing).
7. UUIDv7 identifies entities. **Ordering of messages is `chat_id + server_seq`**, never the UUID.

### 6.3 Chat kinds

| `kind` | Encryption | Membership | Notes |
|---|---|---|---|
| `direct` | E2EE | Exactly 2 users | Created on first message or explicit “new message” |
| `group` | E2EE if `member_count ≤ 32` AND no bots AND no guests | Named, ≥ 2 | Can upgrade to Space |
| `channel` | Server-readable | Via Space membership ∩ channel grants | `announcement` \| `discussion` \| `private` |

If a group exceeds 32 members, E2EE is **not** offered; the group is server-readable and the UI discloses it at creation and at the 33rd invite. We do not support “upgrade from E2EE group to server-readable” silently — the owner confirms, history stays E2EE, new messages are server-readable **or** we refuse the 33rd member until they create a Space (preferred: prompt “Turn into a Space” which is always server-readable going forward, with a one-time disclosure).

**v1 decision (normative):** groups that intend to grow become Spaces. Hard cap on E2EE groups: 32. Inviting member 33 requires converting to a Space (server-readable from conversion point; prior ciphertext remains ciphertext).

### 6.4 When to use what

| Situation | Object | Upgrade cue |
|---|---|---|
| Two people | Direct chat | — |
| Named people, one stream, no outsider permissions | Group | “This group is getting busy — add topics?” |
| Ongoing work, files, guests, more than one topic | Space | Default as soon as a guest is invited |
| Audience you do not all know personally | Community | Phase 3: “People are asking to join” |

### 6.5 Upgrade: Group → Space

- Trigger: owner action, or system prompt when inviting a guest / creating a second topic.
- The existing group chat is renamed `#general` (customizable), `kind` becomes `channel`, Space is created around it.
- All messages, media, and membership copy **in place** (same `chat_id`).
- Members remain members; the converter becomes owner.
- History is not exported/imported. If this requires a copy, it is a bug.

### 6.6 Upgrade: Space → Community (Phase 3)

- Owner sets `audience_mode` to `request` \| `open` \| `paid`.
- Existing channels remain. Announcement channel gets fan-out semantics.
- New: join queue, rules, role `contributor`.
- No data clone.

---

## 7. Roles and authorization

### 7.1 Single ladder

```
owner → admin → moderator → member → guest → requester
```

`contributor` exists only on Communities (Phase 3), between moderator and member.

There is **one** permission engine. Community adds `requester` and `contributor`. Do not invent a second RBAC.

### 7.2 Space roles (Phase 1)

| Capability | Owner | Admin | Moderator | Member | Guest |
|---|---|---|---|---|---|
| Delete Space | ✓ | | | | |
| Transfer ownership | ✓ | | | | |
| Manage billing (operator org) | ✓ | ✓ | | | |
| Create / archive channels | ✓ | ✓ | | | |
| Invite members | ✓ | ✓ | | | |
| Invite guests | ✓ | ✓ | ✓ | | |
| Kick members / guests | ✓ | ✓ | guests only | | |
| Change roles | ✓ | ✓ except owner | | | |
| Post in discussion channels they can see | ✓ | ✓ | ✓ | ✓ | ✓ |
| Post in announcement channels | ✓ | ✓ | ✓ | | |
| Create shared objects | ✓ | ✓ | ✓ | ✓ | ✓ in invited channels |
| Pin as decision | ✓ | ✓ | ✓ | ✓ | |
| Start channel call | ✓ | ✓ | ✓ | ✓ | ✓ if channel allows |
| View member directory | full | full | full | full | **only people in shared channels** |
| View uninvited channels | ✓* | ✓* | ✓* | ✓* | **never** |

\* Private channels still require explicit grant even for members. Owner/admin can always grant themselves.

### 7.3 Guest isolation (normative, tested)

A guest of Space S:

1. Sees Space home with **only** invited channels listed.
2. Cannot discover channel names they are not in (API returns 404, not 403, for existence hiding).
3. Cannot list members except those who share at least one channel with them.
4. Cannot invite anyone.
5. Cannot create channels.
6. Cannot convert the Space or change settings.
7. Receives notifications only from invited channels, plus Updates objects in those channels.

Every guest-isolation rule has an automated test. UI hiding without server enforcement is a ship blocker.

### 7.4 Direct and group chats

- Direct: either participant can leave (hides the chat); block is separate.
- Group: creator is owner; can promote admins; members can leave; owner can delete group.
- Message requests: if A messages B and they are not contacts and B’s setting is “requests”, the message lands in B’s **Requests** inbox until accept/ignore/block. A does not see B’s read state until accept.

### 7.5 Server-side rule

Every read/write of chat, message, object, membership, file, or call requires an authorization check on the server. Client route guards are UX only.

---

## 8. Identity, sessions, devices

### 8.1 Accounts

- Sign up / sign in with email + password (v1). Username is unique, optional display at first, required before discovery.
- Profile: display name, avatar, username, about (short), discoverability (`username_search` on/off).
- Phone number is **out of v1** (avoids becoming a phone-graph clone on day one; email/username is the professional wedge).

### 8.2 Contacts and discovery

- Find people by exact username, or email if the target allows.
- Sending a message to a non-contact creates a **message request**, not an unsolicited thread in their main inbox.
- Accept request → contact both ways (or one-way follow — **v1: mutual contact on accept**).
- Block: no messages, no calls, no Space guest invites from that user (existing Space memberships are **not** auto-removed; operator is prompted).

### 8.3 Devices and sessions

- User, device, and session are separate identities.
- Multiple sessions allowed.
- Session list: device name, last active, IP region (coarse), revoke.
- Access token short-lived; refresh token rotates; reuse of a rotated refresh token revokes the family.
- Remote sign-out supported.

### 8.4 Encryption identity (personal chats)

- Each device holds an identity key + signed prekeys (or a simpler per-user vault key wrapping per-chat keys if we start with a single-device-first E2EE — see §14).
- **v1 implementation allowance:** if the first ship is web-only with a single logged-in browser, E2EE may use a user-level chat key stored in a client vault wrapped by a key derived from the password (or a recovery key shown once). Multi-device E2EE key gossip is Phase 0.1, not a reason to slip the messenger.
- Spaces are never E2EE.

---

## 9. Messaging

### 9.1 Core behaviors (Phase 0 MUST)

- Send text (up to 8,000 Unicode code points).
- Reply (single parent); quoted snippet shown.
- React (emoji; one reaction type per user per message; toggle off).
- Edit (text only, 15-minute window, “edited” flag).
- Delete for me; delete for everyone (15-minute window, sender or chat admin).
- Copy; pin in-chat (distinct from “pin as decision” object).
- Delivery states: `pending` (local outbox) → `sent` (server ack) → `delivered` (persisted per peer device, shown per recipient) → `read` (peer read cursor; hidden when that user's read receipts are disabled).
- Typing indicator (ephemeral, not persisted).
- Presence: online / recently / offline; user can hide last-seen.
- Drafts per chat, persisted locally, restored on navigation.
- Unread cursor per chat per user, synced.

### 9.2 Ordering and identity

- `message.id` = UUIDv7.
- `message.chat_id` + `message.server_seq` (monotonic per chat, assigned by server in a transaction) is the timeline.
- Clients render by `server_seq`. Pending local messages sit at the end with temporary ids, then rebase onto `server_seq` without duplicating.
- **Idempotency:** every send carries `idempotency_key` (client UUID). Server unique-indexes `(sender_id, idempotency_key)` and returns the original message on retry.

### 9.3 Outbox (local-first)

1. User hits send → message appended locally as `pending`, UI shows it immediately.
2. Outbox worker submits when online.
3. On ack, local row updates to server id + seq.
4. On failure, retry with backoff; same idempotency key.
5. On reconnect, catch up via `sync_cursor` per chat (last `server_seq` applied) plus a global user cursor for membership changes.

Realtime events are **hints** (“new message in chat X”). The client may fetch the durable row; it must not treat the event payload as the only copy of truth.

### 9.4 Threads

- v1: **reply-in-place** (WhatsApp style), not Slack threads as separate rooms.
- A “thread view” filter on a root message (list of replies) is SHOULD, not MUST, for Phase 0.
- Phase 1 may add channel-side threads if operators demand it; not required for wedge.

### 9.5 Mentions

- `@username` in groups/channels. Creates a mention notification.
- `@everyone` only in Spaces, only owner/admin/moderator, never in DMs, never by guests.

---

## 10. Spaces (Phase 1)

### 10.1 Space home

When a Space is selected and no channel is active:

- Name, description, avatar
- Member count + guest count (guests do not see full member count beyond people they can see)
- List of channels they can access
- Active call (if any)
- Next 3 events
- Open checklists assigned to the viewer
- 5 latest pins/decisions
- Primary actions: **Invite**, **New channel** (hidden for guests), **Start call** in `#general`

### 10.2 Channels

| Mode | Who can post | Default notify |
|---|---|---|
| Discussion | All who can see it | Mentions + Updates (Space default) |
| Announcement | Owner, admin, moderator | All messages for members/guests who can see it |
| Private | All who are granted | Mentions + Updates |

- Channel has name, description, topic, created_by, archived_at.
- Archive preserves history and search; posting is disabled.
- `#general` cannot be deleted.

### 10.3 Channel grants

- Discussion channels in a Space: **members-in by default**; guests **out** until invited.
- Private channels: opt-in for members too.
- Announcement: members-in by default; guests out until invited.
- Changing a channel from discussion → announcement does not remove history.

### 10.4 Client-room template (default for “New Space”)

Created automatically:

1. `#general` (discussion) — all members + all guests
2. `#internal` (private) — members only, guests never
3. Suggested empty: `#files` is **not** a channel; files live on messages + the Files context panel

Space creation dialog:

- Name
- Purpose: Team / Client room / Other (Client room is the default highlight)
- Invite teammates (members)
- Invite clients (guests) — can skip

### 10.5 Files in a Space

- Not a Drive clone. **Files tab** = all file attachments in channels the viewer can see, reverse chronological, filter by type.
- Download uses short-lived signed URLs.
- Guest only sees files from invited channels.

---

## 11. Shared objects and Updates (Phase 1)

### 11.1 Rule

A shared object is created **in a chat**, rendered **in the transcript**, and indexed **in Updates**. Destroying the parent chat’s access destroys object access.

### 11.2 Object types in v1 (closed set)

| Type | Fields (minimum) | Terminal states |
|---|---|---|
| **Poll** | question, 2–8 options, multi_select?, closes_at?, anonymous? | open → closed |
| **Event** | title, starts_at, ends_at?, timezone, location_text?, rsvp required? | scheduled → happening → ended / cancelled |
| **Checklist** | title, items[{text, assignee_id?, due_at?, done}] | open → completed |
| **Pin / decision** | source_message_id, title (editable), body quote | active → unpinned |

**Out of v1 object set:** live location, custom records, tasks with workflow, voting beyond polls.

### 11.3 Creation

- Composer `+` → Poll / Event / Checklist.
- Long-press (desktop: overflow on a message) → **Pin as decision**.
- Guests can create polls/events/checklists in channels they can post in; they cannot pin as decision.

### 11.4 Updates view

Three stacks, always:

1. **Needs you**
   - Open polls you have not voted in (and still open)
   - Checklist items assigned to you and not done
   - Events starting within 48 hours you have not RSVP’d
   - (Later) unanswered questions — out of v1
2. **Happening**
   - Live calls in chats/Spaces you can access
   - Events whose start ≤ now < end
3. **Decided**
   - Closed polls with results
   - Completed checklists
   - Active pins/decisions
   - Searchable; reverse chronological by closed/pinned time

Every row links to the exact message in the parent chat (`chat_id` + `message_id`). No orphan objects.

Filters: All | DMs | Spaces. Guest sees only objects in invited channels.

### 11.5 Rendering in transcript

Objects render as compact cards in the message stream, not as grey system noise. Closing a poll updates the same card in place for all clients (new `object_revision` + realtime hint).

---

## 12. Calls (Phase 0: 1:1; Phase 1: channel/group)

### 12.1 Phase 0 MUST

- 1:1 audio and video from a direct chat
- Incoming call UI (accept / decline)
- Mute, camera on/off, end
- Call history as a system message in the chat (“Call, 4 min”) plus an entry in Calls tab
- Calls tab shows recent call history and current ringing/active direct calls; selecting a history item opens its conversation.
- Device picker (mic / camera) — SHOULD

### 12.2 Phase 1 MUST

- Start a call from a group or channel; members who can see that chat can join
- Participant list, mute self, camera self, leave
- Active call banner on the chat and on Space home
- Max participants v1: **16** (SFU; disclose the cap)

### 12.3 Out of v1

- Screen share (SHOULD if cheap via LiveKit; not a blocker)
- Recording, transcription, summaries
- E2EE calls (transport encryption only; disclose “not end-to-end encrypted”)
- Breakout rooms, raising hand, whiteboard

### 12.4 Infra

LiveKit (or equivalent SFU). Application server issues short-lived room tokens only after authz: caller/callee membership in the chat. Media never transits the API monolith.

---

## 13. Media and files

### 13.1 Phase 0

- Images (jpeg, png, webp, gif) up to 10 MB
- Generic files (pdf, doc/docx, slides, zip, txt) up to 25 MB
- Client-side type and size validation; server re-validates
- Image preview in transcript; file chip with name + size
- Upload via presigned PUT to S3-compatible storage; API only stores metadata + object key
- Download via presigned GET, authz checked before minting

### 13.2 Phase 1

- Conversation / Space / channel **gallery** (images) and **files** list
- Voice notes: record, upload, playback, waveform optional. Cap 5 minutes. MIME: audio/webm or audio/mp4.

### 13.3 Out of v1

- Transcoding pipeline, malware scanning beyond content-type, video streaming, 2 GB WhatsApp-style blobs

E2EE chats: media is encrypted client-side; object store holds ciphertext; server cannot generate thumbnails. Spaces: server-side thumbnails allowed.

---

## 14. Encryption and privacy (normative)

### 14.1 Table

| Surface | Promise | Implementation |
|---|---|---|
| Direct chats | E2EE message body + attachments | Client encrypt; server stores ciphertext + metadata (ids, seq, timestamps, sender) |
| E2EE groups (≤ 32, no guests) | Same | Same |
| Spaces / channels | TLS + at-rest. **Server-readable.** | Disclosed at Space creation and in Space settings |
| Communities | Server-side | Required for moderation |
| Calls | DTLS/SRTP (WebRTC). **Not E2EE** in v1 | Copy in pre-call UI |
| Search | Only over plaintext the server may read | E2EE chats: local search only |
| AI (future) | Spaces/Communities, owner toggle, never E2EE | Forbidden on personal layer |

### 14.2 Metadata the server always sees

Membership, chat ids, message ids, seq, timestamps, sender id, message type, ciphertext size, object type. We do not pretend otherwise.

### 14.3 Sealed Space mode

Out of v1. If shipped later: disables server search, bots, and server-side objects. Not a silent retrofit of E2EE onto existing Spaces.

### 14.4 Read receipts and last seen

- Default on for DMs; user can disable globally.
- Groups/channels: read receipts are **aggregated** (not who-read lists) in v1, except owner/admin MAY see counts, not identities, for announcements.

---

## 15. Search

### 15.1 Phase 0

- Global search: people (username), chats by title, messages in **server-readable** chats the user can access, plus **local-only** search of decrypted E2EE messages loaded during the current app session. Message text from E2EE chats is never sent to or searched by the server.
- Conversation search: filter current chat.
- Results permission-checked.

### 15.2 Phase 1

- Filters: from, date range, has:file, has:image, object type.
- Space-scoped search: messages + files + objects in channels the user can see.

### 15.3 Out of v1

Semantic search, AI summaries as a dependency of correctness. Postgres FTS (or equivalent) is enough until a Space exceeds ~1M messages.

---

## 16. Notifications and attention

### 16.1 Defaults (normative)

| Surface | Default |
|---|---|
| Direct | All messages |
| Groups the user created | All |
| Groups the user joined | All (until they mute) |
| Space discussion channels | **Mentions + Updates objects only** |
| Space announcement channels | All |
| Message requests | Silent badge on Requests, no sound |
| Calls | Always ring unless DND, with “starred people and calls break DND” |

### 16.2 Capabilities (Phase 1)

- Per-chat: all / mentions / mute
- Per-Space: inherit / mentions / important (Updates) / mute
- DND schedule
- Unread + mention counters synced across devices
- Desktop notifications; web push if the browser allows
- Native mobile push: Phase 0.1 / native apps — web v1 uses Web Notifications API

### 16.3 Badge math

The Chats navigation badge counts distinct conversations with unread **reply-expected** messages, not the total number of unread messages. Each chat row may show its own unread-message count. In Phase 0, all DMs and groups use the all-messages behavior, so any unread incoming message makes that conversation count once. Message requests have a separate Requests badge. In Phase 1, channel mentions and notification preferences determine which Space conversations count. Pins and events do **not** increment Chats unread; they increment Updates.

---

## 17. Privacy, safety, trust (Phase 0–1)

MUST:

- Block user
- Report user or message (reason enum + optional text; stored for admin)
- Message-request isolation
- Session list + revoke
- Guest ACL (see §7.3)
- Rate limits: send, invite, search, login
- Security event log: login, logout, password change, session revoke, role change, Space delete

SHOULD:

- Hide last seen / read receipts
- Disable username discovery

Phase 3: moderation queue, audit trail for Community actions, mass-delete.

Admin/ops console is **out of the end-user app**; a stub internal review queue for reports is enough for v1.

---

## 18. Information architecture and UX

### 18.1 Desktop (≥ 1100px) — chat list and conversation

```
[ A rail 72px ][ B list 280px ][ C conversation flex ]
```

| Pane | Contains | Never contains |
|---|---|---|
| **A Rail** | Chats, Updates, Spaces, Calls, You (avatar) | Message text |
| **B List** | Inbox **or** Space channel list + members | Transcript |
| **C Main** | Active chat and composer locked to bottom, or the selected chat's full-screen details | Settings or member admin as a third pane |

The conversation header's chat name/avatar opens a dedicated details screen in place of the conversation. Back returns to the same conversation without discarding its draft or scroll position. Group members, mutual-contact invites, and leave-group actions live on group details.

### 18.2 Mobile (≤ 700px)

Bottom nav: **Chats | Updates | Spaces | Calls | You**. Phase 0 renders only implemented destinations (Chats, Calls, You); Updates and Spaces stay hidden until their Phase 1 screens exist.

- Chats is WhatsApp-shaped: search, filters (All / Unread / Requests), list, thread. The Chats navigation badge counts unread conversations; each row can show its unread-message count and Requests keeps a separate badge.
- Tapping the chat or group name/avatar opens a dedicated full-screen details view; Back returns to the thread. Details never appear as a drawer, sheet, or additional pane.
- Group members, mutual-contact invites, and leave-group actions are managed from group details.
- Space: home → channel list → thread. Back stack is sacred.
- Incoming call is a full-screen overlay.

Tablet (701–1099px): rail + list + conversation; details replace the conversation with Back navigation. At ≤700px, the implemented bottom navigation remains available in list, thread, and details views, and the composer stays above it and the device safe area.

### 18.3 Composer

Always visible at the bottom of C.

Primary: text field, attach, voice (Phase 1), send.

Emoji picker SHOULD and inserts into the current draft. URLs in messages are linkified for display without changing encrypted message content. `+` menu: Poll, Event, Checklist (Phase 1); never a kitchen sink.

### 18.4 Empty states

- New account, Chats: “Message someone” + “Create a Space for a client or team”.
- Empty Space: Invite guest → Create channel → Pin a kickoff checklist, in that order.
- Requests: isolated empty “No message requests”.

### 18.5 Visual language

- Professional, calm, messenger-speed. Not Discord-purple gamer; not Slack-purple enterprise chrome overload.
- Brand: deep forest / ink green from the vision document, light surfaces, dark optional in v1 SHOULD.
- Motion: short (150–200ms), no decorative animation that delays send.
- Target 44px touch on mobile; composer never covered by the nav.

### 18.6 Screen inventory (Phase 0–1)

**Auth:** Welcome, Sign in, Sign up, Forgot password, Recovery key display (E2EE), Device/session list.

**Chats:** Inbox, Requests, Direct transcript, Group transcript, New message (user picker), New group, Group info.

**Spaces:** Space list, Create Space, Space home, Channel transcript, Channel info, Members & guests, Invite, Channel create, Space settings.

**Updates:** Needs you / Happening / Decided; object detail sheet.

**Calls:** Calls tab (recent history + ringing/active direct calls), in-call overlay.

**Profile:** You, profile/avatar edit, username discoverability, read-receipt and safety/privacy controls, sessions, appearance (system/light/dark; saved locally). Disabling discoverability removes the account from username search and blocks new username-based message requests without removing existing contacts. Phase 1 adds notification preferences.

**Search:** Palette / full-screen search (desktop: ⌘K).

---

## 19. User journeys (acceptance narratives)

### J1 — Private communication (Phase 0)

Omar signs up, finds Ava by username, sends a message. It lands as a request. Ava accepts. They exchange text and an image. Omar starts a 1:1 call. Ava joins, then leaves. Both see a call record in the chat. Omar opens the same chat in another session and sees the full history.

### J2 — Client room (Phase 1) — money path

Ava creates Space `Northwind Rebrand` using the Client room template. She invites Chris as member and Nadia as guest. Nadia sees `#general`, not `#internal`. Chris posts a file in `#internal`. Nadia cannot retrieve it by URL, search, or UI. In `#general` they run a poll, pin “We’re going with B”, and create a launch checklist. Nadia opens Updates → Decided and finds the pin. Ava starts a call from `#general`; Nadia joins.

### J3 — Group → Space

Omar’s group “Vendor Q4” gets a guest invite. SyncUp prompts to turn it into a Space. He confirms. The transcript is `#general`. He creates `#internal`. The guest never sees prior-invite private material (there was none); new `#internal` is members-only.

### J4 — Offline (Phase 0)

Omar composes two messages in a tunnel. Both appear as pending. Connectivity returns. Both send once. Ava sees two messages, not four. Omar’s pending messages become sent, then delivered when Ava's device fetches them, and read when Ava opens the conversation.

### J5 — Attention

Ava’s Space `#general` is noisy. She is not mentioned. Her Chats badge does not increment. An event created in `#general` appears under Updates → Needs you. A DM from Nadia does increment Chats.

---

## 20. Functional requirements by phase

Priority: **MUST** ships in that phase. **SHOULD** ships if it does not delay the exit test. **COULD** is backlog.

### 20.1 Phase 0 — Messenger that feels finished

| ID | Requirement | Pri |
|---|---|---|
| P0-01 | Email/password auth, session, sign out | MUST |
| P0-02 | Profile: name, username, avatar | MUST |
| P0-03 | Username discovery + message requests | MUST |
| P0-04 | Direct chats with send/receive/history | MUST |
| P0-05 | Groups: create, name, invite, leave | MUST |
| P0-06 | Reply, react, edit, delete | MUST |
| P0-07 | Delivery + read state | MUST |
| P0-08 | Typing + presence | MUST |
| P0-09 | Drafts | MUST |
| P0-10 | Outbox, idempotency, reconnect catch-up | MUST |
| P0-11 | Image + file attach (presigned) | MUST |
| P0-12 | 1:1 audio/video call + history | MUST |
| P0-13 | Block, report, session revoke | MUST |
| P0-14 | Desktop 3/4-pane + mobile nav | MUST |
| P0-15 | Global + in-chat search (as §15.1) | MUST |
| P0-16 | E2EE DMs (or documented single-device vault if multi-device E2EE slips) | MUST |
| P0-17 | Calls tab + You settings | MUST |
| P0-18 | Unread badges with §16.3 math | MUST |
| P0-19 | Emoji picker, linkify URLs | SHOULD |
| P0-20 | Dark mode | SHOULD |
| P0-21 | Web push | SHOULD |
| P0-22 | Voice notes | COULD (Phase 1 SHOULD) |

**Phase 0 exit:** J1 and J4 pass on desktop and mobile viewports. Guest/Space features are hidden, not stubbed-broken.

### 20.2 Phase 1 — The wedge

| ID | Requirement | Pri |
|---|---|---|
| P1-01 | Create Space + client-room template | MUST |
| P1-02 | Channels: discussion, announcement, private | MUST |
| P1-03 | Roles: owner, admin, moderator, member, guest | MUST |
| P1-04 | Guest isolation tests all pass | MUST |
| P1-05 | Invite by username/email; guests free | MUST |
| P1-06 | Space home | MUST |
| P1-07 | Poll, event, checklist, pin-as-decision | MUST |
| P1-08 | Updates: Needs you / Happening / Decided | MUST |
| P1-09 | Space search + files panel | MUST |
| P1-10 | Group → Space in-place upgrade | MUST |
| P1-11 | Group/channel calls, cap 16 | MUST |
| P1-12 | Per-chat and per-Space notification policies | MUST |
| P1-13 | Voice notes | SHOULD |
| P1-14 | ⌘K command palette | SHOULD |
| P1-15 | Workspace billing (operator seats, guests $0) | SHOULD (can be feature-flagged if payments lag) |
| P1-16 | Static location object | COULD |

**Phase 1 exit:** J2, J3, J5 pass. A guest cannot, by any API, read `#internal`.

### 20.3 Phase 2 — Habit

Notification schedules, presence visibility, link unfurls, report admin queue, richer files, location, polish. No new primitives.

### 20.4 Phase 3 — Communities

Audience modes, join queue, rules, contributor role, announcement fan-out (not a large group chat), moderation, events at scale, Community SKU + paid memberships.

Do not start Phase 3 until Phase 1 exit tests are true in production.

---

## 21. Data model (logical)

Identifiers: UUIDv7. Timestamps: `timestamptz`. Soft delete where history matters (`deleted_at`).

### 21.1 Identity

```
users                id, email, username, display_name, avatar_url, about,
                     discoverable, last_seen_at, last_seen_visible,
                     read_receipts_enabled, created_at, deleted_at

sessions             id, user_id, device_id, refresh_family, ua, ip_region,
                     created_at, last_active_at, revoked_at

devices              id, user_id, name, platform, created_at, last_seen_at

contacts             user_id, contact_id, state (pending|accepted|blocked), created_at
                     PK (user_id, contact_id)

message_requests     id, from_user, to_user, preview_ciphertext, created_at, state
```

### 21.2 Conversations

```
chats                id, kind (direct|group|channel), title, description,
                     encryption (e2ee|server), space_id null,
                     channel_mode (discussion|announcement|private) null,
                     created_by, last_seq, last_message_at, archived_at, created_at

chat_members         chat_id, user_id, role (owner|admin|moderator|member|guest),
                     notify (all|mentions|mute), last_read_seq, muted_until,
                     invited_by, joined_at, left_at
                     UNIQUE (chat_id, user_id) where left_at is null

spaces               id, name, slug, description, avatar_url, created_by,
                     audience_mode (private|request|open|paid), created_at, deleted_at

space_members        space_id, user_id, role, notify, invited_by, joined_at, left_at

channel_grants       chat_id, user_id, granted_by, created_at
                     (for private channels and guest access)
```

Direct chats: `kind=direct`, exactly two `chat_members`, canonical pair unique `(least_id, greatest_id)`.

### 21.3 Messages

```
messages             id, chat_id, server_seq, sender_id, idempotency_key,
                     type (text|image|file|audio|object|system|call),
                     body_ciphertext, body_plaintext null,  -- plaintext only if encryption=server
                     reply_to_id, edited_at, deleted_at, deleted_for (sender|all),
                     created_at
                     UNIQUE (chat_id, server_seq)
                     UNIQUE (sender_id, idempotency_key)

message_reactions    message_id, user_id, emoji, created_at
                     PK (message_id, user_id, emoji)

attachments          id, message_id, object_key, content_type, size_bytes,
                     filename, width, height, encrypted, created_at

sync_cursors         user_id, device_id, chat_id, last_seq, updated_at
```

### 21.4 Objects, calls, safety

```
shared_objects       id, type, chat_id, space_id, message_id, created_by,
                     state, payload jsonb, revision, closes_at, created_at, updated_at

object_votes         object_id, user_id, option_idx, created_at   -- polls
object_rsvps         object_id, user_id, status (yes|no|maybe), updated_at
checklist_items      id, object_id, text, assignee_id, due_at, done, position

calls                id, chat_id, created_by, sfu_room, started_at, ended_at, status

reports              id, reporter_id, target_user_id, message_id, reason, notes, created_at, state
security_events      id, user_id, type, meta jsonb, created_at
```

### 21.5 Indexing (minimum)

- `messages (chat_id, server_seq)`
- `messages` FTS on `body_plaintext` where not null
- `chat_members (user_id, last_message_at desc)` for inbox
- `shared_objects (space_id, state, type)` and `(assignee via items)`
- `channel_grants (user_id, chat_id)`

---

## 22. Realtime and API

### 22.1 Transport

- HTTPS JSON API for durable operations (auth required).
- Authenticated WebSocket (or SSE) for hints: `message.created`, `message.edited`, `receipt`, `typing`, `presence`, `call.*`, `object.updated`, `membership.changed`.
- Event payload includes ids + seq, not necessarily full bodies (client fetches if gap).
- After reconnect: `GET /sync?cursor=` catch-up, then resume hints.

### 22.2 Core HTTP (indicative)

```
POST /auth/sign-up | /auth/sign-in | /auth/sign-out | /auth/sessions/:id/revoke
GET  /me  PATCH /me
GET  /users?username=
POST /requests  POST /requests/:id/accept|ignore
POST /chats/direct  POST /chats/groups
GET  /inbox
GET  /chats/:id/messages?after_seq=&before_seq=&limit=
POST /chats/:id/messages          Idempotency-Key header
POST /chats/:id/read
POST /chats/:id/typing
POST /uploads/intent              → { put_url, object_key }
POST /spaces  POST /spaces/:id/channels  POST /spaces/:id/invites
POST /chats/:id/upgrade-to-space
POST /objects  POST /objects/:id/vote|rsvp|items
GET  /updates?stack=needs|happening|decided
POST /calls  POST /calls/:id/token  POST /calls/:id/end
GET  /search?q=&scope=
POST /reports
```

All mutating routes: authn + authz + rate limit. Message POST is transactional: increment `chats.last_seq`, insert message, fan-out hint.

### 22.3 Error contract

JSON `{ error: { code, message } }` with stable codes: `unauthorized`, `forbidden`, `not_found`, `conflict`, `rate_limited`, `validation`. Chat existence for unauthorized users: **404** not 403.

---

## 23. Technical architecture

### 23.1 Target platform (vision)

| Layer | Choice |
|---|---|
| Web / desktop UI | React + TypeScript |
| Desktop shell | Tauri (after web is real) |
| Native local core | Rust + SQLite outbox (desktop/mobile) |
| API | Go modular monolith |
| Durable data | PostgreSQL |
| Ephemeral | Valkey |
| Calls | LiveKit SFU |
| Media | S3-compatible |
| Maps | MapLibre (Phase 2+) |
| Observability | Metrics, structured logs, traces, health |

Start modular, extract realtime / media / search / notify / community fan-out only when they are the bottleneck.

### 23.2 First implementation increment (this engineering phase)

The first ship is a **web vertical slice** of Phases 0–1, not the full Go/Rust/Tauri stack.

| Concern | First increment |
|---|---|
| Client | React + TypeScript web app, desktop 4-pane + mobile nav |
| API / persistence | Server functions + PostgreSQL (same product schema) |
| Auth | Real accounts (email/password or platform auth) |
| Realtime | WebSocket or SSE if available; otherwise polling + optimistic outbox that still uses idempotency keys |
| Calls | LiveKit if keys exist; otherwise a faithful call UI + tokenized room stub clearly labeled, with 1:1 join/leave lifecycle |
| Media | Presigned upload if object storage exists; otherwise constrained in-app storage with the same metadata model |
| E2EE | Client-side encryption for DMs using a password-wrapped vault on this device; multi-device key sync can follow |
| Communities | Not built — no dead nav items |
| Billing | Model the SKU in settings; do not block Phase 1 exit on payments |

The web increment must still obey: guest ACL, outbox semantics, Updates, client-room template, and the IA. A painted mock of Slack is a failed increment.

### 23.3 Consistency rules (any stack)

1. UUIDv7 ids; `server_seq` per chat for order.
2. Idempotency keys on message send and object create.
3. Transactional write of message + seq.
4. Realtime is a hint.
5. Authz on every read.
6. Guests cannot learn hidden channel existence.

---

## 24. Billing (product)

| SKU | Who pays | Includes | Price (target) |
|---|---|---|---|
| Free | — | DMs, groups, 1:1 calls, basic media, requests | $0 |
| Workspace | Operator seats | Spaces, **unlimited guests**, roles, files, search, group calls, Updates | $10 / operator / month |
| Community | Audience owner | Workspace + Communities + moderation + fan-out + paid memberships | $79 / mo + 4% take-rate (0% at $199) |
| Enterprise | IT | SSO, retention, audit export, SLA | Quote — not v1 |

Free must not include Spaces with guests. Free must include excellent DMs.

**v1 engineering:** feature-gate Spaces-with-guests behind “workspace enabled” for the operator org. A development flag may enable it for all demo accounts. Do not fake a Stripe integration as a blocker.

---

## 25. Analytics (instrument, don’t build a warehouse)

Events (no E2EE bodies):

`signed_up`, `request_sent`, `request_accepted`, `message_sent` (chat_kind, has_attach), `call_started`, `call_joined`, `space_created` (template), `guest_invited`, `object_created` (type), `update_opened`, `search_performed`, `upgrade_group_to_space`.

Funnel: signup → first DM → first Space → first guest → first object retrieved from Updates > 7 days later.

---

## 26. Risks

| Risk | Mitigation |
|---|---|
| Building Slack by accident | Guest-free pricing, client-room template, Updates as the home of decisions |
| Building WhatsApp with extra buttons | Phase 0 exit is “would use instead of WhatsApp for this person”, not feature count |
| E2EE delays the wedge | Single-device vault allowed; Spaces remain server-readable |
| Call quality eats the roadmap | Cap 16, LiveKit, no recording; 1:1 first |
| Community fan-out too early | Phase 3 locked until Phase 1 is loved |
| Guest ACL leak | 404 hiding + automated tests as ship blocker |
| Attention fatigue | Default Space notify = mentions + Updates |
| Scope creep (PM, LMS, bots) | Non-goals table is contractual |

---

## 27. Quality bar for implementation

An increment is not done until:

1. Desktop (~1440×900) and mobile (~390×844) both usable; no horizontal overflow on mobile.
2. Keyboard: Enter sends (Shift+Enter newline); ⌘K search on desktop.
3. Composer never loses a draft on pane switch.
4. Guest isolation tests pass.
5. Retrying send cannot duplicate a message.
6. Empty, loading, and error states exist for inbox, transcript, Space home, Updates.
7. Authz failures are 404/401, never a stack trace.
8. No Community, bot, or billing dead-ends in the nav.
9. Brand: SyncUp, forest/ink green, professional messenger — not a generic dashboard.
10. The Phase exit journeys can be demonstrated without a script of lies (no “imagine this is live”).

---

## 28. Glossary

| Term | Meaning |
|---|---|
| Chat | A conversation (direct, group, or channel) |
| Space | Private container of channels + members + guests |
| Channel | A chat owned by a Space |
| Guest | Role with channel-scoped access; free; outsider |
| Operator | Paying member of a Workspace who invites guests |
| Updates | Cross-chat view of polls, events, checklists, pins, live calls |
| Outbox | Local queue of unacked operations |
| Server seq | Per-chat monotonic order assigned by the server |
| Message request | Isolated inbound from a non-contact |
| Client room | Space created from the client template (`#general` + `#internal`) |

---

## 29. Implementation sequence (engineering, after this PRD)

Do not start Communities. Do not start a second client (Tauri/Rust) until the web slice is real.

**Slice A — Shell + identity**  
Auth, profile, 4-pane / mobile nav, empty Chats.

**Slice B — Messaging**  
Direct + groups, outbox, receipts, replies, reactions, search, requests.

**Slice C — Media + 1:1 calls**  
Uploads, gallery, LiveKit (or honest stub).

**Slice D — Spaces + guests**  
Template, roles, ACL tests, invite, Space home.

**Slice E — Objects + Updates**  
Poll, event, checklist, pin, three stacks.

**Slice F — Polish**  
Notifications, upgrade Group → Space, unread math, keyboard, mobile sheets.

Slice A–C = Phase 0. Slice D–F = Phase 1. That is the implementation phase that follows this document.

---

## 30. Sign-off

| Decision | Locked? |
|---|---|
| Wedge = external / client rooms, not “Slack killer” | Yes |
| Channel ⊂ Chat; Community = Space + audience policy | Yes |
| Guests free; operators pay | Yes |
| E2EE personal layer; server-readable Spaces | Yes |
| v1 objects = poll, event, checklist, pin | Yes |
| Communities = Phase 3 | Yes |
| Non-goals table | Yes |
| First engineering increment = web Phase 0→1 | Yes |

**This PRD is complete enough to implement.** Next: Slice A.

---

*End of PRD v1.0*
