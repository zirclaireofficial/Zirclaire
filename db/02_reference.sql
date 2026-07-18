-- =====================================================================
-- Zirclaire — 02_reference.sql
-- Static reference data: countries + the project category taxonomy.
-- Run AFTER 01_enums.sql.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Countries
-- member_prefix is the 3-char prefix used when generating member IDs,
-- e.g. Malaysia -> 'MYR' so a requester becomes MYRSR00001.
-- ---------------------------------------------------------------------
create table countries (
  id            smallint generated always as identity primary key,
  name          text     not null unique,
  iso2          char(2)  not null unique,
  dial_code     text     not null,
  member_prefix char(3)  not null unique,
  is_active     boolean  not null default true,
  created_at    timestamptz not null default now()
);

insert into countries (name, iso2, dial_code, member_prefix) values
  ('Malaysia', 'MY', '+60', 'MYR');

-- ---------------------------------------------------------------------
-- Categories (20 top-level) + subcategories
-- ---------------------------------------------------------------------
create table categories (
  id         smallint generated always as identity primary key,
  name       text     not null unique,
  position   smallint not null,
  created_at timestamptz not null default now()
);

create table subcategories (
  id          int      generated always as identity primary key,
  category_id smallint not null references categories(id) on delete cascade,
  name        text     not null,
  position    smallint not null,
  created_at  timestamptz not null default now(),
  unique (category_id, name)
);

create index idx_subcategories_category on subcategories(category_id);

-- Seed categories -----------------------------------------------------
insert into categories (name, position) values
  ('Technology & IT', 1),
  ('Marketing & Advertising', 2),
  ('Creative & Media', 3),
  ('Education', 4),
  ('Professional', 5),
  ('Finance', 6),
  ('Business Management', 7),
  ('Health (Services)', 8),
  ('Recruitment / Hiring', 9),
  ('Real Estate', 10),
  ('Entertainment', 11),
  ('Events', 12),
  ('Travel & Tourism', 13),
  ('Language', 14),
  ('Research', 15),
  ('Security', 16),
  ('Religious & Community', 17),
  ('Digital Platform Services', 18),
  ('Skill-Based Services', 19),
  ('On-Demand Services (Gig Economy)', 20);

-- Seed subcategories (mapped to category by name) ---------------------
insert into subcategories (category_id, name, position)
select c.id, v.name, v.position
from categories c
join (values
  -- 1. Technology & IT
  ('Technology & IT', 'Website development', 1),
  ('Technology & IT', 'Mobile app development', 2),
  ('Technology & IT', 'Software development', 3),
  ('Technology & IT', 'UI/UX design', 4),
  ('Technology & IT', 'Cybersecurity', 5),
  ('Technology & IT', 'Cloud hosting', 6),
  ('Technology & IT', 'Database management', 7),
  ('Technology & IT', 'DevOps', 8),
  ('Technology & IT', 'AI development', 9),
  ('Technology & IT', 'Machine learning consulting', 10),
  ('Technology & IT', 'Blockchain development', 11),
  ('Technology & IT', 'API integration', 12),
  ('Technology & IT', 'IT support', 13),
  ('Technology & IT', 'Data analysis', 14),
  ('Technology & IT', 'Data science', 15),
  -- 2. Marketing & Advertising
  ('Marketing & Advertising', 'Digital marketing', 1),
  ('Marketing & Advertising', 'SEO', 2),
  ('Marketing & Advertising', 'SEM/PPC', 3),
  ('Marketing & Advertising', 'Social media management', 4),
  ('Marketing & Advertising', 'Influencer marketing', 5),
  ('Marketing & Advertising', 'Email marketing', 6),
  ('Marketing & Advertising', 'Affiliate marketing', 7),
  ('Marketing & Advertising', 'Content marketing', 8),
  ('Marketing & Advertising', 'Branding', 9),
  ('Marketing & Advertising', 'Market research', 10),
  ('Marketing & Advertising', 'Copywriting', 11),
  -- 3. Creative & Media
  ('Creative & Media', 'Graphic design', 1),
  ('Creative & Media', 'Logo design', 2),
  ('Creative & Media', 'Video editing', 3),
  ('Creative & Media', 'Animation', 4),
  ('Creative & Media', 'Motion graphics', 5),
  ('Creative & Media', 'Voice over', 6),
  ('Creative & Media', 'Script writing', 7),
  ('Creative & Media', 'Content creation', 8),
  ('Creative & Media', 'Podcast production', 9),
  ('Creative & Media', 'Photography editing', 10),
  ('Creative & Media', 'Illustration', 11),
  -- 4. Education
  ('Education', 'Tutor', 1),
  ('Education', 'Online classes', 2),
  ('Education', 'Coaching', 3),
  ('Education', 'Corporate training', 4),
  ('Education', 'Language teaching', 5),
  ('Education', 'Skill training', 6),
  ('Education', 'Academic mentoring', 7),
  ('Education', 'Exam preparation', 8),
  -- 5. Professional
  ('Professional', 'Accounting', 1),
  ('Professional', 'Audit', 2),
  ('Professional', 'Taxation', 3),
  ('Professional', 'Legal services', 4),
  ('Professional', 'Notary', 5),
  ('Professional', 'Business consulting', 6),
  ('Professional', 'Financial consulting', 7),
  ('Professional', 'HR consulting', 8),
  ('Professional', 'Operations consulting', 9),
  -- 6. Finance
  ('Finance', 'Financial planning', 1),
  ('Finance', 'Wealth management', 2),
  ('Finance', 'Insurance advisory', 3),
  ('Finance', 'Investment advisory', 4),
  ('Finance', 'Bookkeeping', 5),
  ('Finance', 'Payroll management', 6),
  -- 7. Business Management
  ('Business Management', 'Virtual assistant', 1),
  ('Business Management', 'Customer support', 2),
  ('Business Management', 'Call center', 3),
  ('Business Management', 'Data entry', 4),
  ('Business Management', 'Project management', 5),
  ('Business Management', 'Business process outsourcing (BPO)', 6),
  -- 8. Health (Services)
  ('Health (Services)', 'Telemedicine', 1),
  ('Health (Services)', 'Counseling', 2),
  ('Health (Services)', 'Psychotherapy', 3),
  ('Health (Services)', 'Diet consultation', 4),
  ('Health (Services)', 'Fitness coaching', 5),
  ('Health (Services)', 'Wellness coaching', 6),
  -- 9. Recruitment / Hiring
  ('Recruitment / Hiring', 'Recruitment', 1),
  ('Recruitment / Hiring', 'Headhunting', 2),
  ('Recruitment / Hiring', 'Resume writing', 3),
  ('Recruitment / Hiring', 'Career coaching', 4),
  ('Recruitment / Hiring', 'Talent sourcing', 5),
  -- 10. Real Estate
  ('Real Estate', 'Property management', 1),
  ('Real Estate', 'Property consultancy', 2),
  ('Real Estate', 'Property valuation', 3),
  ('Real Estate', 'Real estate agency', 4),
  -- 11. Entertainment
  ('Entertainment', 'DJ', 1),
  ('Entertainment', 'MC', 2),
  ('Entertainment', 'Live streaming host', 3),
  ('Entertainment', 'Event host', 4),
  ('Entertainment', 'Gaming coach', 5),
  ('Entertainment', 'Esports coaching', 6),
  -- 12. Events
  ('Events', 'Event planning', 1),
  ('Events', 'Wedding planning', 2),
  ('Events', 'Event management', 3),
  ('Events', 'Event coordination', 4),
  -- 13. Travel & Tourism
  ('Travel & Tourism', 'Travel planning', 1),
  ('Travel & Tourism', 'Tour guide', 2),
  ('Travel & Tourism', 'Visa consultancy', 3),
  ('Travel & Tourism', 'Travel concierge', 4),
  -- 14. Language
  ('Language', 'Translation', 1),
  ('Language', 'Interpretation', 2),
  ('Language', 'Transcription', 3),
  ('Language', 'Localization', 4),
  -- 15. Research
  ('Research', 'Research service', 1),
  ('Research', 'Feasibility study', 2),
  ('Research', 'Data collection', 3),
  ('Research', 'Survey management', 4),
  -- 16. Security
  ('Security', 'Security consulting', 1),
  ('Security', 'Risk assessment', 2),
  ('Security', 'Compliance consulting', 3),
  -- 17. Religious & Community
  ('Religious & Community', 'Religious talks', 1),
  ('Religious & Community', 'Community management', 2),
  ('Religious & Community', 'Motivational speaking', 3),
  ('Religious & Community', 'Spiritual coaching', 4),
  -- 18. Digital Platform Services
  ('Digital Platform Services', 'Marketplace operator', 1),
  ('Digital Platform Services', 'SaaS subscription', 2),
  ('Digital Platform Services', 'Social media platform', 3),
  ('Digital Platform Services', 'Freelance platform', 4),
  ('Digital Platform Services', 'Membership platform', 5),
  -- 19. Skill-Based Services
  ('Skill-Based Services', 'Proofreading', 1),
  ('Skill-Based Services', 'Editing', 2),
  ('Skill-Based Services', 'Resume review', 3),
  ('Skill-Based Services', 'Pitch deck creation', 4),
  ('Skill-Based Services', 'Presentation design', 5),
  -- 20. On-Demand Services (Gig Economy)
  ('On-Demand Services (Gig Economy)', 'Freelancer', 1),
  ('On-Demand Services (Gig Economy)', 'Consultant', 2),
  ('On-Demand Services (Gig Economy)', 'Advisor', 3),
  ('On-Demand Services (Gig Economy)', 'Expert-on-demand', 4),
  ('On-Demand Services (Gig Economy)', 'Remote support', 5)
) as v(category_name, name, position)
  on v.category_name = c.name;

-- ---------------------------------------------------------------------
-- Security: enable RLS now (deny-by-default). These are public lookup
-- tables; world-readable SELECT policies are added in the RLS step.
-- ---------------------------------------------------------------------
alter table countries     enable row level security;
alter table categories    enable row level security;
alter table subcategories enable row level security;
