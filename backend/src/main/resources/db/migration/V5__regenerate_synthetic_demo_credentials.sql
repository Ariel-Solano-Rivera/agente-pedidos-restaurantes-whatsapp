-- Credentials are synthetic and exist only so the reproducible local demo can be exercised.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
UPDATE app_user
SET password_hash = '{bcrypt}' || crypt('password', gen_salt('bf', 10));
