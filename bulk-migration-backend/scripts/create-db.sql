-- Create database
CREATE DATABASE bulk_migration;

-- Connect to the database
\c bulk_migration;

-- The tables will be created automatically by the application
-- This script is just for reference

/*
Tables created by the application:

1. connections - Stores database connection configurations
2. migrations - Stores migration execution records
3. migration_logs - Stores detailed logs for each migration
*/

-- Create a read-only user for reports (optional)
CREATE USER bulk_migration_reader WITH PASSWORD 'reader123';
GRANT CONNECT ON DATABASE bulk_migration TO bulk_migration_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO bulk_migration_reader;