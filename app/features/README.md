# Feature modules

Each folder here is a self-contained feature with four layers:
`domain/` (pure rules + ports) → `application/` (use-cases) → `infrastructure/`
(Supabase/Cloudinary repositories) → `ui/` (Vue components). Dependencies point
inward only. Full rules: `docs/code_architecture.md`.

**`projects/` is the worked exemplar** — its four layers are filled in to show
the pattern (domain port + rules, application use-cases, Supabase repository).
Every other feature follows the same shape and gets filled in as we build it.

| Feature | Responsibility |
|---|---|
| `auth/` | Sign in / out, session, route protection |
| `kyc/` | Role-specific signup forms, document upload, verification status |
| `projects/` | Project lifecycle, applications, deliverables, reviews (client-side reads + safe writes) |
| `escrow/` | Reading a project's money trail (all writes are server-side) |
| `social/` | Feed, posts, comments, favorites/shares, reports |
| `profiles/` | Public profile pages, edit profile |

Remember: sensitive / money / state-machine writes are **not** here — they live
in `server/api/` behind the service_role key.
