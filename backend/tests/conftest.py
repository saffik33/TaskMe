from contextlib import asynccontextmanager

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

import app.database as db_module
from app.database import get_session, seed_core_columns_for_workspace
from app.main import app
from app.auth import hash_password, create_access_token
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMember

# Import all models so metadata is populated
from app.models import task, column_config, share  # noqa: F401
from app.models import agent_binding  # noqa: F401

test_engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

# Replace lifespan with a no-op so PostgreSQL migrations don't run on SQLite
@asynccontextmanager
async def _test_lifespan(app):
    yield

app.router.lifespan_context = _test_lifespan


@pytest.fixture(autouse=True)
def setup_db():
    """Create all tables before each test, drop after.
    Patches the app's engine so lifespan migrations use the test DB."""
    original_engine = db_module.engine
    db_module.engine = test_engine

    SQLModel.metadata.create_all(test_engine)
    yield
    SQLModel.metadata.drop_all(test_engine)

    db_module.engine = original_engine


@pytest.fixture
def session():
    with Session(test_engine) as s:
        yield s


@pytest.fixture
def client(session):
    """TestClient with overridden DB session."""
    def _get_session_override():
        yield session

    app.dependency_overrides[get_session] = _get_session_override
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c
    app.dependency_overrides.clear()


def _create_user(session, username="testuser", email="test@test.com", verified=True):
    """Helper to create a user directly in the DB."""
    user = User(
        username=username,
        email=email,
        hashed_password=hash_password("Test1234"),
        email_verified=verified,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def _create_workspace(session, user, name="Test Workspace"):
    """Helper to create a workspace with member + seeded columns."""
    ws = Workspace(name=name, owner_id=user.id)
    session.add(ws)
    session.commit()
    session.refresh(ws)
    member = WorkspaceMember(workspace_id=ws.id, user_id=user.id, role="owner")
    session.add(member)
    session.commit()
    seed_core_columns_for_workspace(session, ws.id, user.id)
    return ws


def _add_member(session, workspace, user, role="editor"):
    """Add a user as a member of a workspace with the given role."""
    member = WorkspaceMember(workspace_id=workspace.id, user_id=user.id, role=role)
    session.add(member)
    session.commit()
    seed_core_columns_for_workspace(session, workspace.id, user.id)
    return member


def _auth_headers(user):
    """Generate Bearer auth headers for a user."""
    token = create_access_token(data={"sub": user.username, "user_id": user.id})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def user_a(session):
    """Verified user A with a workspace."""
    user = _create_user(session, "alice", "alice@test.com")
    ws = _create_workspace(session, user, "Alice Workspace")
    return {"user": user, "workspace": ws, "headers": _auth_headers(user)}


@pytest.fixture
def user_b(session):
    """Verified user B with a workspace."""
    user = _create_user(session, "bob", "bob@test.com")
    ws = _create_workspace(session, user, "Bob Workspace")
    return {"user": user, "workspace": ws, "headers": _auth_headers(user)}


@pytest.fixture
def user_c(session):
    """Verified user C (no workspace of their own — used for viewer testing)."""
    user = _create_user(session, "charlie", "charlie@test.com")
    return {"user": user, "headers": _auth_headers(user)}
