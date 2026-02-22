"""Firestore client — reuses Firebase Admin SDK from security.py."""
from firebase_admin import firestore
from app.core.security import ensure_firebase_initialized


def get_db():
    ensure_firebase_initialized()
    return firestore.client()
