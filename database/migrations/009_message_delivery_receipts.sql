CREATE TABLE message_device_deliveries (
    message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    device_id uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    delivered_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (message_id, device_id)
);

CREATE INDEX message_device_deliveries_device_idx
    ON message_device_deliveries (device_id, delivered_at DESC);
