"""Database configuration and lightweight compatibility migrations."""

import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker


load_dotenv(dotenv_path=Path(__file__).resolve().parents[1] / ".env", override=False)

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is not set")

database_url = make_url(DATABASE_URL)
if database_url.query:
    database_url = database_url.set(query={})

engine = create_engine(
    database_url.render_as_string(hide_password=False),
    pool_pre_ping=True,
    pool_recycle=300,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def migrate_rental_return_fields():
   
    inspector = inspect(engine)
    if "rentals" not in inspector.get_table_names():
        return

    existing = {column["name"] for column in inspector.get_columns("rentals")}
    statements = []
    if "dateFinPrevue" not in existing:
        statements.append('ALTER TABLE rentals ADD COLUMN "dateFinPrevue" TIMESTAMP NULL')
    if "dateRetourReelle" not in existing:
        statements.append('ALTER TABLE rentals ADD COLUMN "dateRetourReelle" TIMESTAMP NULL')
    if "statut" not in existing:
        statements.append("ALTER TABLE rentals ADD COLUMN statut VARCHAR NOT NULL DEFAULT 'Active'")

    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))
        connection.execute(text(
            'UPDATE rentals SET "dateFinPrevue" = "dateFin" '
            'WHERE "dateFinPrevue" IS NULL AND "dateFin" IS NOT NULL'
        ))
        connection.execute(text(
            'UPDATE rentals SET "dateRetourReelle" = "updatedAt" '
            'WHERE "dateRetourReelle" IS NULL AND "kmFin" IS NOT NULL'
        ))
        connection.execute(text(
            """UPDATE rentals
               SET statut = CASE
                 WHEN ("dateRetourReelle" IS NOT NULL OR "kmFin" IS NOT NULL)
                      AND "dateFinPrevue" IS NOT NULL
                      AND "dateRetourReelle" > "dateFinPrevue"
                   THEN 'Retournée en retard'
                 WHEN ("dateRetourReelle" IS NOT NULL OR "kmFin" IS NOT NULL)
                   THEN 'Retournée à temps'
                 WHEN "dateFinPrevue" IS NOT NULL AND "dateFinPrevue"::date < CURRENT_DATE
                   THEN 'En retard'
                 ELSE 'Active'
               END"""
        ))


def migrate_car_display_fields():
   
    inspector = inspect(engine)
    if "cars" not in inspector.get_table_names():
        return

    existing = {column["name"] for column in inspector.get_columns("cars")}
    columns = {
        "photoUrl": "VARCHAR NULL",
        "annee": "INTEGER NULL",
        "carburant": "VARCHAR NULL",
        "transmission": "VARCHAR NULL",
        "nombrePlaces": "INTEGER NULL",
        "couleur": "VARCHAR NULL",
        "categorie": "VARCHAR NULL",
        "is_active": "BOOLEAN NOT NULL DEFAULT TRUE",
    }
    with engine.begin() as connection:
        for name, definition in columns.items():
            if name not in existing:
                connection.execute(text(f'ALTER TABLE cars ADD COLUMN "{name}" {definition}'))


def migrate_user_profile_fields():
    inspector = inspect(engine)
    if "users" not in inspector.get_table_names():
        return
    existing = {column["name"] for column in inspector.get_columns("users")}
    columns = {
        "age": "INTEGER NULL", "sexe": "VARCHAR NULL", "poste": "VARCHAR NULL",
        "photoUrl": "TEXT NULL", "last_login": "TIMESTAMPTZ NULL",
    }
    with engine.begin() as connection:
        for name, definition in columns.items():
            if name not in existing:
                connection.execute(text(f'ALTER TABLE users ADD COLUMN "{name}" {definition}'))
        last_login_column = next((column for column in inspector.get_columns("users") if column["name"] == "last_login"), None)
        if last_login_column is not None and not getattr(last_login_column["type"], "timezone", False):
            connection.execute(text(
                'ALTER TABLE users ALTER COLUMN "last_login" TYPE TIMESTAMPTZ '
                'USING "last_login" AT TIME ZONE \'UTC\''
            ))


def migrate_renter_contact_fields():
    """Add optional renter contact fields without changing existing API routes."""
    inspector = inspect(engine)
    if "renters" not in inspector.get_table_names():
        return
    existing = {column["name"] for column in inspector.get_columns("renters")}
    columns = {
        "telephone": "VARCHAR NULL",
        "email": "VARCHAR NULL",
        "cin": "VARCHAR NULL",
        "ville": "VARCHAR NULL",
        "photoUrl": "TEXT NULL",
        "is_active": "BOOLEAN NOT NULL DEFAULT TRUE",
    }
    with engine.begin() as connection:
        for name, definition in columns.items():
            if name not in existing:
                connection.execute(text(f'ALTER TABLE renters ADD COLUMN "{name}" {definition}'))
        connection.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_renters_is_active ON renters (is_active)"
        ))


def migrate_payment_delete_rules():
   
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    if not {"payments", "rentals", "users"}.issubset(tables):
        return
    with engine.begin() as connection:
        connection.execute(text(
            "ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_rental_id_fkey"
        ))
        connection.execute(text(
            "ALTER TABLE payments ADD CONSTRAINT payments_rental_id_fkey "
            "FOREIGN KEY (rental_id) REFERENCES rentals(id) ON DELETE CASCADE"
        ))
        connection.execute(text(
            "ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_created_by_fkey"
        ))
        connection.execute(text(
            "ALTER TABLE payments ADD CONSTRAINT payments_created_by_fkey "
            "FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL"
        ))


def get_db():
   
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
