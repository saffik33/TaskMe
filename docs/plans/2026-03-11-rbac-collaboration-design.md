# Level 1 RBAC & Workspace Collaboration — Implementation Plan

## Context

TaskMe currently scopes all tasks to `user_id == current_user.id`, meaning no two users can see each other's tasks even within the same workspace. A `WorkspaceMember` model exists with a `role` field, but only "owner" is used. This plan implements workspace-level RBAC with Owner/Editor/Viewer roles and an email invitation system, enabling multi-user collaboration.

## Approach: Extend WorkspaceMember

Build on the existing `WorkspaceMember` table rather than creating a new permissions table. Add `status` and `inviter_id` fields, expand role usage, and change task queries from user-scoped to workspace-scoped.

## Security Requirements (from security audit)

These MUST be addressed during implementation:

1. **Role Enum validation** — `WorkspaceMember.role` is a bare `str` with no validation. Add a `WorkspaceRole` Enum (`owner`, `editor`, `viewer`) to prevent mass assignment attacks (e.g., attacker sending `role: "owner"` in invite request).
2. **Atomic task queries** — When fetching a task by ID, use a single query joining `Task` + `WorkspaceMember` to verify access. Do NOT fetch task first, then check membership separately (race condition risk).
3. **Email enumeration prevention** — Invite endpoint must return the same 200 response whether the email exists or not. Do not leak user registration status.
4. **Rate limiting** — Add rate limits on invite creation (50/workspace/day) and invite token acceptance (10/user/hour).

---

## Phase 1: Database Schema Changes

### Files to modify:
- `backend/app/models/workspace.py` — extend `WorkspaceMember`, add `WorkspaceInvite` model, extend `WorkspacePublic`
- `backend/app/database.py` — add `migrate_add_rbac()` function
- `backend/app/main.py` — register `migrate_add_rbac` in lifespan chain after `migrate_fix_column_constraint`

### New Enum — `WorkspaceRole`:
```python
class WorkspaceRole(str, Enum):
    OWNER = "owner"
    EDITOR = "editor"
    VIEWER = "viewer"
```
Add to `workspace.py`. Use in `WorkspaceMember.role` field and all invite request validation. Prevents mass assignment of arbitrary role values.

### WorkspaceMember — changes:
- Change `role: str` → `role: WorkspaceRole = Field(default=WorkspaceRole.OWNER)`
- Add `status: str = Field(default="accepted", max_length=20)` — values: `pending`, `accepted`
- Add `inviter_id: Optional[int]` — FK to User, nullable (null for original owner)

### New model — WorkspaceInvite (for non-existent users):
| Field | Type | Notes |
|-------|------|-------|
| `id` | int PK | |
| `workspace_id` | FK → Workspace | ondelete CASCADE |
| `email` | str(255) | Invited email, **indexed** |
| `role` | str(20) | `editor` or `viewer` (validated via Enum) |
| `inviter_id` | FK → User | |
| `token` | str(64) | UUID for email link, **unique index** |
| `created_at` | datetime | |
| `expires_at` | datetime | 7 days from creation |

**Indexes:** Add `index=True` on `email` field and unique index on `token` for efficient lookups.

### WorkspacePublic — extend response schema:
- Add `role: Optional[str] = None` so frontend knows the user's role per workspace

### Keep `Workspace.owner_id`:
- Retain for backward compat and quick owner lookup. Authoritative ownership is via `WorkspaceMember.role == "owner"`.

### ColumnConfig ownership — no change:
- Keep column configs per-user-per-workspace (existing behavior). Each member gets their own column visibility/ordering.
- When a new member joins, call `seed_core_columns_for_workspace(session, ws.id, new_user.id)` to give them default columns.

### Migration — `migrate_add_rbac()` in `database.py`:
Follow existing pattern (inspect columns, ALTER TABLE if missing):
- Add `status` column to `workspacemember` with default `"accepted"`
- Add `inviter_id` column to `workspacemember`, nullable
- Create `workspaceinvite` table if not exists
- Backfill any `Task` rows with `workspace_id = NULL` (edge case from pre-workspace era — `migrate_backfill_workspaces` should have handled this, but verify)
- Purely additive — no data loss

**CRITICAL:** Add `WorkspaceInvite` to the import in `create_db_and_tables()` (database.py line 43) — otherwise SQLModel won't create the table:
```python
from .models import Task, SharedList, ColumnConfig, User, Workspace, WorkspaceMember, WorkspaceInvite  # noqa
```

---

## Phase 2: Backend Permission Dependencies

### Files to modify:
- `backend/app/dependencies.py` — add `get_workspace_member`, `require_editor`, `require_owner`

### New dependencies:
```python
def get_workspace_member(workspace_id: int, current_user: User, session: Session) -> WorkspaceMember:
    """Returns accepted WorkspaceMember or raises 404."""
    member = session.exec(
        select(WorkspaceMember).where(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == current_user.id,
            WorkspaceMember.status == "accepted",
        )
    ).first()
    if not member:
        raise HTTPException(404, "Workspace not found")
    return member

def require_editor(member: WorkspaceMember) -> WorkspaceMember:
    if member.role == "viewer":
        raise HTTPException(403, "Editor access required")
    return member

def require_owner(member: WorkspaceMember) -> WorkspaceMember:
    if member.role != "owner":
        raise HTTPException(403, "Owner access required")
    return member
```

---

## Phase 3: Backend API — Member Management Router

### Files to create:
- `backend/app/routers/members.py` — new router

### Files to modify:
- `backend/app/main.py` — import and register `members.router`
- `backend/app/routers/auth.py` — add `_accept_pending_invites()` helper

### Endpoints:
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/workspaces/{id}/members` | Any member | List members + pending invites |
| `POST` | `/workspaces/{id}/invite` | Owner | Invite by email + role |
| `PATCH` | `/workspaces/{id}/members/{user_id}/role` | Owner | Change role |
| `DELETE` | `/workspaces/{id}/members/{user_id}` | Owner or self | Remove/leave |
| `POST` | `/invites/{token}/accept` | Authenticated | Accept invite via token |

### Invite flow:
1. Owner POSTs `{email, role}` to invite endpoint
2. If user exists → create `WorkspaceMember(status="accepted")` + call `seed_core_columns_for_workspace(session, ws.id, user.id)`. Send notification email.
3. If user doesn't exist → create `WorkspaceInvite` with token, send invite email via new `send_workspace_invite_email()` in `email_service.py`

### New email template — `backend/app/services/email_service.py`:
Add `send_workspace_invite_email(to_email, inviter_username, workspace_name, role, invite_url)`:
- Styled like existing templates (purple gradient header, CTA button)
- Button links to `{FRONTEND_URL}/login?invite={token}`
- Shows workspace name, role, and inviter name

### Auto-join on signup — shared helper in `auth.py`:

Extract `_accept_pending_invites(session, user)`:
- Query `WorkspaceInvite` by `user.email` where `expires_at > now`
- For each match: create `WorkspaceMember` + seed columns + delete invite

Call this helper in **4 code paths**:
| Code path | Location | When |
|-----------|----------|------|
| `register()` | auth.py line 49 | After user creation, before response |
| `google_callback()` | auth.py line 247 | New user branch, after default workspace creation |
| `microsoft_callback()` | auth.py line 370 | New user branch, after default workspace creation |
| `login()` | auth.py line 132 | After successful auth, before returning token |

### Guards:
- Cannot invite self → 400
- Cannot invite existing member → 409
- Owner cannot demote self → 400
- Last owner cannot leave → 400
- Expired invite token → 410

---

## Phase 4: Modify ALL Routers for Workspace-Scoped Access

### 4a. `backend/app/routers/tasks.py` — Major rewrite

| Endpoint | Before | After |
|----------|--------|-------|
| `GET /tasks` (line 44) | `Task.user_id == current_user.id` | `Task.workspace_id == workspace_id` (membership verified). **Make `workspace_id` required.** |
| `GET /tasks/{id}` (line 178) | `Task.user_id == current_user.id` | **Atomic query:** single SELECT joining Task + WorkspaceMember to verify access in one query (no fetch-then-check). |
| `POST /tasks` (line 185) | `workspace_id` optional | **Required.** Require editor+. Keep `user_id` as "created_by". |
| `POST /tasks/bulk` (line 196) | `workspace_id` optional | **Required.** Require editor+. |
| `PATCH /tasks/{id}` (line 211) | `Task.user_id == current_user.id` | **Atomic query:** join Task + WorkspaceMember, verify editor+ role. |
| `DELETE /tasks/{id}` (line 245) | `Task.user_id == current_user.id` | **Atomic query:** join Task + WorkspaceMember, verify editor+ role. |
| `DELETE /tasks/all` (line 236) | Deletes ALL user tasks across ALL workspaces | **Require `workspace_id` param.** Scope to that workspace. Require editor+. |
| `DELETE /tasks/bulk/delete` (line 254) | `Task.user_id == current_user.id` | Verify tasks belong to workspace where user is editor+. |
| `POST /tasks/smart-search` (line 101) | Auth only | No role change needed. |
| `POST /tasks/copy-move` (line 124) | Dest membership only, source by `user_id` | Verify editor+ on **both** source and dest. Filter source tasks by workspace membership, not `user_id`. |

### 4b. `backend/app/routers/workspaces.py`

| Endpoint | Change |
|----------|--------|
| `GET /workspaces` (line 11) | Include user's `role` in response. **Note:** Can't just return `Workspace` model — must manually build response dicts joining `Workspace` + `WorkspaceMember.role` since `role` lives on `WorkspaceMember`, not `Workspace`. Return list of dicts with `WorkspacePublic` fields + `role`. |
| `PATCH /workspaces/{id}` (line 60) | **Require owner** (currently any member can update). |
| `DELETE /workspaces/{id}` (line 80) | Add `DELETE FROM workspaceinvite WHERE workspace_id = :wid` to cascade cleanup. |

### 4c. `backend/app/routers/columns.py` — Nuanced role logic

Replace `_user_owns_column` helper with workspace membership check.

**Personal preference operations (any member):**
- `PATCH /columns/{id}` when only changing `is_visible` or `position`
- `PATCH /columns/reorder`

**Workspace schema operations (editor+):**
- `POST /columns` — creating custom field definitions
- `DELETE /columns/{id}` — deleting custom fields
- `PATCH /columns/{id}` when changing `display_name`, `field_type`, `options`

### 4d. `backend/app/routers/export.py`

| Endpoint | Change |
|----------|--------|
| `GET /export/excel` (line 17) | Replace `Task.user_id == current_user.id` (line 28) with workspace membership. Any member can export. Fix custom columns query (line 62) to use `ColumnConfig.workspace_id` instead of `ColumnConfig.user_id`. |

### 4e. `backend/app/routers/share.py`

| Endpoint | Change |
|----------|--------|
| `POST /share` (line 30) | Replace `Task.user_id == current_user.id` (line 34) with workspace membership. Require editor+. |
| `POST /share/send-email` (line 64) | Same — workspace membership + editor+. |
| `GET /share/{token}` (line 93) | No change (public, token-based). |

### 4f. `backend/app/routers/parse.py`

| Endpoint | Change |
|----------|--------|
| `POST /parse` (line 22) | Verify workspace membership when `workspace_id` provided. **Any member can parse** — parsing only extracts structured data from text, it doesn't create tasks. Task creation is a separate `POST /tasks/bulk` call which enforces editor+. |

---

## Phase 5: Backend Tests

### Files to create:
- `backend/tests/test_members.py` — member management + invite flow

### Files to modify:
- `backend/tests/test_isolation.py` — cross-user workspace access tests
- `backend/tests/conftest.py` — add:
  - `_add_member(session, workspace, user, role)` helper for creating editors/viewers in tests
  - `user_c` fixture — third user for viewer testing
  - `shared_workspace` fixture — workspace with owner (user_a), editor (user_b), viewer (user_c)

### Test categories:
1. **Isolation**: Non-member gets 404 on workspace tasks. Viewer gets 403 on POST/PATCH/DELETE.
2. **Invite flow**: Invite existing user, invite non-existent email, duplicate invite (409), expired token (410), accept token, auto-join on register/OAuth.
3. **Role enforcement**: Every task endpoint tested with owner/editor/viewer → correct 200/403.
4. **Edge cases**: Owner can't demote self, last owner can't leave, self-invite rejected, delete workspace cleans up invites.
5. **Backward compat**: Existing single-user workspaces still work. Tasks visible to all workspace members.
6. **Copy/move**: Editor+ required on both source and destination workspaces.
7. **Columns**: Viewers can toggle own visibility. Only editors+ can create/delete custom fields.
8. **Export/Share**: Any member can export. Only editors+ can create share links.

---

## Phase 6: Frontend — API & Context

### Files to modify:
- `frontend/src/api/workspaces.js` — add:
  - `fetchMembers(workspaceId)`
  - `inviteMember(workspaceId, email, role)`
  - `removeMember(workspaceId, userId)`
  - `changeRole(workspaceId, userId, role)`
  - `acceptInvite(token)`

- `frontend/src/api/tasks.js` — fix:
  - `deleteAllTasks()` — **must accept and pass `workspace_id`** (currently takes no params)

- `frontend/src/context/WorkspaceContext.jsx` — add:
  - `members` state — fetched on **initial load** (for active workspace) AND on workspace switch
  - `currentUserRole` — derived from members list matching current user ID (from AuthContext). Also available from `role` field on extended `WorkspacePublic` response as a faster shortcut.
  - Member management methods wrapping the API calls

- `frontend/src/context/TaskContext.jsx` — fix:
  - `removeAllTasks()` (line 114) — pass `activeWorkspace.id` to `deleteAllTasks()`
  - `addTask()` (line 58) — remove conditional `activeWorkspace ?` — always pass `workspace_id` (now required)
  - `addBulkTasks()` (line 66) — same: always pass `workspace_id`

**Note:** The existing hook is `useWorkspaces()` (not `useWorkspace`). Keep the same name.

---

## Phase 7: Frontend — New Components & Permission Gating

### Files to create:
- `frontend/src/components/InviteDialog.jsx` — email input + role dropdown (Editor/Viewer) + send button
- `frontend/src/components/MemberList.jsx` — member list with role badges, owner gets change-role dropdown + remove button

### Permission gating pattern:
```jsx
const { currentUserRole } = useWorkspaces()
const canEdit = currentUserRole === 'owner' || currentUserRole === 'editor'
const isOwner = currentUserRole === 'owner'
```

### Components to modify:
| Component | Change |
|-----------|--------|
| `Dashboard.jsx` | Hide "Add Task" button + NaturalLanguageInput when `!canEdit` |
| `TaskTable.jsx` | Hide entire actions column when `!canEdit` (not just buttons — avoids empty column gap). Pass `canEdit` prop. |
| `TaskBoard.jsx` | Conditionally remove `DndContext`/sensors when `!canEdit` (dnd-kit has no disable prop). |
| `TaskCard.jsx` | Hide edit/delete buttons when `!canEdit` |
| `TaskModal.jsx` | Don't render for viewers |
| `ShareDialog.jsx` | Only show for `canEdit`. **Fix:** pass `activeWorkspace.id` to `createShareLink()` (currently missing). |
| `ColumnManager.jsx` | Allow visibility toggle for all. Hide create/delete custom fields for `!canEdit`. |
| `WorkspaceSwitcher.jsx` | Show role badge next to workspace name |
| `Layout.jsx` | Add "Members" icon button in workspace header area (visible to all, manage actions owner-only) |
| `LoginPage.jsx` | Handle `?invite=<token>` URL param: store in sessionStorage on load, after successful login/register call `POST /invites/{token}/accept` and clear it. This handles edge cases where auto-join by email doesn't apply (e.g., user registered with different email). |

---

## Phase 8: Frontend Tests

### Files to create:
- `frontend/src/__tests__/components/InviteDialog.test.jsx`
- `frontend/src/__tests__/components/MemberList.test.jsx`

### Files to modify:
- `frontend/src/__tests__/contexts/WorkspaceContext.test.jsx` — test `fetchMembers`, `currentUserRole` derivation, member management methods
- Add permission-gating tests: verify viewer sees no edit controls, editor sees edit but not member management

---

## Verification

### Backend:
```bash
cd backend && source venv/Scripts/activate && python -m pytest tests/ -v
```
- All existing 97 tests must still pass
- New member/RBAC tests must pass

### Frontend:
```bash
cd frontend && npx vitest run
```
- All existing 64 tests must still pass
- New component and context tests must pass

### Manual E2E:
1. User A creates workspace, adds tasks
2. User A invites User B (editor) → B sees workspace with "editor" badge, can create/edit/delete tasks
3. User A invites User C (viewer) → C sees tasks but no edit controls, gets 403 on write attempts
4. User A changes B's role to viewer → B loses edit access on refresh
5. User A removes C → C no longer sees workspace
6. User A invites non-existent email → WorkspaceInvite created, email sent with token
7. Non-existent user signs up with that email → auto-joins workspace with correct role
8. Existing single-user flow still works without regression
9. Column visibility toggle works for all roles; custom field create/delete only for editors+

### Pre-commit hook:
```bash
.git/hooks/pre-commit  # runs both backend and frontend tests
```

---

## Key Files Reference

| File | Action |
|------|--------|
| `backend/app/models/workspace.py` | Extend WorkspaceMember, add WorkspaceInvite, extend WorkspacePublic |
| `backend/app/dependencies.py` | Add get_workspace_member, require_editor, require_owner |
| `backend/app/routers/members.py` | **Create** — member management + invite endpoints |
| `backend/app/main.py` | Register members router, add migrate_add_rbac to lifespan |
| `backend/app/routers/tasks.py` | **Major rewrite** — user-scoped → workspace-scoped, role enforcement on all 10 endpoints |
| `backend/app/routers/workspaces.py` | Add role to response, tighten update to owner, cleanup invites on delete |
| `backend/app/routers/columns.py` | Replace _user_owns_column with membership check, split personal vs schema permissions |
| `backend/app/routers/export.py` | Replace user_id filter with workspace membership, fix column query to use workspace_id |
| `backend/app/routers/share.py` | Replace user_id check with workspace membership + editor+ |
| `backend/app/routers/parse.py` | Add workspace membership check (any member can parse) |
| `backend/app/routers/auth.py` | Add _accept_pending_invites helper, call in register + both OAuth callbacks + login |
| `backend/app/services/email_service.py` | Add send_workspace_invite_email() template |
| `backend/app/database.py` | Add migrate_add_rbac() for new columns + workspaceinvite table |
| `backend/tests/conftest.py` | Add _add_member helper, user_c fixture, shared_workspace fixture |
| `backend/tests/test_members.py` | **Create** — member + invite tests |
| `backend/tests/test_isolation.py` | Extend with RBAC isolation tests |
| `frontend/src/api/workspaces.js` | Add member management API functions |
| `frontend/src/api/tasks.js` | Fix deleteAllTasks to accept workspace_id |
| `frontend/src/context/WorkspaceContext.jsx` | Add members state, currentUserRole, member methods; fetch on load AND switch |
| `frontend/src/context/TaskContext.jsx` | Fix removeAllTasks/addTask/addBulkTasks to always pass workspace_id |
| `frontend/src/pages/LoginPage.jsx` | Handle ?invite= token param for invite link flow |
| `frontend/src/components/InviteDialog.jsx` | **Create** — invite UI |
| `frontend/src/components/MemberList.jsx` | **Create** — member list UI |
| `frontend/src/components/Dashboard.jsx` | Permission-gate task creation |
| `frontend/src/components/TaskTable.jsx` | Permission-gate edit/delete |
| `frontend/src/components/TaskBoard.jsx` | Permission-gate drag-and-drop |
| `frontend/src/components/TaskCard.jsx` | Permission-gate edit/delete buttons |
| `frontend/src/components/TaskModal.jsx` | Hide for viewers |
| `frontend/src/components/ShareDialog.jsx` | Hide for viewers |
| `frontend/src/components/ColumnManager.jsx` | Split: visibility toggle (any) vs create/delete custom fields (editor+) |
| `frontend/src/components/WorkspaceSwitcher.jsx` | Show role badge |
| `frontend/src/components/Layout.jsx` | Add Members button |
| `frontend/src/components/InlineEdit.jsx` | Add `disabled` prop — skip click-to-edit when true, render static text |
