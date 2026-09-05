-- ********************************************************************************
-- This script creates the database users and grants them the necessary permissions
-- ********************************************************************************
--
-- The passwords are supplied when the script is run rather than written down
-- here. psql substitutes :'var' as a quoted literal:
--
--   psql -d final_capstone \
--        -v owner_pw="$DB_OWNER_PASSWORD" \
--        -v app_pw="$DB_PASSWORD" \
--        -f user.sql
--
-- This file used to carry the password inline, and the same value was in the
-- README, the Spring properties and the integration test -- so changing it in
-- one place changed nothing.

CREATE USER final_capstone_owner
WITH PASSWORD :'owner_pw';

GRANT ALL
ON ALL TABLES IN SCHEMA public
TO final_capstone_owner;

GRANT ALL
ON ALL SEQUENCES IN SCHEMA public
TO final_capstone_owner;

CREATE USER final_capstone_appuser
WITH PASSWORD :'app_pw';

GRANT SELECT, INSERT, UPDATE, DELETE
ON ALL TABLES IN SCHEMA public
TO final_capstone_appuser;

GRANT USAGE, SELECT
ON ALL SEQUENCES IN SCHEMA public
TO final_capstone_appuser;
