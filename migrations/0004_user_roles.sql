ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user';
UPDATE users
   SET role = 'admin'
 WHERE lower(email) = lower('howardtseng0828@gmail.com');
