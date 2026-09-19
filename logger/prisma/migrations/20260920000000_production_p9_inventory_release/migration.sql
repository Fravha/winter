INSERT INTO permissions (id, code, name, description, created_at, updated_at)
VALUES (gen_random_uuid(), 'production:inventory_release', 'Release production to inventory', 'Release production batches into inventory', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (code) DO NOTHING;