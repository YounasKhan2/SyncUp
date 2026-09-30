ALTER TABLE attachments
  ADD COLUMN IF NOT EXISTS waveform jsonb;

ALTER TABLE attachments
  ADD CONSTRAINT attachments_waveform_array_check
  CHECK (waveform IS NULL OR jsonb_typeof(waveform) = 'array') NOT VALID;
