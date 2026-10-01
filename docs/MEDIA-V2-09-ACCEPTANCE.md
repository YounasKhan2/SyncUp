# MEDIA-V2-09 acceptance gate

This gate must pass before SyncUp claims large-media Phase 0 complete.

## Automated
Run:
- `npm run typecheck`
- `npm run test:media-v2`
- `npm run test:integration`

Required:
- authenticated record round-trip passes for video and voice
- tamper, attachment substitution, record reorder, malformed framing fail closed
- manifest math passes for 100 MiB, 500 MiB and 1 GiB
- Videos are sent without quality selection or transcoding; source limit is 2 GiB
- voice source limit is 256 MiB

## Live browser + Appwrite scale ladder
Run in order. Do not skip directly to 1 GiB.

### 100 MiB
Send an MP4 without a quality prompt. Confirm:
- the encrypted poster thumbnail is visible to sender and recipient
- opening the conversation does not download the full video
- receiver sees Download to play, receives progress, and can play after local hydration
- UI stays responsive during preparation and send
- only Preparing / Sending N% / Sent / Couldn't send is exposed
- switching chats does not stop the send
- receiver can play fullscreen after download and separately save the video from the viewer
- sender opens the exact original selected file without downloading it again
- a reload after completion reuses the local playable copy

### 500 MiB
Repeat, then:
- go offline after at least two acknowledged ranges
- return online and confirm progress resumes instead of restarting
- reload the page mid-send and confirm server acknowledgement is reconciled
- cancel a second send and confirm it never becomes a ready attachment

### 1 GiB
Repeat the 500 MiB cases and capture browser memory before preparation, during record processing, during upload and during receiver hydration. Memory must remain bounded by the record/range pipeline rather than scale with the whole file.

## Failure/security
- non-member metadata/download -> 404
- pending/ignored message-request recipient cannot fetch media
- wrong uploader cannot read/cancel upload session
- out-of-order/overlapping upload range -> 409 with authoritative acknowledgement
- range > 5 MiB -> 413
- finalize before all bytes -> 409
- storage-size mismatch -> 409 and attachment remains pending
- corrupted record -> playback fails; no partial plaintext file remains
- wrong attachment id / reordered record -> authenticated open fails
- expired/cancelled session cannot resume

## Voice regression
- record, pause, resume, preview, delete
- record and send
- switch chats while sending
- reload/recover an interrupted send
- receiver play/pause
- browser codec fallback is exercised on at least Chromium plus one WebKit/Firefox-class browser where available

## Exit
Do not mark MEDIA-V2 complete until automated checks pass and the 100 MiB -> 500 MiB -> 1 GiB live ladder has been recorded as passing.
