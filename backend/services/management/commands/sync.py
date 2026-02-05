from django.core.management.base import BaseCommand
from definitions.sync import DefinitionSync
from capabilities.registry import CapabilityRegistry
import logging

class Command(BaseCommand):
    help = 'Synchronize static definitions (Plans, Agents, Config) to the Database'

    def handle(self, *args, **options):
        # Configure logging to show up in Docker logs
        logger = logging.getLogger('django')
        
        self.stdout.write(self.style.WARNING('🔄 [Sync] Starting definition synchronization...'))
        
        try:
            # 1. Sync Core Definitions (DB Transaction handled inside)
            DefinitionSync.sync_all()
            
            # 2. Sync Capabilities
            CapabilityRegistry.autodiscover()
            CapabilityRegistry.sync_to_db()
            
            self.stdout.write(self.style.SUCCESS('✅ [Sync] Definitions synchronized successfully.'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'❌ [Sync] Failed: {e}'))
            # We exit with error code 1 to stop the container startup if sync fails
            import sys
            sys.exit(1)