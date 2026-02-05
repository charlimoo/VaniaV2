# backend/capabilities/core/forms.py
from typing import Dict, Any
from capabilities.base import BaseFormHandler
from capabilities.registry import register_form_handler

@register_form_handler
class FeedbackHandler(BaseFormHandler):
    """
    Processes generic user feedback forms.
    Expects data like: {"rating": 5, "comment": "Great job!"}
    """
    label = "Core: Feedback Logger"

    def process(self, user, data: Dict[str, Any], session_id: str) -> Dict[str, Any]:
        # Extract data
        rating = data.get('rating')
        comment = data.get('comment', '')
        category = data.get('category', 'general')

        # In a real app, you would save this to a Feedback model
        print(f"📝 [Feedback] User: {user.email} | Rating: {rating} | Cat: {category}")
        print(f"   Comment: {comment}")

        # Return response to the agent/chat
        return {
            "action": "message",
            "content": f"Thank you! We received your {rating}-star feedback."
        }