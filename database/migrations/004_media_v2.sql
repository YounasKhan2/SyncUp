ALTER TABLE attachments
  ADD COLUMN transport_version smallint NOT NULL DEFAULT 1 CHECK (transport_version IN (1, 2)),
  ADD COLUMN media_kind text CHECK (media_kind IN ('image', 'video', 'voice', 'file')),
  ADD COLUMN encryption_version smallint NOT NULL DEFAULT 1 CHECK (encryption_version > 0),
  ADD COLUMN plaintext_size bigint CHECK (plaintext_size > 0),
  ADD COLUMN ciphertext_size bigint CHECK (ciphertext_size > 0),
  ADD COLUMN chunk_size integer CHECK (chunk_size > 0),
  ADD COLUMN chunk_count integer CHECK (chunk_count > 0),
  ADD COLUMN media_mode text CHECK (media_mode IN ('standard', 'hd', 'original')),
  ADD COLUMN duration_ms integer CHECK (duration_ms >= 0),
  ADD COLUMN width integer CHECK (width > 0),
  ADD COLUMN height integer CHECK (height > 0),
  ADD COLUMN finalized_at timestamptz;

ALTER TABLE attachments ALTER COLUMN nonce DROP NOT NULL;

UPDATE attachments
SET media_kind = CASE
  WHEN content_type LIKE 'image/%' THEN 'image'
  WHEN content_type LIKE 'video/%' THEN 'video'
  ELSE 'file'
END,
plaintext_size = size_bytes,
ciphertext_size = size_bytes + 16
WHERE transport_version = 1;

CREATE TABLE media_upload_sessions (
  id uuid PRIMARY KEY,
  attachment_id uuid NOT NULL UNIQUE REFERENCES attachments(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  appwrite_file_id text NOT NULL UNIQUE,
  total_ciphertext_bytes bigint NOT NULL CHECK (total_ciphertext_bytes > 0),
  acknowledged_bytes bigint NOT NULL DEFAULT 0 CHECK (acknowledged_bytes >= 0),
  state text NOT NULL DEFAULT 'active'
    CHECK (state IN ('active', 'finalizing', 'completed', 'cancelled', 'expired')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  finalized_at timestamptz,
  CHECK (acknowledged_bytes <= total_ciphertext_bytes)
);

CREATE INDEX media_upload_sessions_owner_active_idx
  ON media_upload_sessions (uploaded_by, updated_at DESC)
  WHERE state IN ('active', 'finalizing');

CREATE INDEX media_upload_sessions_expiry_idx
  ON media_upload_sessions (expires_at)
  WHERE state = 'active';
