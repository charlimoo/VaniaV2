# start of backend/users/services.py
# backend/users/services.py
from django.db import transaction
from .models import UserContextEntry, ContextDefinition

class ContextService:
    """
    Service to manage User Context (Structured Memory).
    Restored from Vania architecture to support Clinical Logs and Tasks.
    """

    @staticmethod
    def get_latest(user, key: str) -> dict | None:
        """
        Returns the raw data dictionary of the latest active entry for a specific key.
        """
        entry = UserContextEntry.objects.filter(
            user=user,
            definition__key=key,
            is_active=True
        ).order_by('-created_at').first()
        
        return entry.data if entry else None

    @staticmethod
    def get_context(user, key: str):
        """
        Returns the actual UserContextEntry object (not just data).
        Required by Vania services to perform updates via entry.save().
        """
        return UserContextEntry.objects.filter(
            user=user,
            definition__key=key,
            is_active=True
        ).order_by('-created_at').first()

    @staticmethod
    def get_full_profile(user) -> dict:
        """
        Returns a dictionary of ALL current active keys for a user.
        Ex: {'bio': {...}, 'preferences': {...}}
        """
        # Fetch all active entries
        entries = UserContextEntry.objects.filter(
            user=user, is_active=True
        ).select_related('definition').order_by('definition_id', 'created_at')
        
        # Merge logic: If multiple active entries exist for the same key,
        # later entries overwrite earlier ones in this dict.
        profile = {}
        for entry in entries:
            profile[entry.definition.key] = entry.data
            
        return profile

    @staticmethod
    def add_entry(user, key: str, data: dict, source='AGENT', creator=None):
        """
        Adds a new context entry (Append-only log).
        Useful for conversation history, events, or cumulative data (Clinical Logs).
        """
        # 1. Get or Create Definition
        definition, created = ContextDefinition.objects.get_or_create(
            key=key,
            defaults={'description': f'Auto-generated for {key}'}
        )

        # 2. Create Entry
        entry = UserContextEntry(
            user=user,
            definition=definition,
            data=data,
            source=source,
            created_by=creator,
            is_active=True
        )
        entry.save() 
        return entry

    @staticmethod
    def set_singleton_context(user, key: str, data: dict, source='AGENT', creator=None):
        """
        Sets a context entry as the ONLY active entry for this key.
        Previous entries for this key are archived (soft-deleted via is_active=False).
        Use this for User Profiles, Preferences, or Task Lists (where only the latest matters).
        """
        # 1. Get or Create Definition
        definition, _ = ContextDefinition.objects.get_or_create(
            key=key,
            defaults={'description': f'Auto-generated singleton for {key}'}
        )

        with transaction.atomic():
            # 2. Deactivate ALL existing active entries for this key
            UserContextEntry.objects.filter(
                user=user,
                definition=definition,
                is_active=True
            ).update(is_active=False)

            # 3. Create the new authoritative entry
            entry = UserContextEntry(
                user=user,
                definition=definition,
                data=data,
                source=source,
                created_by=creator,
                is_active=True
            )
            entry.save()

        return entry

    @staticmethod
    def get_history(user, key: str, limit=10):
        """
        Get timeline of changes for a specific key.
        Useful for retrieving Clinical History Logs.
        """
        return UserContextEntry.objects.filter(
            user=user,
            definition__key=key
        ).order_by('-created_at')[:limit]

# Singleton instance for easy import
user_context_manager = ContextService()
# end of backend/users/services.py