"""Firestore client — reuses Firebase Admin SDK from security.py."""
from google.cloud import firestore
from app.core.security import ensure_firebase_initialized


def get_db() -> firestore.Client:
    ensure_firebase_initialized()
    return firestore.Client()
