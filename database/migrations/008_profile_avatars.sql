ALTER TABLE users
    ADD COLUMN avatar_file_id text;

ALTER TABLE users
    ADD COLUMN avatar_content_type text;

ALTER TABLE users
    ADD CONSTRAINT users_avatar_file_id_length
    CHECK (avatar_file_id IS NULL OR length(avatar_file_id) BETWEEN 1 AND 36);

ALTER TABLE users
    ADD CONSTRAINT users_avatar_metadata_complete
    CHECK (
        (avatar_file_id IS NULL AND avatar_content_type IS NULL)
        OR
        (avatar_file_id IS NOT NULL AND avatar_content_type IN ('image/jpeg', 'image/png', 'image/webp')
            AND avatar_url IS NOT NULL)
    );
