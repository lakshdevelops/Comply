import os
import firebase_admin
from firebase_admin import credentials, auth as firebase_auth
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

# serviceAccount.json lives at the backend root (two levels up from here)
_BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
_SERVICE_ACCOUNT_PATH = os.path.join(_BASE_DIR, "serviceAccount.json")

bearer_scheme = HTTPBearer()


def ensure_firebase_initialized() -> None:
    """Lazily initialize Firebase Admin SDK on first use.

    This avoids a hard crash at import time when the serviceAccount.json
    file is not present (e.g. in CI, tests, or fresh clones before the
    credential file has been placed).
    """
    if firebase_admin._apps:
        return
    if not os.path.isfile(_SERVICE_ACCOUNT_PATH):
        raise HTTPException(
            status_code=500,
            detail="Firebase service-account credentials not configured.",
        )
    cred = credentials.Certificate(_SERVICE_ACCOUNT_PATH)
    firebase_admin.initialize_app(cred)


# Keep the private name for backwards compat
_ensure_firebase_initialized = ensure_firebase_initialized


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(bearer_scheme),
) -> dict:
    """
    FastAPI dependency that verifies the Firebase ID token sent in the
    Authorization: Bearer <token> header by the frontend.
    """
    _ensure_firebase_initialized()
    token = credentials.credentials
    try:
        return firebase_auth.verify_id_token(token)
    except firebase_auth.ExpiredIdTokenError:
        raise HTTPException(status_code=401, detail="Token has expired. Please sign in again.")
    except firebase_auth.InvalidIdTokenError:
        raise HTTPException(status_code=401, detail="Invalid token.")
    except Exception:
        raise HTTPException(status_code=401, detail="Authentication failed.")
