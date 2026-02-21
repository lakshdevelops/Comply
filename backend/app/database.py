import sqlite3
import os

from app.core.config import settings

DATABASE_PATH = settings.DATABASE_URL.replace("sqlite:///", "")


def get_db() -> sqlite3.Connection:
    """Return a SQLite connection with Row factory and pragmas enabled."""
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db() -> None:
    """Create all tables if they do not already exist."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS scans (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            repo_url TEXT NOT NULL,
            repo_owner TEXT NOT NULL,
            repo_name TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS violations (
            id TEXT PRIMARY KEY,
            scan_id TEXT NOT NULL REFERENCES scans(id),
            rule_id TEXT NOT NULL,
            severity TEXT NOT NULL,
            file TEXT NOT NULL,
            line INTEGER,
            resource TEXT,
            field TEXT,
            current_value TEXT,
            description TEXT NOT NULL,
            regulation_ref TEXT NOT NULL
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS remediation_plans (
            id TEXT PRIMARY KEY,
            scan_id TEXT NOT NULL REFERENCES scans(id),
            violation_id TEXT NOT NULL REFERENCES violations(id),
            explanation TEXT NOT NULL,
            regulation_citation TEXT NOT NULL,
            what_needs_to_change TEXT NOT NULL,
            sample_fix TEXT,
            estimated_effort TEXT,
            priority TEXT NOT NULL,
            file TEXT NOT NULL,
            approved INTEGER NOT NULL DEFAULT 0
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS approved_fixes (
            id TEXT PRIMARY KEY,
            scan_id TEXT NOT NULL REFERENCES scans(id),
            violation_id TEXT NOT NULL REFERENCES violations(id),
            production_code TEXT,
            file TEXT NOT NULL,
            original_content TEXT,
            fixed_content TEXT
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS qa_results (
            id TEXT PRIMARY KEY,
            scan_id TEXT NOT NULL REFERENCES scans(id),
            iteration INTEGER NOT NULL,
            is_clean INTEGER NOT NULL,
            new_violations_json TEXT
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS pull_requests (
            id TEXT PRIMARY KEY,
            scan_id TEXT NOT NULL REFERENCES scans(id),
            pr_url TEXT NOT NULL,
            file TEXT NOT NULL,
            violation_count INTEGER NOT NULL,
            branch_name TEXT NOT NULL
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS reasoning_log (
            id TEXT PRIMARY KEY,
            scan_id TEXT NOT NULL REFERENCES scans(id),
            agent TEXT NOT NULL,
            action TEXT NOT NULL,
            output TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS github_tokens (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL UNIQUE,
            access_token TEXT NOT NULL,
            github_username TEXT,
            created_at TEXT NOT NULL
        )
    """)

    conn.commit()
    conn.close()
