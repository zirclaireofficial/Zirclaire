# Zirclaire — Server API Reference

All routes live under `server/api/` and run with the **service_role** key
(they bypass RLS). Each authorizes the caller before acting. The browser calls
these for anything privileged; everything else it does directly via RLS.

Auth guards (in `server/utils/`): `requireUser`, `requireAdmin`,
`requireApproved`, `requireProjectOwner`, `requireAwardedProvider`.

## Onboarding / KYC
| Method + path | Who | Body | Does |
|---|---|---|---|
| `POST /api/kyc/signup` | any signed-in user | profile fields | Creates the caller's profile (`pending`). Rejects `admin` role. |
| `POST /api/kyc/approve` | admin | `{ profileId }` | `pending → approved`; fires member-ID generation. |
| `POST /api/kyc/reject` | admin | `{ profileId, reason }` | `pending → rejected`. |

## Project lifecycle
Each maps to an atomic DB function in `db/10_functions.sql`.

| Method + path | Who | Body | Transition |
|---|---|---|---|
| `POST /api/projects/create` | requester | project fields | (new) → `submitted` |
| `POST /api/projects/fund` | admin | `{ projectId, amount }` | `submitted → funded` (+fund ledger) |
| `POST /api/projects/push-live` | admin | `{ projectId, deadline? }` | `funded → live` |
| `POST /api/projects/award` | requester (owner) | `{ projectId, applicationId }` | `live → awarded` |
| `POST /api/projects/start` | awarded provider | `{ projectId }` | `awarded → in_progress` |
| `POST /api/projects/submit-deliverable` | awarded provider | `{ projectId, mediaUrl, mediaType?, note? }` | `in_progress\|revision_requested → submitted_work` |
| `POST /api/projects/open-review` | requester (owner) | `{ projectId }` | `submitted_work → in_review` |
| `POST /api/projects/request-revision` | requester (owner) | `{ projectId, reason }` | `in_review → revision_requested` |
| `POST /api/projects/accept` | requester (owner) | `{ projectId }` | `in_review → finished` |
| `POST /api/projects/clear` | admin | `{ projectId }` | `finished → closed` (+commission/payout) |
| `POST /api/projects/cancel` | admin | `{ projectId, reason }` | active → `cancelled` (+refund) |

## Media
| Method + path | Who | Body | Does |
|---|---|---|---|
| `POST /api/media/sign` | see below | `{ purpose }` | Returns a Cloudinary upload signature for that purpose's folder + access mode. |

`purpose` ∈ `kyc` (private), `profile` (public), `post` (public, approved SP),
`deliverable` (private, approved SP), `project-attachment` (private, approved SR).
`kyc`/`profile` are allowed for any signed-in user (needed during signup).

## Moderation
| Method + path | Who | Body | Does |
|---|---|---|---|
| `POST /api/moderation/remove-post` | admin | `{ postId }` | `status → removed` (drops from feed). |
| `POST /api/moderation/remove-comment` | admin | `{ commentId }` | Hard-deletes the comment. |
| `POST /api/moderation/resolve-report` | admin | `{ reportId, status }` | Marks report reviewed/actioned/dismissed. |

## Not server routes (done directly via RLS from the browser)
Creating posts, comments, favorites, shares, reports, and applying to a project
are safe writes the client performs directly — RLS enforces the rules. Reads
(feed, projects, profiles, ledger for your own projects) are also direct.
