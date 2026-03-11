# RBAC Workspace Collaboration — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable multi-user workspace collaboration with Owner/Editor/Viewer roles and email invitations.

**Architecture:** Extend existing `WorkspaceMember` table with role enum, status, and inviter_id. Add `WorkspaceInvite` model for non-existent users. Change all task queries from `user_id`-scoped to workspace-membership-scoped. Gate frontend UI based on role.

**Tech Stack:** FastAPI + SQLModel (backend), React 19 + Vite + Tailwind (frontend), PostgreSQL/SQLite, Vitest, pytest

**Design doc:** `docs/plans/2026-03-11-rbac-collaboration-design.md`

---

## Task 1: Schema — WorkspaceRole Enum + WorkspaceMember Extension

**Files:**
- Modify: `backend/app/models/workspace.py`
- Test: `backend/tests/test_workspaces.py` (existing)

**Step 1: Write failing test**

```python
# backend/tests/test_workspaces.py — add at top
def test_workspace_role_enum_values():
    from app.models.workspace import WorkspaceRole
    assert WorkspaceRole.OWNER == "owner"
    assert WorkspaceRole.EDITOR == "editor"
    assert WorkspaceRole.VIEWER == "viewer"

def test_workspace_member_has_status_and_inviter(session):
    from app.models.workspace import WorkspaceMember
    member = WorkspaceMember(workspace_id=1, user_id=1, role="owner")
    assert member.status == "accepted"
    assert member.inviter_id is None
```

**Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_workspaces.py::test_workspace_role_enum_values -v`
Expected: FAIL — `WorkspaceRole` not defined

**Step 3: Implement in `backend/app/models/workspace.py`**

Add `WorkspaceRole` enum. Add `status` and `inviter_id` fields to `WorkspaceMember`. Keep `role` default as `"owner"` (string value, compatible with enum).

```python
from enum import Enum

class WorkspaceRole(str, Enum):
    OWNER = "owner"
    EDITOR = "editor"
    VIEWER = "viewer"
```

Add to `WorkspaceMember`:
```python
status: str = Field(default="accepted", max_length=20)
inviter_id: Optional[int] = Field(default=None, sa_column=Column(Integer, ForeignKey("user.id"), nullable=True))
```

**Step 4: Run tests**

Run: `cd backend && python -m pytest tests/ -v`
Expected: All existing tests PASS + new tests PASS

**Step 5: Commit**

```bash
git add backend/app/models/workspace.py backend/tests/test_workspaces.py
git commit -m "feat: add WorkspaceRole enum, status and inviter_id to WorkspaceMember"
```

---

## Task 2: Schema — WorkspaceInvite Model + Migration

**Files:**
- Modify: `backend/app/models/workspace.py` — add `WorkspaceInvite`
- Modify: `backend/app/models/__init__.py` — export `WorkspaceInvite`
- Modify: `backend/app/database.py` — add `migrate_add_rbac()`, update `create_db_and_tables` import
- Modify: `backend/app/main.py` — register migration in lifespan

**Step 1: Write failing test**

```python
# backend/tests/test_workspaces.py
def test_workspace_invite_model_exists(session):
    from app.models.workspace import WorkspaceInvite
    invite = WorkspaceInvite(
        workspace_id=1, email="test@example.com", role="editor",
        inviter_id=1, token="abc123",
    )
    assert invite.email == "test@example.com"
    assert invite.role == "editor"
```

**Step 2: Run to verify failure**

**Step 3: Implement**

Add `WorkspaceInvite` model to `workspace.py` with all fields from design doc (id, workspace_id, email, role, inviter_id, token, created_at, expires_at). Add indexes on `email` and unique on `token`.

Add `migrate_add_rbac()` to `database.py` following existing pattern. Add `WorkspaceInvite` to the import in `create_db_and_tables()` line 43.

Register `migrate_add_rbac` in `main.py` lifespan after `migrate_fix_column_constraint`.

**Step 4: Run all tests**

Run: `cd backend && python -m pytest tests/ -v`

**Step 5: Commit**

```bash
git commit -m "feat: add WorkspaceInvite model and migrate_add_rbac migration"
```

---

## Task 3: Backend — Permission Dependencies

**Files:**
- Modify: `backend/app/dependencies.py`
- Test: `backend/tests/test_isolation.py` (extend)

**Step 1: Write failing tests**

```python
# backend/tests/test_isolation.py — add
def test_non_member_gets_404_on_workspace_tasks(client, user_a, user_b, session):
    """User B cannot access User A's workspace tasks."""
    # Create a task in user_a's workspace
    resp = client.post("/api/v1/tasks", json={"task_name": "Secret"},
                       params={"workspace_id": user_a["workspace"].id},
                       headers=user_a["headers"])
    assert resp.status_code == 201

    # User B tries to list tasks in user_a's workspace
    resp = client.get("/api/v1/tasks",
                      params={"workspace_id": user_a["workspace"].id},
                      headers=user_b["headers"])
    assert resp.status_code == 404  # not a member
```

**Step 2: Run — will FAIL because current code returns 200 (just empty list since user_id filter)**

**Step 3: Implement `get_workspace_member`, `require_editor`, `require_owner` in `dependencies.py`**

See design doc Phase 2 for exact code. Create `WorkspaceMemberDep` annotated type.

Then update `tasks.py` `GET /tasks` endpoint to use the new dependency (verify workspace membership before querying tasks). Remove `Task.user_id == current_user.id` filter, replace with `Task.workspace_id == workspace_id` after membership verified.

**Step 4: Run all tests** — existing tests may break because they now need workspace membership. Fix any that fail by ensuring test fixtures create proper membership.

**Step 5: Commit**

```bash
git commit -m "feat: add workspace permission dependencies, enforce membership on task listing"
```

---

## Task 4: Backend — Task Router Rewrite (Read Endpoints)

**Files:**
- Modify: `backend/app/routers/tasks.py` — GET /tasks, GET /tasks/{id}
- Test: `backend/tests/test_isolation.py`

**Step 1: Write failing tests**

```python
def test_editor_can_see_workspace_tasks(client, user_a, user_b, session):
    """Editor in workspace A can see tasks."""
    _add_member(session, user_a["workspace"], user_b["user"], "editor")
    # Create task as owner
    client.post("/api/v1/tasks", json={"task_name": "Visible"},
                params={"workspace_id": user_a["workspace"].id},
                headers=user_a["headers"])
    # Editor can see it
    resp = client.get("/api/v1/tasks",
                      params={"workspace_id": user_a["workspace"].id},
                      headers=user_b["headers"])
    assert resp.status_code == 200
    assert len(resp.json()) == 1

def test_get_task_by_id_checks_workspace_membership(client, user_a, user_b, session):
    """Non-member cannot fetch task by ID."""
    resp = client.post("/api/v1/tasks", json={"task_name": "Secret"},
                       params={"workspace_id": user_a["workspace"].id},
                       headers=user_a["headers"])
    task_id = resp.json()["id"]
    # Non-member gets 404
    resp = client.get(f"/api/v1/tasks/{task_id}", headers=user_b["headers"])
    assert resp.status_code == 404
```

Add `_add_member` helper to `conftest.py`:
```python
def _add_member(session, workspace, user, role):
    member = WorkspaceMember(workspace_id=workspace.id, user_id=user.id, role=role)
    session.add(member)
    session.commit()
    seed_core_columns_for_workspace(session, workspace.id, user.id)
```

**Step 2: Run to verify failure**

**Step 3: Implement** — Update `GET /tasks` to require workspace_id and verify membership. Update `GET /tasks/{id}` to use atomic query joining Task + WorkspaceMember.

**Step 4: Run all tests**

**Step 5: Commit**

```bash
git commit -m "feat: enforce workspace membership on task read endpoints"
```

---

## Task 5: Backend — Task Router Rewrite (Write Endpoints)

**Files:**
- Modify: `backend/app/routers/tasks.py` — POST, PATCH, DELETE endpoints
- Test: `backend/tests/test_isolation.py`

**Step 1: Write failing tests**

```python
def test_viewer_cannot_create_task(client, user_a, user_b, session):
    _add_member(session, user_a["workspace"], user_b["user"], "viewer")
    resp = client.post("/api/v1/tasks", json={"task_name": "Blocked"},
                       params={"workspace_id": user_a["workspace"].id},
                       headers=user_b["headers"])
    assert resp.status_code == 403

def test_editor_can_create_task(client, user_a, user_b, session):
    _add_member(session, user_a["workspace"], user_b["user"], "editor")
    resp = client.post("/api/v1/tasks", json={"task_name": "Allowed"},
                       params={"workspace_id": user_a["workspace"].id},
                       headers=user_b["headers"])
    assert resp.status_code == 201

def test_viewer_cannot_update_task(client, user_a, user_b, session):
    _add_member(session, user_a["workspace"], user_b["user"], "viewer")
    task = client.post("/api/v1/tasks", json={"task_name": "T"},
                       params={"workspace_id": user_a["workspace"].id},
                       headers=user_a["headers"]).json()
    resp = client.patch(f"/api/v1/tasks/{task['id']}", json={"task_name": "X"},
                        headers=user_b["headers"])
    assert resp.status_code == 403

def test_viewer_cannot_delete_task(client, user_a, user_b, session):
    _add_member(session, user_a["workspace"], user_b["user"], "viewer")
    task = client.post("/api/v1/tasks", json={"task_name": "T"},
                       params={"workspace_id": user_a["workspace"].id},
                       headers=user_a["headers"]).json()
    resp = client.delete(f"/api/v1/tasks/{task['id']}", headers=user_b["headers"])
    assert resp.status_code == 403
```

**Step 2-5: Standard TDD cycle + commit**

```bash
git commit -m "feat: enforce editor+ role on task write endpoints"
```

---

## Task 6: Backend — Task Router (Bulk + Copy/Move + Delete All)

**Files:**
- Modify: `backend/app/routers/tasks.py` — bulk, copy-move, delete-all endpoints

**Step 1: Write tests for bulk create, bulk delete, delete-all (require workspace_id + editor+), copy-move (editor+ on both workspaces)**

**Step 2-5: Standard TDD cycle + commit**

```bash
git commit -m "feat: enforce RBAC on bulk, copy-move, and delete-all task endpoints"
```

---

## Task 7: Backend — Workspaces Router (Role in Response + Owner-Only Update)

**Files:**
- Modify: `backend/app/routers/workspaces.py`
- Modify: `backend/app/models/workspace.py` — extend `WorkspacePublic` with `role`

**Step 1: Write tests**

```python
def test_list_workspaces_includes_role(client, user_a):
    resp = client.get("/api/v1/workspaces", headers=user_a["headers"])
    assert resp.status_code == 200
    ws = resp.json()[0]
    assert ws["role"] == "owner"

def test_non_owner_cannot_update_workspace(client, user_a, user_b, session):
    _add_member(session, user_a["workspace"], user_b["user"], "editor")
    resp = client.patch(f"/api/v1/workspaces/{user_a['workspace'].id}",
                        json={"name": "Hacked"}, headers=user_b["headers"])
    assert resp.status_code == 403
```

**Step 2-5: Standard TDD cycle. Build response dicts manually joining Workspace + WorkspaceMember.role. Commit.**

```bash
git commit -m "feat: include role in workspace response, restrict update to owner"
```

---

## Task 8: Backend — Other Routers (Columns, Export, Share, Parse)

**Files:**
- Modify: `backend/app/routers/columns.py` — replace `_user_owns_column` with membership check
- Modify: `backend/app/routers/export.py` — workspace membership, fix column query
- Modify: `backend/app/routers/share.py` — workspace membership + editor+
- Modify: `backend/app/routers/parse.py` — workspace membership (any member)

**Step 1: Write tests for each router change (viewer can export but not share, editor can share, any member can parse)**

**Step 2-5: Implement each, run tests, commit per router:**

```bash
git commit -m "feat: enforce RBAC on columns router"
git commit -m "feat: enforce RBAC on export router"
git commit -m "feat: enforce RBAC on share router"
git commit -m "feat: enforce RBAC on parse router"
```

---

## Task 9: Backend — Member Management Router (Create)

**Files:**
- Create: `backend/app/routers/members.py`
- Modify: `backend/app/main.py` — register router
- Create: `backend/tests/test_members.py`

**Step 1: Write tests**

```python
def test_list_members(client, user_a, session):
    resp = client.get(f"/api/v1/workspaces/{user_a['workspace'].id}/members",
                      headers=user_a["headers"])
    assert resp.status_code == 200
    assert len(resp.json()["members"]) == 1
    assert resp.json()["members"][0]["role"] == "owner"

def test_invite_existing_user(client, user_a, user_b, session):
    resp = client.post(f"/api/v1/workspaces/{user_a['workspace'].id}/invite",
                       json={"email": "bob@test.com", "role": "editor"},
                       headers=user_a["headers"])
    assert resp.status_code == 200  # same response regardless

def test_invite_nonexistent_email(client, user_a, session):
    resp = client.post(f"/api/v1/workspaces/{user_a['workspace'].id}/invite",
                       json={"email": "nobody@test.com", "role": "viewer"},
                       headers=user_a["headers"])
    assert resp.status_code == 200  # same response (email enumeration prevention)

def test_non_owner_cannot_invite(client, user_a, user_b, session):
    _add_member(session, user_a["workspace"], user_b["user"], "editor")
    resp = client.post(f"/api/v1/workspaces/{user_a['workspace'].id}/invite",
                       json={"email": "someone@test.com", "role": "viewer"},
                       headers=user_b["headers"])
    assert resp.status_code == 403

def test_cannot_invite_self(client, user_a, session):
    resp = client.post(f"/api/v1/workspaces/{user_a['workspace'].id}/invite",
                       json={"email": "alice@test.com", "role": "editor"},
                       headers=user_a["headers"])
    assert resp.status_code == 400

def test_cannot_invite_existing_member(client, user_a, user_b, session):
    _add_member(session, user_a["workspace"], user_b["user"], "editor")
    resp = client.post(f"/api/v1/workspaces/{user_a['workspace'].id}/invite",
                       json={"email": "bob@test.com", "role": "viewer"},
                       headers=user_a["headers"])
    assert resp.status_code == 409

def test_cannot_invite_with_owner_role(client, user_a, session):
    resp = client.post(f"/api/v1/workspaces/{user_a['workspace'].id}/invite",
                       json={"email": "someone@test.com", "role": "owner"},
                       headers=user_a["headers"])
    assert resp.status_code == 400  # only editor/viewer allowed
```

**Step 2-5: Create `members.py` router with all endpoints. Register in main.py. Commit.**

```bash
git commit -m "feat: add member management router with invite, list, role change, remove"
```

---

## Task 10: Backend — Member Management (Change Role, Remove, Leave)

**Files:**
- Modify: `backend/app/routers/members.py`
- Test: `backend/tests/test_members.py`

**Step 1: Write tests**

```python
def test_change_member_role(client, user_a, user_b, session):
    _add_member(session, user_a["workspace"], user_b["user"], "editor")
    resp = client.patch(
        f"/api/v1/workspaces/{user_a['workspace'].id}/members/{user_b['user'].id}/role",
        json={"role": "viewer"}, headers=user_a["headers"])
    assert resp.status_code == 200

def test_owner_cannot_demote_self(client, user_a, session):
    resp = client.patch(
        f"/api/v1/workspaces/{user_a['workspace'].id}/members/{user_a['user'].id}/role",
        json={"role": "editor"}, headers=user_a["headers"])
    assert resp.status_code == 400

def test_remove_member(client, user_a, user_b, session):
    _add_member(session, user_a["workspace"], user_b["user"], "editor")
    resp = client.delete(
        f"/api/v1/workspaces/{user_a['workspace'].id}/members/{user_b['user'].id}",
        headers=user_a["headers"])
    assert resp.status_code == 200

def test_member_can_leave(client, user_a, user_b, session):
    _add_member(session, user_a["workspace"], user_b["user"], "editor")
    resp = client.delete(
        f"/api/v1/workspaces/{user_a['workspace'].id}/members/{user_b['user'].id}",
        headers=user_b["headers"])
    assert resp.status_code == 200

def test_last_owner_cannot_leave(client, user_a, session):
    resp = client.delete(
        f"/api/v1/workspaces/{user_a['workspace'].id}/members/{user_a['user'].id}",
        headers=user_a["headers"])
    assert resp.status_code == 400
```

**Step 2-5: TDD cycle + commit**

```bash
git commit -m "feat: add role change, remove member, and leave workspace"
```

---

## Task 11: Backend — Auto-Join on Signup + Invite Email

**Files:**
- Modify: `backend/app/routers/auth.py` — add `_accept_pending_invites()`
- Modify: `backend/app/services/email_service.py` — add invite email template

**Step 1: Write tests**

```python
# backend/tests/test_members.py
def test_accept_invite_token(client, user_a, user_b, session):
    # Create invite for user_b
    from app.models.workspace import WorkspaceInvite
    invite = WorkspaceInvite(workspace_id=user_a["workspace"].id,
                             email="bob@test.com", role="editor",
                             inviter_id=user_a["user"].id,
                             token="test-token-123")
    session.add(invite)
    session.commit()
    resp = client.post("/api/v1/invites/test-token-123/accept",
                       headers=user_b["headers"])
    assert resp.status_code == 200

def test_expired_invite_token(client, user_a, user_b, session):
    from app.models.workspace import WorkspaceInvite
    from datetime import datetime, timezone, timedelta
    invite = WorkspaceInvite(workspace_id=user_a["workspace"].id,
                             email="bob@test.com", role="editor",
                             inviter_id=user_a["user"].id,
                             token="expired-token",
                             expires_at=datetime.now(timezone.utc) - timedelta(days=1))
    session.add(invite)
    session.commit()
    resp = client.post("/api/v1/invites/expired-token/accept",
                       headers=user_b["headers"])
    assert resp.status_code == 410
```

**Step 2-5: Implement `_accept_pending_invites()` helper, call in register/login/OAuth callbacks. Add `send_workspace_invite_email()` template. Commit.**

```bash
git commit -m "feat: add auto-join on signup, invite token acceptance, invite email template"
```

---

## Task 12: Backend — Workspace Delete Cleanup + Full Test Pass

**Files:**
- Modify: `backend/app/routers/workspaces.py` — add workspaceinvite cleanup on delete

**Step 1: Write test**

```python
def test_delete_workspace_cleans_up_invites(client, user_a, user_b, session):
    # Create a second workspace so delete is allowed
    ws2 = _create_workspace(session, user_a["user"], "WS2")
    # Create invite for ws2
    from app.models.workspace import WorkspaceInvite
    invite = WorkspaceInvite(workspace_id=ws2.id, email="x@test.com",
                             role="editor", inviter_id=user_a["user"].id,
                             token="cleanup-token")
    session.add(invite)
    session.commit()
    resp = client.delete(f"/api/v1/workspaces/{ws2.id}", headers=user_a["headers"])
    assert resp.status_code == 200
    # Verify invite is gone
    remaining = session.exec(select(WorkspaceInvite).where(
        WorkspaceInvite.workspace_id == ws2.id)).all()
    assert len(remaining) == 0
```

**Step 2-5: Add DELETE FROM workspaceinvite to workspace delete. Run FULL backend suite. Fix any remaining failures. Commit.**

```bash
git commit -m "feat: cleanup workspace invites on delete, all backend RBAC tests pass"
```

---

## Task 13: Frontend — API Functions + WorkspaceContext

**Files:**
- Modify: `frontend/src/api/workspaces.js` — add member management functions
- Modify: `frontend/src/api/tasks.js` — fix `deleteAllTasks`
- Modify: `frontend/src/context/WorkspaceContext.jsx` — add members, currentUserRole
- Modify: `frontend/src/context/TaskContext.jsx` — always pass workspace_id

**Step 1: Write tests**

```javascript
// frontend/src/__tests__/contexts/WorkspaceContext.test.jsx — extend
it('exposes currentUserRole derived from members', async () => {
  api.fetchWorkspaces.mockResolvedValue({ data: [{ id: 1, name: 'WS', role: 'editor' }] })
  // ...render with TestConsumer checking currentUserRole === 'editor'
})
```

**Step 2-5: Implement API functions, update contexts, run `npx vitest run`. Commit.**

```bash
git commit -m "feat: add member API functions, currentUserRole to WorkspaceContext"
```

---

## Task 14: Frontend — InviteDialog + MemberList Components

**Files:**
- Create: `frontend/src/components/InviteDialog.jsx`
- Create: `frontend/src/components/MemberList.jsx`
- Create: `frontend/src/__tests__/components/InviteDialog.test.jsx`
- Create: `frontend/src/__tests__/components/MemberList.test.jsx`

**Step 1: Write tests first (render, form validation, API calls mocked)**

**Step 2-5: Build components, run vitest. Commit.**

```bash
git commit -m "feat: add InviteDialog and MemberList components"
```

---

## Task 15: Frontend — Permission Gating (Dashboard + TaskTable + TaskBoard)

**Files:**
- Modify: `frontend/src/components/Dashboard.jsx` — hide Add Task + NaturalLanguageInput for viewers
- Modify: `frontend/src/components/TaskTable.jsx` — hide actions column for viewers
- Modify: `frontend/src/components/TaskBoard.jsx` — remove DndContext for viewers
- Modify: `frontend/src/components/InlineEdit.jsx` — add `disabled` prop

**Step 1: Write tests**

```javascript
// Test that viewer sees no Add Task button
it('hides Add Task button for viewers', () => {
  // Mock currentUserRole = 'viewer'
  // Render Dashboard
  // Assert no "Add Task" button
})
```

**Step 2-5: Implement permission checks using `canEdit` pattern from design doc. Commit.**

```bash
git commit -m "feat: permission-gate Dashboard, TaskTable, TaskBoard for viewers"
```

---

## Task 16: Frontend — Permission Gating (Cards, Modal, Share, Columns)

**Files:**
- Modify: `frontend/src/components/TaskCard.jsx`
- Modify: `frontend/src/components/TaskModal.jsx`
- Modify: `frontend/src/components/ShareDialog.jsx` — hide for viewers + fix workspace_id
- Modify: `frontend/src/components/ColumnManager.jsx`

**Step 1-5: TDD cycle for each component. Commit.**

```bash
git commit -m "feat: permission-gate TaskCard, TaskModal, ShareDialog, ColumnManager"
```

---

## Task 17: Frontend — WorkspaceSwitcher Role Badge + Layout Members Button

**Files:**
- Modify: `frontend/src/components/WorkspaceSwitcher.jsx` — show role badge
- Modify: `frontend/src/components/Layout.jsx` — add Members button

**Step 1-5: TDD cycle. Commit.**

```bash
git commit -m "feat: add role badge to WorkspaceSwitcher, Members button to Layout"
```

---

## Task 18: Frontend — LoginPage Invite Token Handling

**Files:**
- Modify: `frontend/src/pages/LoginPage.jsx` — handle `?invite=<token>` param

**Step 1: Write test**

```javascript
it('accepts invite token after login', async () => {
  // Set URL to /login?invite=abc123
  // Mock login + acceptInvite API
  // Verify acceptInvite called with 'abc123'
})
```

**Step 2-5: Implement. Store invite token in sessionStorage, call accept after login. Commit.**

```bash
git commit -m "feat: handle invite token in LoginPage for email invite flow"
```

---

## Task 19: Full Test Suite + Fix Regressions

**Step 1: Run backend tests**

```bash
cd backend && python -m pytest tests/ -v
```

Fix any failures.

**Step 2: Run frontend tests**

```bash
cd frontend && npx vitest run
```

Fix any failures.

**Step 3: Run pre-commit hook**

```bash
.git/hooks/pre-commit
```

**Step 4: Commit fixes**

```bash
git commit -m "fix: resolve test regressions from RBAC implementation"
```

---

## Task 20: Final Commit + Cleanup

**Step 1: Verify all tests pass one final time**

**Step 2: Review changed files for any TODO comments or debug code**

**Step 3: Final commit**

```bash
git commit -m "feat: complete Level 1 RBAC workspace collaboration"
```

---

## Execution Order Summary

| Task | Description | Files | Risk |
|------|-------------|-------|------|
| 1 | WorkspaceRole Enum + WorkspaceMember fields | 1 | Low |
| 2 | WorkspaceInvite model + migration | 4 | Low |
| 3 | Permission dependencies + task list enforcement | 2 | **High** |
| 4 | Task read endpoints (GET) | 2 | **High** |
| 5 | Task write endpoints (POST/PATCH/DELETE) | 2 | **High** |
| 6 | Task bulk/copy-move/delete-all | 1 | Medium |
| 7 | Workspaces router (role response, owner-only update) | 2 | Medium |
| 8 | Other routers (columns, export, share, parse) | 4 | Medium |
| 9 | Member management router (invite, list) | 3 | Medium |
| 10 | Role change, remove, leave | 1 | Medium |
| 11 | Auto-join on signup + invite email | 2 | Medium |
| 12 | Workspace delete cleanup + full backend pass | 1 | Low |
| 13 | Frontend API + contexts | 4 | Medium |
| 14 | InviteDialog + MemberList | 4 | Low |
| 15 | Permission gating (Dashboard, Table, Board) | 4 | Medium |
| 16 | Permission gating (Card, Modal, Share, Columns) | 4 | Low |
| 17 | WorkspaceSwitcher badge + Layout Members button | 2 | Low |
| 18 | LoginPage invite token | 1 | Low |
| 19 | Full test suite regression fix | 0 | Medium |
| 20 | Final cleanup | 0 | Low |
