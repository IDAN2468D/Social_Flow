SELECT 'CREATE DATABASE post_db' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'post_db')\gexec
SELECT 'CREATE DATABASE feed_db' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'feed_db')\gexec
SELECT 'CREATE DATABASE user_db' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'user_db')\gexec
SELECT 'CREATE DATABASE notification_db' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'notification_db')\gexec
