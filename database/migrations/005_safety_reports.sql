CREATE TABLE safety_reports (
    id uuid PRIMARY KEY,
    reporter_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reported_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    message_id uuid REFERENCES messages(id) ON DELETE SET NULL,
    reason text NOT NULL CHECK (reason IN (
        'spam', 'harassment', 'threats', 'inappropriate_content', 'impersonation', 'other'
    )),
    details text NOT NULL DEFAULT '' CHECK (char_length(details) <= 1000),
    status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'resolved', 'dismissed')),
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (reported_user_id IS NOT NULL OR message_id IS NOT NULL),
    CHECK (reported_user_id IS NULL OR reporter_id <> reported_user_id)
);

CREATE INDEX safety_reports_review_idx
    ON safety_reports (status, created_at ASC);
