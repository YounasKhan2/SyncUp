CREATE TABLE users (
    id uuid PRIMARY KEY,
    email text NOT NULL,
    username text NOT NULL,
    display_name text NOT NULL,
    password_hash text NOT NULL,
    avatar_url text,
    about text NOT NULL DEFAULT '',
    discoverable boolean NOT NULL DEFAULT true,
    last_seen_at timestamptz,
    last_seen_visible boolean NOT NULL DEFAULT true,
    read_receipts_enabled boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CONSTRAINT users_email_lowercase CHECK (email = lower(email)),
    CONSTRAINT users_username_lowercase CHECK (username = lower(username))
);

CREATE UNIQUE INDEX users_email_unique ON users (email) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX users_username_unique ON users (username) WHERE deleted_at IS NULL;

CREATE TABLE devices (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name text NOT NULL,
    platform text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id uuid REFERENCES devices(id) ON DELETE SET NULL,
    refresh_family uuid NOT NULL,
    token_hash char(64) NOT NULL UNIQUE,
    user_agent text NOT NULL DEFAULT '',
    ip_region text,
    created_at timestamptz NOT NULL DEFAULT now(),
    last_active_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL,
    revoked_at timestamptz
);

CREATE INDEX sessions_user_active_idx ON sessions (user_id, last_active_at DESC)
    WHERE revoked_at IS NULL;

CREATE TABLE session_refresh_tokens (
    token_hash char(64) PRIMARY KEY,
    session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    used_at timestamptz
);

CREATE INDEX session_refresh_tokens_session_idx ON session_refresh_tokens (session_id);

CREATE TABLE security_events (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id),
    type text NOT NULL,
    meta jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX security_events_user_created_idx ON security_events (user_id, created_at DESC);
