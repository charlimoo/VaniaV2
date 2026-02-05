# backend/agents/naming.py
import logging
from agno.agent import Agent, RunOutput
from agno.models.openai import OpenAIChat
from billing.services import process_usage_charge

logger = logging.getLogger(__name__)

class TitleGenerator:
    def __init__(self):
        # We use gpt-4o-mini for speed and cost-efficiency
        self.agent = Agent(
            model=OpenAIChat(id="gpt-4o"), # Suggest changing to gpt-4o-mini for cheaper titles
            description="You are a specialized assistant that generates short Persian titles.",
            instructions="Generate a concise Persian title (max 4 words) for the provided conversation context. Do not use quotes. Do not include 'Title:'. Just the Persian text. focus on the user intention rather than the instructions and results.",
            markdown=False, 
        )

    def generate_title(self, messages: list, user, session_id: str) -> str:
        """
        Generates a title and BILLS the user for the token usage.
        """
        if not messages:
            return "گفتگوی جدید"

        # Format history
        history_text = ""
        for msg in messages[:4]: 
            role = msg.get('role', 'unknown')
            content = msg.get('content', '')
            if isinstance(content, str):
                history_text += f"{role}: {content}\n"

        try:
            # 1. Run LLM
            response: RunOutput = self.agent.run(f"Generate a title for this conversation:\n\n{history_text}")
            
            # 2. Extract Title
            title = response.content.strip().strip('"')
            
            # 3. BILLING LOGIC
            if response.metrics:
                m = response.metrics
                # Handle dictionary or object access
                if hasattr(m, 'to_dict'):
                    metrics_data = m.to_dict()
                else:
                    metrics_data = m.__dict__

                input_t = metrics_data.get('input_tokens', metrics_data.get('prompt_tokens', 0))
                output_t = metrics_data.get('output_tokens', metrics_data.get('completion_tokens', 0))

                if input_t > 0 or output_t > 0:
                    try:
                        # process_usage_charge is synchronous, so we call it directly
                        process_usage_charge(
                            user=user, 
                            input_tokens=input_t, 
                            output_tokens=output_t, 
                            run_id=f"naming-{session_id}"
                        )
                        logger.info(f"💰 [Naming] Charged User {user.id} for title generation (I:{input_t}, O:{output_t})")
                    except Exception as billing_err:
                        logger.error(f"❌ [Naming] Billing failed: {billing_err}")

            return title

        except Exception as e:
            logger.error(f"⚠️ Title generation failed: {e}")
            return "گفتگوی جدید"

# Singleton
title_generator = TitleGenerator()