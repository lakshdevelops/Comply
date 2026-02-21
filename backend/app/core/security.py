import os
import firebase_admin
from firebase_admin import credentials, auth as firebase_auth
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

# serviceAccount.json lives at the backend root (two levels up from here)
_BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))

if not firebase_admin._apps:
    cred = credentials.Certificate(os.path.join(_BASE_DIR, "serviceAccount.json"))
    firebase_admin.initialize_app(cred)

bearer_scheme = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(bearer_scheme),
) -> dict:
    """
    FastAPI dependency that verifies the Firebase ID token sent in the
    Authorization: Bearer <token> header by the frontend.
    """
    token = credentials.credentials
    try:
        return firebase_auth.verify_id_token(token)
    except firebase_auth.ExpiredIdTokenError:
        raise HTTPException(status_code=401, detail="Token has expired. Please sign in again.")
    except firebase_auth.InvalidIdTokenError:
        raise HTTPException(status_code=401, detail="Invalid token.")
    except Exception:
        raise HTTPException(status_code=401, detail="Authentication failed.")
