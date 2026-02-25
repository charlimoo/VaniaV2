# agents/schemas.py
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field

class SessionCreate(BaseModel):
    """
    Schema for creating a new chat session manually.
    """
    session_id: str = Field(..., description="Unique identifier for the session (UUID)")
    session_name: Optional[str] = Field("New Conversation", description="Display name for the chat")
    session_state: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Initial state payload")

class SessionUpdate(BaseModel):
    """
    Schema for updating session metadata (renaming).
    """
    session_name: Optional[str] = Field(None, description="New display name for the session")
    session_state: Optional[Dict[str, Any]] = Field(default=None, description="Partial session state patch")
