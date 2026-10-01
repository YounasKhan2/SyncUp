CREATE TABLE channel_files (
    id uuid PRIMARY KEY,
    chat_id uuid NOT NULL REFERENCES space_channels(chat_id) ON DELETE CASCADE,
    uploaded_by uuid NOT NULL REFERENCES users(id),
    object_key text NOT NULL UNIQUE,
    filename text NOT NULL CHECK (char_length(filename) BETWEEN 1 AND 200),
    content_type text NOT NULL CHECK (char_length(content_type) BETWEEN 1 AND 120),
    size_bytes bigint NOT NULL CHECK (size_bytes > 0),
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready')),
    uploaded_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL
);

CREATE INDEX channel_files_timeline_idx
    ON channel_files (chat_id, created_at DESC)
    WHERE status = 'ready';

CREATE INDEX channel_files_search_idx
    ON channel_files (chat_id, lower(filename))
    WHERE status = 'ready';
