CREATE TABLE group_calls (
    id uuid PRIMARY KEY,
    chat_id uuid NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    started_by uuid NOT NULL REFERENCES users(id),
    sfu_room text NOT NULL UNIQUE,
    call_type text NOT NULL CHECK (call_type IN ('audio', 'video')),
    status text NOT NULL CHECK (status IN ('active', 'ended')),
    end_reason text CHECK (end_reason IN ('completed', 'membership_changed')),
    created_at timestamptz NOT NULL DEFAULT now(),
    ended_at timestamptz
);

CREATE UNIQUE INDEX group_calls_one_active_per_chat_idx
    ON group_calls (chat_id) WHERE status = 'active';
CREATE INDEX group_calls_history_idx
    ON group_calls (chat_id, created_at DESC);

CREATE TABLE group_call_participants (
    call_id uuid NOT NULL REFERENCES group_calls(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users(id),
    status text NOT NULL CHECK (status IN ('ringing', 'joined', 'declined', 'missed', 'left')),
    key_envelope text NOT NULL,
    invited_at timestamptz NOT NULL DEFAULT now(),
    joined_at timestamptz,
    left_at timestamptz,
    PRIMARY KEY (call_id, user_id)
);

CREATE INDEX group_call_participant_incoming_idx
    ON group_call_participants (user_id, invited_at DESC) WHERE status = 'ringing';
