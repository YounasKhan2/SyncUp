CREATE TABLE channel_shared_objects (
    id uuid PRIMARY KEY,
    chat_id uuid NOT NULL REFERENCES space_channels(chat_id) ON DELETE CASCADE,
    message_id uuid NOT NULL UNIQUE REFERENCES channel_messages(id) ON DELETE CASCADE,
    object_type text NOT NULL CHECK (object_type IN ('poll', 'event', 'checklist', 'decision')),
    title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 240),
    state text NOT NULL CHECK (state IN ('open', 'scheduled', 'active', 'completed', 'closed', 'cancelled', 'ended', 'unpinned')),
    payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
    created_by uuid NOT NULL REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    terminal_at timestamptz
);

CREATE INDEX channel_shared_objects_timeline_idx
    ON channel_shared_objects (chat_id, created_at DESC);

CREATE INDEX channel_shared_objects_state_idx
    ON channel_shared_objects (object_type, state, updated_at DESC);

CREATE TABLE channel_shared_object_responses (
    object_id uuid NOT NULL REFERENCES channel_shared_objects(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    response jsonb NOT NULL CHECK (jsonb_typeof(response) = 'object'),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (object_id, user_id)
);

CREATE INDEX channel_shared_object_responses_user_idx
    ON channel_shared_object_responses (user_id, updated_at DESC);
