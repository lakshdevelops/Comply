import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
    GITHUB_CLIENT_ID: str = os.getenv("GITHUB_CLIENT_ID", "")
    GITHUB_CLIENT_SECRET: str = os.getenv("GITHUB_CLIENT_SECRET", "")
    GITHUB_REDIRECT_URI: str = os.getenv("GITHUB_REDIRECT_URI", "http://localhost:8000/api/v1/github/callback")
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./comply.db")
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:3000")
    # Miro OAuth + MCP
    MIRO_CLIENT_ID: str = os.getenv("MIRO_CLIENT_ID", "3458764660706404976")
    MIRO_CLIENT_SECRET: str = os.getenv("MIRO_CLIENT_SECRET", "F9K8AcKSmtKxQVpLF72m4bCVGTPPjq9b")
    MIRO_REDIRECT_URI: str = os.getenv("MIRO_REDIRECT_URI", "http://localhost:8000/api/v1/miro/callback")
    MIRO_MCP_ENDPOINT: str = os.getenv("MIRO_MCP_ENDPOINT", "https://mcp.miro.com/")

settings = Settings()
