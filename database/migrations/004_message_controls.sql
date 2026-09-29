CREATE TABLE message_user_states (
    message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    hidden_at timestamptz,
    pinned_at timestamptz,
    PRIMARY KEY (message_id, user_id)
);

CREATE INDEX message_user_states_pinned_idx
    ON message_user_states (user_id, pinned_at DESC)
    WHERE pinned_at IS NOT NULL;
