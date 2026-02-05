# backend/agents/ops.py
import os
import base64
import logging
from django.conf import settings

logger = logging.getLogger("agno.ops")

_is_initialized = False

def init_observability():
    """
    Initializes OpenTelemetry with Langfuse Exporter and Agno Instrumentation.
    """
    global _is_initialized
    if _is_initialized:
        return

    if not settings.LANGFUSE_ENABLED:
        logger.info("ℹ️ Observability (Langfuse) is disabled via settings.")
        return

    if not (settings.LANGFUSE_PUBLIC_KEY and settings.LANGFUSE_SECRET_KEY):
        logger.warning("⚠️ Langfuse keys missing. Observability skipped.")
        return

    try:
        from opentelemetry import trace as trace_api
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor
        from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
        from openinference.instrumentation.agno import AgnoInstrumentor

        # 1. Construct Auth Header for Langfuse
        # Langfuse expects Basic Auth with PK as username and SK as password
        credentials = f"{settings.LANGFUSE_PUBLIC_KEY}:{settings.LANGFUSE_SECRET_KEY}"
        auth_token = base64.b64encode(credentials.encode()).decode()
        
        endpoint = f"{settings.LANGFUSE_HOST}/api/public/otel"

        # 2. Configure Environment Variables for OTLP Exporter
        # The OTLPSpanExporter reads these by default
        os.environ["OTEL_EXPORTER_OTLP_ENDPOINT"] = endpoint
        os.environ["OTEL_EXPORTER_OTLP_HEADERS"] = f"Authorization=Basic {auth_token}"

        # 3. Setup Tracer Provider
        tracer_provider = TracerProvider()
        # Use BatchSpanProcessor for better performance in production than SimpleSpanProcessor
        tracer_provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter()))
        trace_api.set_tracer_provider(tracer_provider)

        # 4. Auto-Instrument Agno
        # This monkey-patches Agno agents to emit traces automatically
        AgnoInstrumentor().instrument()

        _is_initialized = True
        logger.info(f"✅ Langfuse Observability initialized (Target: {endpoint})")

    except ImportError as e:
        logger.error(f"❌ Failed to import Observability dependencies: {e}")
        logger.error("👉 Run: pip install langfuse opentelemetry-sdk opentelemetry-exporter-otlp openinference-instrumentation-agno")
    except Exception as e:
        logger.error(f"❌ Failed to initialize Observability: {e}")