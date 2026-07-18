# Zirclaire — Code Architecture

How the application code is organised. The goal is **high cohesion, low coupling**: each feature is self-contained, and the parts that change for different reasons live apart.

## The layers

Every feature module (`app/features/<name>/`) has the same four layers. **Dependencies only point downward** — an arrow means "may import from":

```
   ui  ─────────────►  application  ─────────────►  domain
                              ▲                        ▲
                              │                        │
                       infrastructure ────────────────┘
                     (implements domain ports)
```

- **domain/** — the stable core. Pure TypeScript: entities, value types, enums, and business rules. It imports **nothing** framework-specific — no Nuxt, no Supabase, no Cloudinary. If the business rule "a project's 20% commission" lives anywhere, it lives here. Also defines **ports**: interfaces describing what the outside world must provide (e.g. `ProjectRepository`), without saying how.
- **application/** — use-cases / composables. Orchestrates a task ("apply to a project") by calling domain rules and ports. Holds no database or HTTP details.
- **infrastructure/** — the only layer that knows Supabase and Cloudinary exist. Implements the domain's ports (e.g. a `SupabaseProjectRepository`). Swappable: replace the database and only this layer changes.
- **ui/** — Vue components for the feature. Talks to `application`, never directly to Supabase.

### Why
Because `domain` depends on nothing, it never breaks when a library changes. Because only `infrastructure` touches Supabase, the rest of the app doesn't care where data comes from. Because features are self-contained, you can work on `social` without touching `projects`.

## The map

```
app/
├── features/
│   ├── auth/          sign in/out, session
│   ├── kyc/           signup forms, verification status
│   ├── projects/      project lifecycle, applications, deliverables (client side)
│   ├── escrow/        reading the money trail (writes are server-side)
│   ├── social/        feed, posts, comments, engagement, reports
│   └── profiles/      public profile pages, edit profile
│       ├── domain/          pure types + business rules + ports
│       ├── application/     use-cases / composables
│       ├── infrastructure/  repositories (Supabase/Cloudinary)
│       └── ui/              components
├── shared/            cross-cutting: base types, small utils, client wrappers
├── components/        (Nuxt) only truly global UI
├── pages/             (Nuxt) thin route entries → delegate to a feature's ui
└── types/database.types.ts   generated Supabase types (source of truth for DB shape)

server/                (Nuxt server) PRIVILEGED — uses the service_role key
├── api/               route handlers: KYC approval, funding, awarding, escrow clearing
└── utils/             server-only helpers (service-role client, guards)
```

## Hard rules

1. **`domain` imports nothing from `application`, `infrastructure`, `ui`, Nuxt, or any DB/SDK.** It is the one layer that must never depend on the outside.
2. **Only `infrastructure` (client) and `server/` (privileged) import the Supabase client.** `ui` and `application` never touch it directly — they go through a repository/use-case.
3. **Sensitive / money / state-machine writes never happen from the browser.** They live in `server/api/` behind the service_role key (see the security model in `system_architecture.md`). The client only *reads* (via RLS) and performs safe writes (post, comment, apply).
4. **Features don't reach into each other's internals.** If two features need something shared, it moves to `app/shared/`.

## The `server/` boundary
This is where the "admin bottleneck" is actually enforced in code. The browser physically cannot run these operations — it has no service_role key. Every privileged action (approve KYC, fund a project, award a job, clear escrow) is a server route that validates the request, then performs the change with elevated rights.
