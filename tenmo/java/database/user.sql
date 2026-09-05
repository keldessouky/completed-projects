-- ********************************************************************************
-- This script creates the database users and grants them the necessary permissions
-- ********************************************************************************
--
-- The passwords are supplied when the script is run rather than written down
-- here. psql substitutes :'var' as a quoted literal:
--
--   psql -d tenmo \
--        -v owner_pw="$DB_OWNER_PASSWORD" \
--        -v app_pw="$DB_PASSWORD" \
--        -f user.sql

CREATE USER tenmo_owner
WITH PASSWORD :'owner_pw';

GRANT ALL
ON ALL TABLES IN SCHEMA public
TO tenmo_owner;

GRANT ALL
ON ALL SEQUENCES IN SCHEMA public
TO tenmo_owner;

CREATE USER tenmo_appuser
WITH PASSWORD :'app_pw';

GRANT SELECT, INSERT, UPDATE, DELETE
ON ALL TABLES IN SCHEMA public
TO tenmo_appuser;

GRANT USAGE, SELECT
ON ALL SEQUENCES IN SCHEMA public
TO tenmo_appuser;
