ALTER TABLE space_channels
    DROP CONSTRAINT space_channels_channel_type_check,
    ADD CONSTRAINT space_channels_channel_type_check
        CHECK (channel_type IN ('discussion', 'announcement', 'private', 'voice'));

ALTER TABLE space_channel_role_permissions
    ADD COLUMN can_speak boolean NOT NULL DEFAULT true;

CREATE TABLE channel_message_mentions (
    message_id uuid NOT NULL REFERENCES channel_messages(id) ON DELETE CASCADE,
    mentioned_user_id uuid REFERENCES users(id) ON DELETE CASCADE,
    is_everyone boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK ((is_everyone AND mentioned_user_id IS NULL)
        OR (NOT is_everyone AND mentioned_user_id IS NOT NULL))
);

CREATE UNIQUE INDEX channel_message_mentions_user_idx
    ON channel_message_mentions (message_id, mentioned_user_id)
    WHERE mentioned_user_id IS NOT NULL;

CREATE UNIQUE INDEX channel_message_mentions_everyone_idx
    ON channel_message_mentions (message_id)
    WHERE is_everyone;

CREATE INDEX channel_message_mentions_recipient_idx
    ON channel_message_mentions (mentioned_user_id, created_at DESC)
    WHERE mentioned_user_id IS NOT NULL;
