ALTER TABLE attachments
  ADD COLUMN IF NOT EXISTS poster_attachment_id uuid REFERENCES attachments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS attachments_poster_idx
  ON attachments (poster_attachment_id)
  WHERE poster_attachment_id IS NOT NULL;
