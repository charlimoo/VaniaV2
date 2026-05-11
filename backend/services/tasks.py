# backend/services/tasks.py
import logging
import time
from celery import shared_task
from django.utils import timezone
from datetime import timedelta

from .models import KnowledgeDocument
from .rag_service import RAGIngestionService

# [REMOVED] Mem0 Import

logger = logging.getLogger("celery.services")

@shared_task(name="services.tasks.ingest_document", bind=True)
def ingest_document_task(self, document_id: int):
    """
    Background Celery task to process an uploaded document for RAG.
    """
    start_time = time.time()
    task_id = self.request.id
    
    logger.info(f"🚀 [Task:{task_id}] Starting ingestion for Doc ID: {document_id}")

    try:
        # Call the detailed service logic
        result = RAGIngestionService.process_document(document_id)
        
        duration = time.time() - start_time
        logger.info(f"✅ [Task:{task_id}] Finished in {duration:.2f}s. Result: {result}")
        return f"Success: {result}"

    except Exception as e:
        logger.error(f"❌ [Task:{task_id}] Critical Failure for Doc {document_id}: {e}", exc_info=True)
        # We re-raise so Celery marks the task as FAILED in its own backend
        raise e

@shared_task(name="services.tasks.check_expiring_plans")
def check_expiring_plans():
    """
    Deprecated no-op retained for compatibility with older Celery Beat entries.
    Plan ownership no longer expires by time.
    """
    logger.info("Skipping legacy check_expiring_plans task because plan expiry is disabled.")
    return "Plan expiry notifications skipped."

@shared_task(name="services.tasks.reset_stuck_documents")
def reset_stuck_documents():
    """
    Run Hourly.
    Finds documents that have been 'PROCESSING' for > 1 hour and marks them FAILED.
    This prevents the UI from showing a permanent spinner if a worker crashed.
    """
    # Threshold: 1 hour ago
    threshold = timezone.now() - timedelta(hours=1)
    
    stuck_docs = KnowledgeDocument.objects.filter(
        status=KnowledgeDocument.Status.PROCESSING,
        updated_at__lt=threshold
    )
    
    count = 0
    for doc in stuck_docs:
        doc.status = KnowledgeDocument.Status.FAILED
        doc.error_message = "Processing timed out (Worker may have crashed)."
        doc.save(update_fields=['status', 'error_message'])
        count += 1
        
    if count > 0:
        logger.warning(f"⚠️ [RAG] Reset {count} stuck documents.")
        
    return f"Reset {count} stuck documents."

# [REMOVED] save_memory_task definition
