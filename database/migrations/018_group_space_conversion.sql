ALTER TABLE spaces
    ADD COLUMN converted_from_group boolean NOT NULL DEFAULT false;

CREATE TABLE space_conversion_members (
    space_id uuid NOT NULL,
    chat_id uuid NOT NULL,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    converted_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (chat_id, user_id),
    FOREIGN KEY (space_id, chat_id)
        REFERENCES space_channels(space_id, chat_id) ON DELETE CASCADE,
    FOREIGN KEY (space_id, user_id)
        REFERENCES space_members(space_id, user_id) ON DELETE CASCADE
);

CREATE INDEX space_conversion_members_space_idx
    ON space_conversion_members (space_id, user_id);
