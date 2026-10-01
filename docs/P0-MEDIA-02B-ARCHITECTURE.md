# P0-MEDIA-02B — Scalable Encrypted Media Architecture Freeze

Status: FROZEN FOR IMPLEMENTATION
Base main: e9f8f161acf1af7822ebfb8786aeaed2b521d0f6
Scope: scalable media transport shared by large video and voice notes without regressing v1 image/file attachments.

## 1. Decision summary

1. Keep the current attachment protocol as media-v1 for existing small images/files and current <=25 MiB video until v2 reaches acceptance.
2. Introduce media-v2 for large video and voice notes. Do not raise the v1 Express body limit.
3. Use one logical Appwrite Storage file per media asset, uploaded with Appwrite's resumable 5 MiB Content-Range protocol. Do not model a 1 GiB video as hundreds of Appwrite files.
4. SyncUp remains the authorization/control plane. Never expose the Appwrite server API key to the browser.
5. The browser encrypts before upload. Appwrite stores ciphertext only.
6. Use AES-256-GCM with one random media key per attachment and independently authenticated encrypted records/chunks. Every encryption operation uses a unique 96-bit IV.
7. Bind attachment id, encryption version, chunk/record index, logical plaintext length and media kind into AES-GCM AAD so records cannot be silently reordered or transplanted.
8. Run large-file crypto and OPFS I/O in dedicated workers. Never read a 1 GiB source into a single ArrayBuffer.
9. Use OPFS for large staged source/ciphertext data and IndexedDB only for upload-job/manifest metadata and small-media cache entries.
10. Ask for persistent browser storage when large-media use justifies it; inspect navigator.storage.estimate() before staging. Storage pressure must produce a recoverable UX, not corruption.
11. The UploadManager is app-scoped, not conversation-scoped. Switching chats/routes must not cancel uploads.
12. Persist upload jobs. Reload/reopen resumes from the last acknowledged byte range when staged source data is recoverable.
13. Background Sync/Periodic Sync are optional enhancements only. They are not correctness dependencies and cannot promise long-running 1 GiB uploads while the browser is closed.
14. User-facing progress is a single monotonic `Sending N%` state. Internal preparing/optimizing/encrypting/uploading/finalizing states remain hidden.
15. Start upload concurrency conservatively and make it adaptive. Target 3-4 in-flight 5 MiB ranges initially; back off on errors/poor networks. Do not hard-code Appwrite's benchmark concurrency as a product invariant.
16. Compression happens before encryption. Never transcode an already efficient source merely to claim compression.
17. Video quality selection and transcoding are out of scope. Videos preserve source bytes and use the 2 GiB source limit.
18. Progressive playback is not assumed from transport chunking. Appwrite upload chunks and MSE media segments are different concepts.
19. P0 large-video acceptance may use full encrypted download -> worker decrypt -> OPFS output -> File/Blob playback when progressive segmented playback is unavailable. Progressive playback is a capability-gated optimization.
20. Voice notes use the same v2 transport, encryption, authorization, cache and hydration architecture.

## 2. Why v2 is separate from current media-v1

Current v1 encrypts the entire File into memory, sends one ciphertext body to Express, buffers that body again server-side, and calls Appwrite with InputFile.fromBuffer(). This is acceptable only for bounded small attachments.

v2 must never have memory complexity O(total file size). Peak memory must be bounded by a small number of chunks plus codec/worker overhead.

Existing v1 messages remain readable forever. No destructive migration is required.

## 3. Logical data model

Extend attachments with versioned media metadata rather than replacing existing columns:

- transport_version: 1 | 2
- media_kind: image | video | voice | file
- encryption_version
- plaintext_size
- ciphertext_size
- chunk_size
- chunk_count
- media_mode: standard | hd | original | null
- duration_ms
- width / height
- poster_attachment_id or poster object metadata
- upload_state
- finalized_at

Add an upload session table:

media_upload_sessions
- id
- attachment_id
- uploaded_by
- appwrite_file_id
- total_ciphertext_bytes
- acknowledged_ranges / resumable cursor representation
- expires_at
- created_at
- updated_at
- finalized_at

Server state is authoritative for what ranges are acknowledged. Client IndexedDB state is a resume hint and UX cache, never authority.

## 4. Encryption record format

Generate one random AES-256 media key K_media per logical attachment.

For each record i:
- plaintext = bounded source bytes
- iv_i = unique 96-bit IV
- aad_i = version || attachmentId || mediaKind || recordIndex || recordCount || plaintextLength
- ciphertext_i = AES-GCM(K_media, iv_i, plaintext, aad_i)

The stored encrypted stream is self-describing/versioned enough to parse records without plaintext access. Each record has fixed-format framing containing version/index/plaintext length/IV/ciphertext length followed by ciphertext+tag.

Do not derive IVs casually from only an index unless the derivation is formally fixed and collision-safe. P0 uses random unique IVs persisted in record framing.

K_media is wrapped using the existing per-recipient envelope model. The server stores envelopes but cannot unwrap them.

Poster/thumbnail media receives its own media key and object so it can hydrate independently of the full video.

## 5. Upload path

select source
-> validate product limits
-> inspect storage quota
-> analyze media
-> optional optimize/remux/transcode
-> stage recoverable source/output in OPFS when required
-> create SyncUp v2 upload intent
-> crypto worker emits bounded encrypted records
-> transport adapter fills Appwrite <=5 MiB upload ranges
-> upload ranges with bounded parallelism
-> persist acknowledgements
-> retry failed ranges with exponential backoff+jitter
-> finalize with SyncUp
-> server verifies Appwrite object metadata and expected logical manifest
-> attachment becomes ready
-> message references ready attachment

The API never buffers the full object.

## 6. Appwrite boundary

Use Appwrite's native resumable Content-Range upload protocol for the single ciphertext object.

Preferred authorization shape:
- SyncUp creates/authorizes a v2 upload session.
- Browser obtains only narrowly scoped, short-lived capability material needed for that upload path if a safe Appwrite-supported mechanism is available.
- If direct client authorization cannot be made compatible with SyncUp-only identity without adding a second auth system, use a bounded streaming/chunk relay endpoint as the initial adapter. The relay accepts one <=5 MiB range at a time and forwards it; it must never buffer the entire asset.
- Appwrite server API keys stay server-only.

This adapter boundary is intentional so direct storage delivery can replace relay delivery later without changing MediaUploadManager or encryption format.

## 7. Local persistence

IndexedDB:
- upload job state
- attachment/message/chat ids
- source fingerprint metadata
- completed/acknowledged ranges
- encryption manifest metadata
- progress
- timestamps
- small encrypted cache entries

OPFS:
- large staged source when necessary
- optimized/transcoded output
- large encrypted/decrypted temporary media
- resumable working files

Use a dedicated worker with FileSystemSyncAccessHandle where supported.

On startup:
1. load incomplete jobs
2. reconcile with server upload session
3. verify staged source availability/fingerprint
4. resume automatically when safe
5. otherwise ask the user to reselect the same source
6. explicit cancel cleans server session + OPFS staging

## 8. Upload lifecycle

Internal states:
queued -> preparing -> optimizing? -> encrypting/uploading -> finalizing -> complete
plus paused_offline, paused_user, retrying, failed_recoverable, cancelled.

Public states:
Sending N%
Sent
Failed — Retry

Progress is weighted and monotonic. It never jumps backwards when internal phases change.

Switching chat, opening settings or minimizing the window must not cancel the job. Browser suspension/closure pauses work and resume occurs on the next eligible app execution; no false background guarantee.

## 9. Video policy

Product source limits after scale acceptance:
- Video: up to 2 GiB source, preserving original bytes
- rollout begins at smaller server-configurable limits and graduates through 100 MiB, 500 MiB, 1 GiB tests.

Inspect:
- container
- codecs
- resolution
- frame rate
- duration
- bitrate
- source size
- orientation

Rules:
- preserve original source bytes; do not offer quality modes or transcode
- inspect metadata for playback dimensions and duration

Playback compatibility is determined by the source codec and browser support; unsupported source formats fail with a clear playback error.

## 10. Playback

Poster is a separate encrypted small asset and hydrates lazily.
The sending browser may play its original selected File from a bounded in-memory cache; remote clients load only the encrypted poster until the user opens the video.

Historical video:
message metadata -> poster -> user presses play -> fetch encrypted media -> decrypt in bounded worker pipeline.

Fallback P0 playback:
encrypted download -> OPFS -> bounded decrypt -> OPFS playable output -> File/Blob URL -> native video element.

Progressive path is enabled only for media prepared in a segmentable format supported by the runtime. Arbitrary transport chunks must never be appended directly to MediaSource.

Never auto-download full historical videos.

## 11. Voice notes

Capture with getUserMedia + MediaRecorder.

At runtime probe MediaRecorder.isTypeSupported() and choose a supported codec/container. Do not hard-code WebM/Opus as universally available.

Recorder emits periodic blobs so waveform/progress and memory remain bounded.

Voice metadata:
- duration_ms
- waveform peaks (normalized compact array)
- recording MIME/codec
- plaintext/ciphertext sizes
- encryption/transport version

UX:
idle mic -> recording -> pause/resume -> preview -> delete/send
sent note -> play/pause, scrubber/waveform, duration, playback speed later if desired.

Voice bytes use media-v2 and are encrypted before storage. Waveform metadata must not expose message content beyond the explicitly accepted metadata policy.

## 12. Cache policy

Do not expand the current 128 MiB IndexedDB blob cache into a multi-GiB cache.

Small media may remain in the existing encrypted IndexedDB LRU initially.

Large media cache:
- OPFS encrypted assets/segments
- LRU metadata in IndexedDB
- quota-aware target derived from navigator.storage.estimate()
- posters prioritized over full videos
- active/recent media prioritized
- explicit cleanup on logout/account removal where appropriate

Plaintext media is ephemeral. Persistent cache is ciphertext unless a narrowly scoped temporary playback file is required; temporary plaintext OPFS files are deleted after use/session according to the playback implementation.

## 13. Failure/security rules

Reject:
- unauthorized upload-session access
- chat membership loss
- mismatched attachment/upload ownership
- invalid range
- overlapping/conflicting range
- declared-size overflow
- unsupported media type/mode
- invalid record framing
- GCM authentication failure
- reordered/substituted record
- finalize before complete
- stale/expired session

Use idempotent range retry and idempotent finalize.

Rate-limit intent/session/finalize endpoints separately from byte-range traffic. Byte traffic needs bandwidth/concurrency controls rather than a naive 20-requests/minute limiter.

Clean orphaned pending uploads and OPFS staging by TTL.

## 14. Web background truth

Service workers and Background Sync are not a guarantee that a long video continues uploading after the browser closes. SyncUp promises durable resume, not impossible continuous web execution.

Optional Background Sync can retry short pending work where supported. Background Fetch may be investigated separately but is not required for v2 correctness.

## 15. Acceptance ladder

A. Protocol correctness
- 5 MiB+
- multi-record AES-GCM
- tamper/reorder rejection
- retry same range safely
- cancel/cleanup

B. Durability
- switch chat
- switch route
- offline/online
- reload
- browser restart/reopen
- recover from stale client state by server reconciliation
- reselect-same-file fallback where OPFS/source recovery unavailable

C. Scale
- 100 MiB
- 500 MiB
- 1 GiB scale-ladder target; videos may be sent up to the 2 GiB source limit
- memory remains bounded
- UI remains responsive
- bounded concurrency/backoff works

D. Media
- poster hydration
- play/seek/fullscreen/download
- mixed image/video viewer
- no historical full-video auto-download
- preserve video source quality without a quality selector

E. Voice
- record/pause/resume/preview/delete/send
- reload hydration
- playback/scrub
- waveform/duration
- codec fallback
- offline/retry behavior

## 16. Implementation slices

MEDIA-V2-01 — protocol + DB migration + upload-session API
MEDIA-V2-02 — worker crypto record format + test vectors
MEDIA-V2-03 — OPFS staging + IndexedDB job store
MEDIA-V2-04 — app-scoped UploadManager + resume/reconcile
MEDIA-V2-05 — Appwrite resumable transport adapter
MEDIA-V2-06 — video metadata inspection and poster
MEDIA-V2-07 — large-video hydration/playback/cache
MEDIA-V2-08 — voice recorder/player on shared media-v2
MEDIA-V2-09 — scale/failure/security acceptance

Do not start Phase 1 until Phase 0 golden-flow acceptance passes.
