-- BCryptPasswordEncoder expects the raw BCrypt hash; the encoder prefix is not used here.
UPDATE app_user SET password_hash = replace(password_hash, '{bcrypt}', '')
WHERE password_hash LIKE '{bcrypt}%';
