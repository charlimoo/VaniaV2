# agents/__init__.py
import logging

# Configure package-level logger
logger = logging.getLogger(__name__)
logger.debug("📦 [Agents] Package initialized.")

# Expose the router so it can be imported as `from agents import router`
from .routes import router

__all__ = ["router"]