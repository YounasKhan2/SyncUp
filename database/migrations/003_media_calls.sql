CREATE TABLE calls (
    id uuid PRIMARY KEY,
    chat_id uuid NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    caller_id uuid NOT NULL REFERENCES users(id),
    callee_id uuid NOT NULL REFERENCES users(id),
    sfu_room text NOT NULL UNIQUE,
    call_type text NOT NULL CHECK (call_type IN ('audio', 'video')),
    status text NOT NULL CHECK (status IN ('ringing', 'active', 'declined', 'missed', 'ended')),
    end_reason text CHECK (end_reason IN ('declined', 'cancelled', 'completed', 'missed')),
    created_at timestamptz NOT NULL DEFAULT now(),
    accepted_at timestamptz,
    ended_at timestamptz,
    CHECK (caller_id <> callee_id)
);

CREATE INDEX calls_participant_history_idx
    ON calls (caller_id, created_at DESC);
CREATE INDEX calls_incoming_idx
    ON calls (callee_id, created_at DESC) WHERE status = 'ringing';
CREATE INDEX calls_chat_history_idx
    ON calls (chat_id, created_at DESC);

CREATE TABLE attachments (
    id uuid PRIMARY KEY,
    chat_id uuid NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    uploaded_by uuid NOT NULL REFERENCES users(id),
    object_key text NOT NULL UNIQUE,
    filename text NOT NULL,
    content_type text NOT NULL,
    size_bytes bigint NOT NULL CHECK (size_bytes > 0),
    nonce text NOT NULL,
    key_envelopes jsonb NOT NULL,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready')),
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL
);

CREATE INDEX attachments_uploader_pending_idx
    ON attachments (uploaded_by, created_at DESC) WHERE status = 'pending';

CREATE TABLE message_attachments (
    message_id uuid NOT NULL,
    attachment_id uuid NOT NULL REFERENCES attachments(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (message_id, attachment_id),
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
);
