-- Auto-create the test database for pytest.
-- Runs once on first container initialisation via docker-entrypoint-initdb.d.
-- The main "surreynest" DB is created by POSTGRES_DB env var; this adds the test DB.

SELECT 'CREATE DATABASE surreynest_test OWNER surreynest'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'surreynest_test')\gexec
