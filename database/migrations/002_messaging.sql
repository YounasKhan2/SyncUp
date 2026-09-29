ALTER TABLE users
    ADD COLUMN encryption_public_key jsonb,
    ADD COLUMN encrypted_private_key text,
    ADD COLUMN private_key_iv text,
    ADD COLUMN key_vault_salt text,
    ADD COLUMN encryption_key_version smallint;

CREATE TABLE contacts (
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contact_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    state text NOT NULL CHECK (state IN ('accepted', 'blocked')),
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, contact_id),
    CHECK (user_id <> contact_id)
);

CREATE INDEX contacts_contact_user_idx ON contacts (contact_id, user_id);

CREATE TABLE chats (
    id uuid PRIMARY KEY,
    kind text NOT NULL CHECK (kind IN ('direct', 'group')),
    title text,
    created_by uuid NOT NULL REFERENCES users(id),
    direct_user_low uuid REFERENCES users(id),
    direct_user_high uuid REFERENCES users(id),
    last_seq bigint NOT NULL DEFAULT 0 CHECK (last_seq >= 0),
    last_message_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (
        (kind = 'direct' AND direct_user_low IS NOT NULL AND direct_user_high IS NOT NULL
         AND direct_user_low < direct_user_high AND title IS NULL)
        OR (kind = 'group' AND direct_user_low IS NULL AND direct_user_high IS NULL
            AND title IS NOT NULL AND char_length(title) BETWEEN 1 AND 80)
    )
);

CREATE UNIQUE INDEX chats_direct_pair_unique
    ON chats (direct_user_low, direct_user_high) WHERE kind = 'direct';

CREATE TABLE chat_members (
    chat_id uuid NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role text NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
    last_read_seq bigint NOT NULL DEFAULT 0 CHECK (last_read_seq >= 0),
    joined_at timestamptz NOT NULL DEFAULT now(),
    left_at timestamptz,
    PRIMARY KEY (chat_id, user_id, joined_at)
);

CREATE UNIQUE INDEX chat_members_active_unique
    ON chat_members (chat_id, user_id) WHERE left_at IS NULL;
CREATE INDEX chat_members_user_chat_idx
    ON chat_members (user_id, chat_id) WHERE left_at IS NULL;

CREATE TABLE message_requests (
    id uuid PRIMARY KEY,
    chat_id uuid NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    from_user uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    to_user uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'accepted', 'ignored')),
    created_at timestamptz NOT NULL DEFAULT now(),
    resolved_at timestamptz,
    CHECK (from_user <> to_user)
);

CREATE UNIQUE INDEX message_requests_one_pending_pair
    ON message_requests (from_user, to_user) WHERE state = 'pending';
CREATE INDEX message_requests_inbox_idx
    ON message_requests (to_user, created_at DESC) WHERE state = 'pending';

CREATE TABLE messages (
    id uuid PRIMARY KEY,
    chat_id uuid NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    server_seq bigint NOT NULL CHECK (server_seq > 0),
    sender_id uuid NOT NULL REFERENCES users(id),
    idempotency_key uuid NOT NULL,
    body_ciphertext text NOT NULL,
    body_nonce text NOT NULL,
    key_envelopes jsonb NOT NULL,
    reply_to_id uuid,
    edited_at timestamptz,
    deleted_at timestamptz,
    deleted_for text CHECK (deleted_for IN ('sender', 'all')),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (chat_id, id),
    UNIQUE (chat_id, server_seq),
    UNIQUE (sender_id, idempotency_key),
    FOREIGN KEY (chat_id, reply_to_id) REFERENCES messages(chat_id, id)
);

CREATE INDEX messages_chat_timeline_idx ON messages (chat_id, server_seq DESC);
CREATE INDEX messages_sender_idempotency_idx ON messages (sender_id, idempotency_key);

CREATE FUNCTION notify_chat_message_insert() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM pg_notify(
        'syncup_chat_messages',
        json_build_object('chatId', NEW.chat_id, 'serverSeq', NEW.server_seq)::text
    );
    RETURN NEW;
END;
$$;

CREATE TRIGGER messages_realtime_hint
    AFTER INSERT ON messages
    FOR EACH ROW EXECUTE FUNCTION notify_chat_message_insert();

CREATE TABLE message_reactions (
    message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji text NOT NULL CHECK (char_length(emoji) BETWEEN 1 AND 16),
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (message_id, user_id, emoji)
);

CREATE TABLE sync_cursors (
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    chat_id uuid NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    last_seq bigint NOT NULL DEFAULT 0 CHECK (last_seq >= 0),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, device_id, chat_id)
);
