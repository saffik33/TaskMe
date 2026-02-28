from typing import Annotated

from fastapi import Depends
from sqlalchemy import inspect, text
from sqlmodel import Session, SQLModel, create_engine, select

from .config import settings

def _build_engine():
    url = settings.DATABASE_URL
    kwargs = {}
    if url.startswith("sqlite"):
        kwargs["connect_args"] = {"check_same_thread": False}
    else:
        kwargs["pool_size"] = 10
        kwargs["max_overflow"] = 20
        kwargs["pool_timeout"] = 30
        kwargs["pool_recycle"] = 1800
        kwargs["pool_pre_ping"] = True
    return create_engine(url, **kwargs)


engine = _build_engine()


def check_database_url():
    """Re-read DATABASE_URL from OS env for Railway compatibility."""
    import os
    import logging
    logger = logging.getLogger(__name__)
    db_url = os.getenv("DATABASE_URL", "")
    logger.info("DATABASE_URL from env: %s", "SET" if db_url else "NOT SET")
    logger.info("DATABASE_URL from settings: %s", "postgresql" if "postgresql" in settings.DATABASE_URL else "sqlite")
    if db_url and db_url != settings.DATABASE_URL:
        settings.DATABASE_URL = db_url
        global engine
        engine = _build_engine()
        logger.info("Engine rebuilt with DATABASE_URL from environment")


def create_db_and_tables():
    # Import models so metadata is populated
    from .models import Task, SharedList, ColumnConfig, User  # noqa: F401
    SQLModel.metadata.create_all(engine)


def migrate_custom_fields_column():
    """Add custom_fields column to task table if it doesn't exist (one-time migration)."""
    inspector = inspect(engine)
    columns = [col["name"] for col in inspector.get_columns("task")]
    if "custom_fields" not in columns:
        with Session(engine) as session:
            session.exec(text("ALTER TABLE task ADD COLUMN custom_fields TEXT"))
            session.commit()


def migrate_add_user_support():
    """Add user_id column to existing tables if missing."""
    inspector = inspect(engine)
    existing_tables = inspector.get_table_names()

    ALLOWED_TABLES = {"task", "columnconfig", "sharedlist"}

    with Session(engine) as session:
        for table_name in ALLOWED_TABLES:
            if table_name in existing_tables:
                columns = [col["name"] for col in inspector.get_columns(table_name)]
                if "user_id" not in columns:
                    session.exec(text(
                        f'ALTER TABLE {table_name} ADD COLUMN user_id INTEGER REFERENCES "user"(id)'
                    ))

        # Drop old unique index on field_key alone (replaced by composite user_id+field_key)
        indexes = inspector.get_indexes("columnconfig")
        for idx in indexes:
            if idx["name"] == "ix_columnconfig_field_key" and idx.get("unique"):
                session.exec(text("DROP INDEX IF EXISTS ix_columnconfig_field_key"))
                break

        session.commit()


def migrate_assign_orphan_data():
    """Assign existing data (pre-auth) to a default admin user."""
    import secrets
    import logging

    from .models.user import User
    from .auth import hash_password

    logger = logging.getLogger(__name__)

    with Session(engine) as session:
        # Check if there are orphan tasks
        result = session.exec(text("SELECT COUNT(*) FROM task WHERE user_id IS NULL"))
        orphan_count = result.scalar()
        if orphan_count == 0:
            return

        # Check if admin user exists
        admin = session.exec(select(User).where(User.username == "admin")).first()
        if not admin:
            generated_password = secrets.token_urlsafe(16)
            admin = User(
                username="admin",
                email="admin@taskme.local",
                hashed_password=hash_password(generated_password),
            )
            session.add(admin)
            session.commit()
            session.refresh(admin)
            logger.warning(
                "Auto-created admin user with generated password: %s  "
                "CHANGE THIS PASSWORD IMMEDIATELY.",
                generated_password,
            )

        # Assign all orphan data to admin
        session.execute(text("UPDATE task SET user_id = :uid WHERE user_id IS NULL").bindparams(uid=admin.id))
        session.execute(text("UPDATE columnconfig SET user_id = :uid WHERE user_id IS NULL").bindparams(uid=admin.id))
        session.execute(text("UPDATE sharedlist SET user_id = :uid WHERE user_id IS NULL").bindparams(uid=admin.id))
        session.commit()


CORE_COLUMNS = [
    {"field_key": "task_name", "display_name": "Task Name", "field_type": "text", "position": 0, "is_core": True, "is_required": True},
    {"field_key": "description", "display_name": "Description", "field_type": "text", "position": 1, "is_core": True, "is_required": False},
    {"field_key": "owner", "display_name": "Owner", "field_type": "text", "position": 2, "is_core": True, "is_required": False},
    {"field_key": "email", "display_name": "Email", "field_type": "text", "position": 3, "is_core": True, "is_required": False},
    {"field_key": "start_date", "display_name": "Start Date", "field_type": "date", "position": 4, "is_core": True, "is_required": False},
    {"field_key": "due_date", "display_name": "Due Date", "field_type": "date", "position": 5, "is_core": True, "is_required": False},
    {"field_key": "status", "display_name": "Status", "field_type": "select", "position": 6, "is_core": True, "is_required": True,
     "options": '["To Do","In Progress","Done","Blocked"]'},
    {"field_key": "priority", "display_name": "Priority", "field_type": "select", "position": 7, "is_core": True, "is_required": True,
     "options": '["Low","Medium","High","Critical"]'},
]


def seed_core_columns_for_user(session: Session, user_id: int):
    """Insert core column configs for a specific user."""
    from .models.column_config import ColumnConfig

    existing = session.exec(
        select(ColumnConfig).where(ColumnConfig.user_id == user_id)
    ).all()
    existing_keys = {c.field_key for c in existing}

    for col_data in CORE_COLUMNS:
        if col_data["field_key"] not in existing_keys:
            col = ColumnConfig(**col_data, user_id=user_id, is_visible=True)
            session.add(col)

    session.commit()


def seed_core_columns():
    """Seed core columns for all existing users."""
    from .models.user import User

    with Session(engine) as session:
        users = session.exec(select(User)).all()
        for user in users:
            seed_core_columns_for_user(session, user.id)


def get_session():
    with Session(engine) as session:
        yield session


SessionDep = Annotated[Session, Depends(get_session)]
