ALTER TABLE chats DROP CONSTRAINT chats_kind_check;
ALTER TABLE chats ADD CONSTRAINT chats_kind_check CHECK (kind IN ('direct', 'group', 'channel'));
ALTER TABLE chats DROP CONSTRAINT chats_check;
ALTER TABLE chats ADD CONSTRAINT chats_check CHECK (
    (kind = 'direct' AND direct_user_low IS NOT NULL AND direct_user_high IS NOT NULL
     AND direct_user_low < direct_user_high AND title IS NULL)
    OR (kind = 'group' AND direct_user_low IS NULL AND direct_user_high IS NULL
        AND title IS NOT NULL AND char_length(title) BETWEEN 1 AND 80)
    OR (kind = 'channel' AND direct_user_low IS NULL AND direct_user_high IS NULL
        AND title IS NOT NULL AND char_length(title) BETWEEN 1 AND 80)
);

CREATE TABLE spaces (
    id uuid PRIMARY KEY,
    name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
    template text NOT NULL CHECK (template IN ('client-room')),
    created_by uuid NOT NULL REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE space_members (
    space_id uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role text NOT NULL CHECK (role IN ('owner', 'admin', 'moderator', 'member', 'guest')),
    joined_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (space_id, user_id)
);

CREATE INDEX space_members_user_idx ON space_members (user_id, space_id);

CREATE TABLE space_channels (
    space_id uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    chat_id uuid NOT NULL UNIQUE REFERENCES chats(id) ON DELETE CASCADE,
    name text NOT NULL CHECK (name ~ '^[a-z0-9][a-z0-9-]{0,39}$'),
    channel_type text NOT NULL CHECK (channel_type IN ('discussion', 'announcement', 'private')),
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (space_id, chat_id),
    UNIQUE (space_id, name)
);

CREATE INDEX space_channels_space_idx ON space_channels (space_id, created_at, chat_id);

CREATE TABLE channel_messages (
    id uuid PRIMARY KEY,
    chat_id uuid NOT NULL REFERENCES space_channels(chat_id) ON DELETE CASCADE,
    server_seq bigint NOT NULL CHECK (server_seq > 0),
    sender_id uuid NOT NULL REFERENCES users(id),
    body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 8000),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (chat_id, server_seq)
);

CREATE INDEX channel_messages_timeline_idx ON channel_messages (chat_id, server_seq DESC);
