"""
Migrate data from SQLite to PostgreSQL for TaskMe.

Usage:
    python -m scripts.migrate_sqlite_to_postgres \
        --sqlite-url "sqlite:///./taskme.db" \
        --pg-url "postgresql://postgres:saffi@localhost:5432/TaskMe"

    python -m scripts.migrate_sqlite_to_postgres \
        --sqlite-url "sqlite:///./taskme.db" \
        --pg-url "postgresql://postgres:saffi@localhost:5432/TaskMe" \
        --verify

    python -m scripts.migrate_sqlite_to_postgres \
        --pg-url "postgresql://postgres:saffi@localhost:5432/TaskMe" \
        --rollback
"""
import argparse
import sys
from pathlib import Path

# Add parent directory to path so we can import app modules
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlmodel import Session, SQLModel, create_engine, select
from sqlalchemy import text

from app.models.user import User
from app.models.column_config import ColumnConfig
from app.models.task import Task
from app.models.share import SharedList

# Migration order respects foreign key dependencies
MODEL_ORDER = [User, ColumnConfig, Task, SharedList]


def migrate(sqlite_url: str, pg_url: str):
    print("=" * 60)
    print("TaskMe: SQLite -> PostgreSQL Migration")
    print("=" * 60)

    sqlite_engine = create_engine(sqlite_url, connect_args={"check_same_thread": False})
    pg_engine = create_engine(pg_url)

    # Create all tables in PostgreSQL
    print("\nCreating tables in PostgreSQL...")
    SQLModel.metadata.create_all(pg_engine)
    print("  Tables created.")

    for model in MODEL_ORDER:
        table_name = model.__tablename__
        print(f"\nMigrating '{table_name}'...")

        # Read all rows from SQLite
        with Session(sqlite_engine) as src:
            rows = src.exec(select(model)).all()

        if not rows:
            print(f"  -> 0 rows (empty table, skipping)")
            continue

        # Insert into PostgreSQL
        with Session(pg_engine) as dst:
            for row in rows:
                # Extract column data from the row
                data = {}
                for col in model.__table__.columns:
                    data[col.name] = getattr(row, col.name)
                new_row = model(**data)
                dst.add(new_row)
            dst.commit()

        # Reset PostgreSQL sequence to max(id) + 1
        # Quote table name for PostgreSQL reserved words (e.g., "user")
        quoted_table = f'"{table_name}"'
        with pg_engine.connect() as conn:
            result = conn.execute(text(f"SELECT MAX(id) FROM {quoted_table}"))
            max_id = result.scalar() or 0
            if max_id > 0:
                seq_name = f"{table_name}_id_seq"
                conn.execute(text(f"SELECT setval('{seq_name}', :val)"), {"val": max_id})
                conn.commit()

        print(f"  -> {len(rows)} rows migrated, sequence reset to {max_id}")

    print("\n" + "=" * 60)
    print("Migration complete!")
    print("=" * 60)


def verify(sqlite_url: str, pg_url: str):
    print("=" * 60)
    print("Verifying migration...")
    print("=" * 60)

    sqlite_engine = create_engine(sqlite_url, connect_args={"check_same_thread": False})
    pg_engine = create_engine(pg_url)

    all_match = True
    for model in MODEL_ORDER:
        table_name = model.__tablename__

        with Session(sqlite_engine) as src:
            sqlite_count = len(src.exec(select(model)).all())

        with Session(pg_engine) as dst:
            pg_count = len(dst.exec(select(model)).all())

        status = "OK" if sqlite_count == pg_count else "MISMATCH"
        if sqlite_count != pg_count:
            all_match = False

        print(f"  {table_name}: SQLite={sqlite_count}, PostgreSQL={pg_count} [{status}]")

    if all_match:
        print("\nAll tables match! Migration verified successfully.")
    else:
        print("\nWARNING: Some tables have mismatched counts!")
        sys.exit(1)


def rollback(pg_url: str):
    print("Dropping all tables from PostgreSQL...")
    pg_engine = create_engine(pg_url)
    SQLModel.metadata.drop_all(pg_engine)
    print("All tables dropped.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Migrate TaskMe data from SQLite to PostgreSQL")
    parser.add_argument("--sqlite-url", help="SQLite connection URL")
    parser.add_argument("--pg-url", required=True, help="PostgreSQL connection URL")
    parser.add_argument("--verify", action="store_true", help="Verify row counts match")
    parser.add_argument("--rollback", action="store_true", help="Drop all tables in PostgreSQL")
    args = parser.parse_args()

    if args.rollback:
        rollback(args.pg_url)
    elif args.verify:
        if not args.sqlite_url:
            print("ERROR: --sqlite-url required for verify")
            sys.exit(1)
        verify(args.sqlite_url, args.pg_url)
    else:
        if not args.sqlite_url:
            print("ERROR: --sqlite-url required for migration")
            sys.exit(1)
        migrate(args.sqlite_url, args.pg_url)
