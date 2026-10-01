CREATE TABLE space_channel_role_permissions (
    space_id uuid NOT NULL,
    chat_id uuid NOT NULL,
    role text NOT NULL CHECK (role IN ('moderator', 'member', 'guest')),
    can_view boolean NOT NULL DEFAULT true,
    can_send boolean NOT NULL DEFAULT true,
    updated_by uuid NOT NULL REFERENCES users(id),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (space_id, chat_id, role),
    FOREIGN KEY (space_id, chat_id)
        REFERENCES space_channels(space_id, chat_id)
        ON DELETE CASCADE
);

INSERT INTO space_channel_role_permissions (space_id, chat_id, role, can_view, can_send, updated_by)
SELECT channel.space_id, channel.chat_id, role.role, true,
       channel.channel_type <> 'announcement' OR role.role = 'moderator',
       space.created_by
FROM space_channels channel
JOIN spaces space ON space.id = channel.space_id
CROSS JOIN (VALUES ('moderator'), ('member'), ('guest')) AS role(role);
