# backend/billing/utils.py
from decimal import Decimal, ROUND_HALF_UP
from .models import BillingConfig

def calculate_credit_cost(input_tokens: int, output_tokens: int) -> Decimal:
    """
    Converts token usage into System Credits based on Database Configuration.
    """
    total_tokens = Decimal(input_tokens + output_tokens)
    
    # [CHANGED] Load from Singleton DB Record
    config = BillingConfig.load()
    tokens_per_credit = Decimal(config.tokens_per_credit)

    if tokens_per_credit == 0:
        return Decimal(0)
        
    raw_cost = total_tokens / tokens_per_credit
    return raw_cost.quantize(Decimal("1.0000000000"), rounding=ROUND_HALF_UP)