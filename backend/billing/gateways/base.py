from abc import ABC, abstractmethod
from typing import Tuple, Optional

class PaymentGatewayBase(ABC):
    """
    Abstract Base Class for Payment Gateways (Strategy Pattern).
    Ensures all adapters (ZarinPal, Stripe, etc.) implement the required methods.
    """

    @abstractmethod
    def request_payment(self, invoice, callback_url: str) -> dict:
        """
        Request a payment token/url from the provider.
        
        Args:
            invoice: The Invoice model instance.
            callback_url: The absolute URL where the bank should redirect after payment.

        Returns:
            dict: {
                'url': 'https://bank-gateway.com/pay/...', 
                'authority': 'unique-transaction-token'
            }
        
        Raises:
            Exception: If communication with the gateway fails.
        """
        pass

    @abstractmethod
    def verify_payment(self, authority: str, amount_toman: int) -> Tuple[bool, Optional[str]]:
        """
        Verify the transaction success with the provider.

        Args:
            authority: The unique token received in the callback.
            amount_toman: The expected amount in Tomans (System Currency).

        Returns:
            Tuple[bool, str]: (is_success, reference_id)
        """
        pass