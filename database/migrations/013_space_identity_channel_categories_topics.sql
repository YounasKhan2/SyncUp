ALTER TABLE spaces
    ADD COLUMN description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 280),
    ADD COLUMN icon text NOT NULL DEFAULT 'layers'
        CHECK (icon IN ('layers', 'briefcase', 'rocket', 'heart', 'sparkles'));

CREATE TABLE space_channel_categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    space_id uuid NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
    name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 40),
    created_by uuid NOT NULL REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (space_id, name),
    UNIQUE (space_id, id)
);

ALTER TABLE space_channels
    ADD COLUMN category_id uuid,
    ADD COLUMN topic text NOT NULL DEFAULT '' CHECK (char_length(topic) <= 160);

INSERT INTO space_channel_categories (space_id, name, created_by)
SELECT id, 'Text Channels', created_by FROM spaces;

UPDATE space_channels channel
SET category_id = category.id
FROM space_channel_categories category
WHERE category.space_id = channel.space_id
  AND category.name = 'Text Channels';

ALTER TABLE space_channels
    ALTER COLUMN category_id SET NOT NULL,
    ADD CONSTRAINT space_channels_category_fk
        FOREIGN KEY (space_id, category_id)
        REFERENCES space_channel_categories(space_id, id)
        ON DELETE CASCADE;

CREATE INDEX space_channel_categories_space_idx
    ON space_channel_categories (space_id, created_at, id);
