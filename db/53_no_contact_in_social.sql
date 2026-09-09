-- =====================================================================
-- Zirclaire — 53_no_contact_in_social.sql
-- Keep deals on-platform: block links and phone numbers in the community
-- (posts and comments), for everyone. Enforced at the database so it can't be
-- bypassed by a direct client insert. The AI flagger stays as a second layer.
-- Run any time after 06_social.sql.
-- =====================================================================

create or replace function reject_contact_info()
returns trigger language plpgsql as $$
declare
  txt text := coalesce(new.body, '');
begin
  -- Links: explicit URLs, www., or a bare domain with a common TLD.
  if txt ~* '(https?://|www\.)' then
    raise exception 'Links aren''t allowed in the community — keep conversations on Zirclaire.'
      using errcode = 'check_violation';
  end if;
  if txt ~* '[[:alnum:]_-]+\.(com|net|org|io|co|me|ly|app|xyz|info|biz|gg|link|site|shop|store|my|dev|online|ai|us|uk|in)(/|\?|\y)' then
    raise exception 'Links aren''t allowed in the community — keep conversations on Zirclaire.'
      using errcode = 'check_violation';
  end if;

  -- Phone numbers: any digit/separator token that contains 8+ digits.
  if exists (
    select 1
    from regexp_matches(txt, '[+(]?\d[\d\s().+-]{6,}\d', 'g') as m
    where length(regexp_replace(m[1], '[^0-9]', '', 'g')) >= 8
  ) then
    raise exception 'Phone numbers aren''t allowed in the community — keep contact on Zirclaire.'
      using errcode = 'check_violation';
  end if;

  return new;
end; $$;

drop trigger if exists trg_posts_no_contact on posts;
create trigger trg_posts_no_contact
  before insert or update of body on posts
  for each row execute function reject_contact_info();

drop trigger if exists trg_comments_no_contact on comments;
create trigger trg_comments_no_contact
  before insert or update of body on comments
  for each row execute function reject_contact_info();
