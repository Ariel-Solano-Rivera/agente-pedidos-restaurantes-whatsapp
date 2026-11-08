-- Keep an explicit encoder id so the storage format remains upgradeable.
UPDATE app_user SET password_hash = '{bcrypt}' || password_hash
WHERE password_hash NOT LIKE '{%}%';
