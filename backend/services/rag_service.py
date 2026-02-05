import os
import re
import requests
import tempfile
import logging
from pathlib import Path
from django.conf import settings
from .models import KnowledgeDocument

# --- Agno Imports ---
from agno.knowledge.knowledge import Knowledge
from agno.vectordb.qdrant import Qdrant
from agno.knowledge.embedder.openai import OpenAIEmbedder
from agno.knowledge.reader.pdf_reader import PDFReader
from agno.knowledge.reader.text_reader import TextReader

logger = logging.getLogger(__name__)

def get_sanitized_table_name(name: str) -> str:
    clean = re.sub(r'[^a-zA-Z0-9_]', '_', name.lower())
    return f"kb_{clean}"

class RAGIngestionService:
    
    @staticmethod
    def process_document(document_id: int):
        try:
            doc = KnowledgeDocument.objects.get(id=document_id)
        except KnowledgeDocument.DoesNotExist:
            logger.error(f"❌ [RAG] Document ID {document_id} not found.")
            return

        logger.info(f"🚀 [RAG] Starting ingestion for: {doc.file.name}")
        
        doc.status = KnowledgeDocument.Status.PROCESSING
        doc.save(update_fields=['status'])

        source_path = None
        is_temp_file = False

        try:
            # 1. Resolve File Path (Local vs S3/MinIO)
            try:
                # Attempt to get local filesystem path
                source_path = Path(doc.file.path).resolve()
            except NotImplementedError:
                # File is on S3/MinIO
                logger.info(f"   -> Downloading from storage: {doc.file.url}")
                
                # Get extension
                fname = doc.file.name.split('/')[-1]
                ext = Path(fname).suffix or ".txt"
                
                # Create a temp file
                # delete=False is required so we can close it and let Agno open it by path
                temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=ext)
                
                # Download content properly
                # If using signed URLs (AWS_QUERYSTRING_AUTH=True), use requests
                # If internal, we can also use doc.file.open() to be storage-agnostic
                with doc.file.open('rb') as f:
                    temp_file.write(f.read())
                
                temp_file.close()
                source_path = Path(temp_file.name)
                is_temp_file = True
            
            # 2. Select Reader
            ext = source_path.suffix.lower()
            reader = None
            if ext == '.pdf':
                reader = PDFReader(chunk=True)
            elif ext in ['.txt', '.md', '.csv', '.json', '.py']:
                reader = TextReader(chunk=True)
            else:
                # Fallback for unknown text files
                reader = TextReader(chunk=True)

            # 3. Setup Vector Database
            collection_name = get_sanitized_table_name(doc.knowledge_base.name)
            
            vector_db = Qdrant(
                collection=collection_name,
                url=settings.QDRANT_URL,
                api_key=settings.QDRANT_API_KEY,
                embedder=OpenAIEmbedder(id="text-embedding-3-small"),
            )

            # 4. Initialize Knowledge
            # We don't pass 'storage', so Agno will warn "Contents DB not found".
            # This is expected and harmless as Django tracks the document state.
            knowledge = Knowledge(vector_db=vector_db)

            # 5. Ingest
            logger.info(f"   -> Chunking & Embedding into '{collection_name}'...")
            knowledge.add_content(
                path=source_path, 
                reader=reader
            )

            # 6. Success
            doc.status = KnowledgeDocument.Status.COMPLETED
            doc.error_message = ""
            doc.save(update_fields=['status', 'error_message'])
            logger.info(f"✅ [RAG] Ingestion Complete for: {doc.file.name}")

        except Exception as e:
            logger.error(f"❌ [RAG] Ingestion Failed: {e}", exc_info=True)
            doc.status = KnowledgeDocument.Status.FAILED
            doc.error_message = str(e)
            doc.save(update_fields=['status', 'error_message'])
        
        finally:
            # 7. Guaranteed Cleanup
            # This runs whether the task succeeds OR fails
            if is_temp_file and source_path and os.path.exists(source_path):
                try:
                    os.remove(source_path)
                    logger.info("   -> Temp file cleaned up.")
                except OSError as e:
                    logger.warning(f"   -> Failed to delete temp file: {e}")