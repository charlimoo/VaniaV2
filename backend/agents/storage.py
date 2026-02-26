# agents/storage.py
import logging
from enum import Enum
from typing import Optional, Any
from functools import lru_cache

from django.conf import settings
from agno.db.postgres import PostgresDb
from agno.db.sqlite import SqliteDb
from agno.agent import AgentSession

# Setup Logger
logger = logging.getLogger(__name__)


class SessionType(str, Enum):
    AGENT = "agent"

# Constants
TABLE_NAME = "agent_sessions"

@lru_cache(maxsize=1)
def get_storage():
    """
    Factory function to return the correct Storage Engine based on Django settings.
    This ensures all parts of the app use the exact same DB configuration.
    """
    db_conn_str = getattr(settings, "DATABASE_CONNECTION_STRING", "")
    
    if "sqlite" in db_conn_str:
        # SQLite Logic
        # Remove 'sqlite:///' prefix if present to get the actual file path
        db_file_path = db_conn_str.replace("sqlite:///", "")
        
        logger.debug(f"💽 [Storage] Initializing SQLite Storage: {db_file_path} (Table: {TABLE_NAME})")
        return SqliteDb(
            db_file=db_file_path, 
            session_table=TABLE_NAME
        )
    else:
        # Postgres Logic
        # We generally assume if it's not SQLite, it's Postgres-compatible
        logger.debug(f"🐘 [Storage] Initializing Postgres Storage (Table: {TABLE_NAME})")
        return PostgresDb(
            db_url=db_conn_str, 
            session_table=TABLE_NAME
        )

def get_session_safe(storage: Any, session_id: str, user_id: str) -> Optional[AgentSession]:
    """
    Retrieves a session from storage with strict security checks.
    
    1. Tries to fetch using Agno v2 signature.
    2. Falls back to Agno v1 signature if TypeError occurs.
    3. Verifies the session belongs to the requesting 'user_id'.
    """
    logger.debug(f"🔍 [Storage] Fetching Session {session_id} for User {user_id}")
    
    try:
        session = None
        
        # Method 1: Agno v2 (requires session_type)
        if hasattr(storage, 'get_session'):
            try:
                session = storage.get_session(session_id=session_id, session_type=SessionType.AGENT)
            except TypeError:
                # Method 2: Agno Legacy (no session_type)
                logger.debug(f"   [Storage] 'get_session' TypeError. Retrying without session_type...")
                session = storage.get_session(session_id=session_id)
        
        if not session:
            logger.warning(f"⚠️ [Storage] Session {session_id} not found in DB.")
            return None

        # Security Check
        # Handle both object attributes and dictionary access depending on serialization
        session_user_id = None
        if hasattr(session, "user_id"):
            session_user_id = str(session.user_id)
        elif isinstance(session, dict):
            session_user_id = str(session.get("user_id"))
            
        # Allow if session has no user (public) or matches user
        if session_user_id is None or session_user_id == "None" or session_user_id == str(user_id):
            logger.debug(f"✅ [Storage] Session found and authorized.")
            return session
        else:
            logger.error(f"⛔ [Storage] Unauthorized Access! Session Owner: {session_user_id} vs Requestor: {user_id}")
            return None

    except Exception as e:
        logger.error(f"❌ [Storage] Critical error fetching session: {e}", exc_info=True)
        return None
