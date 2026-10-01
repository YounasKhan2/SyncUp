ALTER TABLE messages
    ADD COLUMN pinned_at timestamptz,
    ADD COLUMN pinned_by uuid REFERENCES users(id) ON DELETE SET NULL;

WITH existing_pins AS (
    SELECT DISTINCT ON (message_id) message_id, user_id, pinned_at
    FROM message_user_states
    WHERE pinned_at IS NOT NULL
    ORDER BY message_id, pinned_at DESC, user_id
)
UPDATE messages AS message
SET pinned_at = existing_pins.pinned_at,
    pinned_by = existing_pins.user_id
FROM existing_pins
WHERE message.id = existing_pins.message_id;

ALTER TABLE message_user_states
    DROP COLUMN pinned_at;

CREATE INDEX messages_pinned_idx
    ON messages (chat_id, pinned_at DESC)
    WHERE pinned_at IS NOT NULL;
