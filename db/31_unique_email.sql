-- =====================================================================
-- Zirclaire — 31_unique_email.sql
-- Enforce one profile per email address at the database level (case-insensitive)
-- so two accounts can never share an address, regardless of the app path.
--
-- If this errors on creation, an existing duplicate email must be resolved
-- first: select lower(email), count(*) from profiles group by 1 having count(*) > 1;
-- =====================================================================

create unique index if not exists profiles_email_lower_unique on profiles (lower(email));
