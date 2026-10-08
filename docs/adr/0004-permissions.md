# ADR 0004 — Role-based permissions

- Status: accepted
- Date: 2026-10-08

## Decision

One permission map, `server/policies/permissions.ts`, and one function `can(membership, action)`. Every
service function calls `assertCan(ctx, action)` before touching a repository (unit-tested with mocked
repos in `tests/unit/services.test.ts`). The UI uses the same `can` to hide controls, but the server is
the only enforcement point.

| Role   | Grants                                                                                                               |
| ------ | -------------------------------------------------------------------------------------------------------------------- |
| OWNER  | `*`                                                                                                                  |
| ADMIN  | `project:*`, `request:*`, `comment:*`, `member:invite`, `member:remove`, `member:role`, `billing:view`, `audit:read` |
| MEMBER | `project:read`, `project:create`, `request:*`, `comment:*`                                                           |
| VIEWER | `project:read`, `request:read`, `comment:read`                                                                       |

`tests/unit/permissions.test.ts` asserts the full role × action matrix (72 cases) against an explicit
expected table, so any change to the map is a deliberate, reviewed test change.

## Deviations from the original brief (and why)

1. **ADMIN gets `comment:*`.** The brief's ADMIN list had no comment permissions, so admins could manage
   requests but not read the comments on them. That is almost certainly an omission; adding it is the
   least surprising behaviour.
2. **OWNER-only actions** (`org:update`, `billing:manage`) are covered by `*` and not granted to ADMIN, which
   matches the brief (ADMIN only has `billing:view`).

## Rules on top of the map (in services, because they depend on data)

- Nobody can grant a role above their own; only OWNERs grant or change OWNER (`ROLE_RANK`).
- A workspace must keep at least one OWNER (serializable transaction).
- Anyone can leave a workspace (remove their own membership) without `member:remove`.
- Comments: authors delete their own; ADMIN+ delete any.
- Listing members needs `member:invite` (members page is ADMIN+); assignee pickers use `listAssignees`,
  gated on `request:read`, so MEMBER/VIEWER still see who requests are assigned to.
- Resources of another tenant are **404**, never 403 (ADR 0001). A 403 means "you are a member here but
  your role does not allow this".
