# backend/vania_core/management/commands/seed_vania_knowledge.py
import logging
from django.core.management.base import BaseCommand
from django.core.files.base import ContentFile
from services.models import KnowledgeBase, KnowledgeDocument, AgentService
from services.rag_service import RAGIngestionService

# ==============================================================================
# == THE CLINICAL REFERENCE CONTENT
# ==============================================================================
# This content mirrors the Appendices from the System Prompt. It serves as the
# ground truth for the RAG system, ensuring the agent provides consistent and
# accurate information during Phase 2 (Approach Proposal) and Phase 3 (Definition).

VANIA_KNOWLEDGE_CONTENT = """
# Vania Clinical Protocol Reference Manual

## 1. The 6-Phase Therapy Protocol Overview
This is the core operational flow for the Vania system.

1.  **PHASE 1: ANALYSIS (تحلیل)**: Goal is to create a comprehensive psychological profile from demographics and projective tests (TAT, Rorschach).
2.  **PHASE 2: APPROACH PROPOSAL (پیشنهاد رویکرد)**: Based on analysis, propose 17 therapeutic approaches (10 Modern, 5 Hybrid, 2 Integrative).
3.  **PHASE 3: SELECTION & DEFINITION (انتخاب و تعریف)**: Deep dive into the doctor's selected approaches, providing theoretical basis and a bank of 15+ techniques.
4.  **PHASE 4: PROTOCOL DESIGN (طراحی پروتکل)**: Create a step-by-step execution guide for selected techniques for upcoming sessions.
5.  **PHASE 5: EXECUTION (اجرا و گزارش)**: Manage the active session, guide the doctor, and create the formal 'Session Support Document' (سند پشتیبان).
6.  **PHASE 6: APPENDIX (پیوست اندیشه)**: Prescribe relevant cultural resources like books, films, and poems.

---

## 2. Master List of Therapeutic Approaches (Reference for Phase 2)
This list is the primary source for the agent when proposing treatment options.

### Core Approaches:
1.  Psychoanalysis (روانکاوی)
2.  Cognitive Therapy (شناختی)
3.  Behavioral Therapy (رفتاری)
4.  Humanistic Therapy (انسان‌گرایانه)
5.  Dialectical Behavior Therapy (DBT - دیالکتیکی)
6.  Cognitive Behavioral Therapy (CBT - شناختی-رفتاری)
7.  Acceptance and Commitment Therapy (ACT - پذیرش و تعهد)
8.  Mindfulness-Based Cognitive Therapy (MBCT - ذهن‌آگاهی)
9.  Compassion-Focused Therapy (CFT - شفقت‌درمانی)
10. Schema Therapy (طرحواره‌درمانی)
11. Rational Emotive Behavior Therapy (REBT - عقلانی-هیجانی)
12. Reality Therapy (واقعیت درمانی)

### Analytical & Depth Approaches:
13. Analytical Psychology (روانشناسی تحلیلی)
14. Philosophical Counseling (مشاوره فلسفی)
15. Social Therapy (درمان اجتماعی)
16. Critical Hermeneutics (هرمنوتیک انتقادی)
17. Jungian Analysis (تحلیل و درمان یونگی)
18. Emotion-Focused Therapy (EFT - هیجان‌مدار)
19. Gestalt Therapy (گشتالت درمانی)
20. Existential Therapy (درمان وجودی - اگزیستانسیالیستی)
21. Neuro-Linguistic Programming (NLP - برنامه‌ریزی عصبی-کلامی)

### Family & Interpersonal Approaches:
22. Couples Therapy (زوج درمانی)
23. Family Systems Therapy (خانواده درمانی سیستمی)
24. Marriage Counseling (مشاوره ازدواج)
25. Transactional Analysis (TA - تحلیل رفتار متقابل)
26. Structural Family Therapy (خانواده درمانی ساختاری)
27. Strategic Family Therapy (خانواده درمانی استراتژیک)
28. Systemic Therapy (رویکرد سیستمی)
29. Narrative Therapy (روایت درمانی)

---

## 3. The "Rescue Net" (Tour-e Nejat) Framework
Tasks assigned to patients must be categorized into one of these nine dimensions:
1.  **Personal Growth (رشد شخصی):** Self-awareness, new habits, skill development.
2.  **Beneficial Relationships (رشد ارتباط سودمند):** Family, partner, mentorship.
3.  **Career/Education (رشد شغلی-تحصیلی):** Work-life balance, learning goals.
4.  **Emotional Growth (رشد عاطفی):** Emotional regulation, expression, and understanding.
5.  **Intellectual Growth (رشد فکری):** Reading, critical thinking, exploring new ideas.
6.  **Friendships (رشد ارتباط با دوستان):** Maintaining and building a social support circle.
7.  **Environmental Growth (رشد محیطی):** Improving one's living/working space, connecting with nature.
8.  **Managing Solitude (رشد تنهایی):** Healthy solitude, meditation, self-reflection.
9.  **Recreation/Health (رشد تفریحی-ورزشی):** Physical health, hobbies, and leisure.

---

## 4. Key Definitions & Standards (APA/WHO)
-   **Mental Health (WHO Definition):** A state of well-being in which an individual realizes his or her own abilities, can cope with the normal stresses of life, can work productively, and is able to make a contribution to his or her community.
-   **Evidence-Based Practice (EBP - APA Definition):** The integration of the best available research with clinical expertise in the context of patient characteristics, culture, and preferences.
"""

class Command(BaseCommand):
    """
    A Django management command to seed the Vania Clinical Knowledge Base.
    This command creates a dedicated knowledge base, populates it with the
    Vania Protocol Reference Manual, triggers the RAG ingestion process,
    and links the resulting knowledge base to the Vania Doctor Agent.
    
    Usage: python manage.py seed_vania_knowledge
    """
    help = 'Seeds the Vania Clinical Knowledge Base into the existing RAG system.'

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING('🚀 Starting Vania Knowledge Base Seeding...'))

        # --- Step 1: Create or Get the KnowledgeBase ---
        kb_name = "Vania Clinical Core"
        kb, created = KnowledgeBase.objects.get_or_create(
            name=kb_name,
            defaults={"description": "Core protocols, therapeutic approach lists, and clinical definitions for the Vania Doctor Agent."}
        )

        if created:
            self.stdout.write(self.style.SUCCESS(f'   -> Created Knowledge Base: "{kb_name}"'))
        else:
            self.stdout.write(self.style.NOTICE(f'   -> Found existing Knowledge Base: "{kb_name}"'))

        # --- Step 2: Create the KnowledgeDocument ---
        file_name = "vania_protocol_reference_v1.md"
        file_content = ContentFile(VANIA_KNOWLEDGE_CONTENT.encode('utf-8'))
        
        # Check if a document with this content already exists to prevent duplicates
        if not KnowledgeDocument.objects.filter(knowledge_base=kb, file__contains=file_name).exists():
            doc = KnowledgeDocument.objects.create(
                knowledge_base=kb,
                status=KnowledgeDocument.Status.PENDING
            )
            doc.file.save(file_name, file_content)
            doc.save()
            
            self.stdout.write(self.style.SUCCESS(f'   -> Created reference document: {file_name}'))

            # --- Step 3: Trigger the RAG Ingestion Process ---
            self.stdout.write(self.style.WARNING('   -> Triggering RAG Ingestion Service... This may take a moment.'))
            try:
                # We call the service directly. In a production environment with Celery,
                # you would dispatch a task: ingest_document_task.delay(doc.id)
                RAGIngestionService.process_document(doc.id)
                self.stdout.write(self.style.SUCCESS('   -> ✅ Ingestion Complete.'))
            except Exception as e:
                self.stdout.write(self.style.ERROR(f'   -> ❌ Ingestion Failed: {e}'))
                # If ingestion fails, we might want to stop here.
                return
        else:
            self.stdout.write(self.style.NOTICE('   -> Reference document already exists. Skipping ingestion.'))

        # --- Step 4: Link the KnowledgeBase to the AgentService ---
        try:
            agent = AgentService.objects.get(slug="vania-doctor-assistant")
            if not agent.knowledge_bases.filter(pk=kb.pk).exists():
                agent.knowledge_bases.add(kb)
                agent.save()
                self.stdout.write(self.style.SUCCESS(f'   -> Linked "{kb_name}" to Agent "vania-doctor-assistant"'))
            else:
                self.stdout.write(self.style.NOTICE(f'   -> Knowledge base already linked to agent.'))
        except AgentService.DoesNotExist:
            self.stdout.write(self.style.ERROR('   -> ⚠️ Agent "vania-doctor-assistant" not found. Please run agent sync first before seeding.'))

        self.stdout.write(self.style.SUCCESS('✨ Vania knowledge seeding process finished successfully.'))