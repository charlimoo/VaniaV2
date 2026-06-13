import logging
from dataclasses import dataclass
from typing import Any

import requests
from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)


class EsanjConfigurationError(RuntimeError):
    pass


class EsanjAPIError(RuntimeError):
    def __init__(self, message: str, status_code: int | None = None, payload: Any = None):
        super().__init__(message)
        self.status_code = status_code
        self.payload = payload


@dataclass(frozen=True)
class EsanjClientConfig:
    base_url: str
    username: str
    password: str
    timeout: int


class EsanjClient:
    token_cache_key = "esanj:api-token"

    def __init__(self, config: EsanjClientConfig | None = None):
        self.config = config or EsanjClientConfig(
            base_url=getattr(settings, "ESANJ_API_BASE_URL", "https://esanj.org/api/v1").rstrip("/"),
            username=getattr(settings, "ESANJ_API_USERNAME", ""),
            password=getattr(settings, "ESANJ_API_PASSWORD", ""),
            timeout=getattr(settings, "ESANJ_API_TIMEOUT_SECONDS", 30),
        )

    def _ensure_configured(self):
        if not self.config.username or not self.config.password:
            raise EsanjConfigurationError("Esanj API credentials are not configured.")

    def _url(self, path: str) -> str:
        return f"{self.config.base_url}/{path.lstrip('/')}"

    def _login(self) -> str:
        self._ensure_configured()
        response = requests.post(
            self._url("/login"),
            params={"username": self.config.username, "password": self.config.password},
            headers={"Accept": "application/json"},
            timeout=self.config.timeout,
        )
        payload = self._parse_response(response)
        token = payload.get("token") if isinstance(payload, dict) else None
        if not token:
            raise EsanjAPIError("Esanj login did not return a token.", response.status_code, payload)
        cache.set(self.token_cache_key, token, timeout=60 * 50)
        return token

    def _token(self, refresh: bool = False) -> str:
        if not refresh:
            token = cache.get(self.token_cache_key)
            if token:
                return token
        return self._login()

    def _headers(self, refresh: bool = False) -> dict[str, str]:
        return {
            "Accept": "application/json",
            "Authorization": f"Bearer {self._token(refresh=refresh)}",
        }

    def _request(self, method: str, path: str, *, retry_auth: bool = True, **kwargs) -> Any:
        extra_headers = kwargs.pop("headers", {})
        try:
            response = requests.request(
                method,
                self._url(path),
                headers={**self._headers(), **extra_headers},
                timeout=self.config.timeout,
                **kwargs,
            )
        except requests.RequestException as exc:
            logger.warning("Esanj request failed: %s %s", method, path, exc_info=exc)
            raise EsanjAPIError("ارتباط با سرویس آزمون برقرار نشد.") from exc

        if response.status_code in {401, 403} and retry_auth:
            cache.delete(self.token_cache_key)
            try:
                response = requests.request(
                    method,
                    self._url(path),
                    headers={**self._headers(refresh=True), **extra_headers},
                    timeout=self.config.timeout,
                    **kwargs,
                )
            except requests.RequestException as exc:
                logger.warning("Esanj retry failed: %s %s", method, path, exc_info=exc)
                raise EsanjAPIError("ارتباط با سرویس آزمون برقرار نشد.") from exc

        return self._parse_response(response)

    @staticmethod
    def _parse_response(response: requests.Response) -> Any:
        if 200 <= response.status_code < 300:
            if not response.content:
                return {}
            content_type = response.headers.get("content-type", "")
            if "application/json" in content_type:
                return response.json()
            return {"raw": response.text}

        payload: Any = None
        message = "درخواست به سرویس آزمون ناموفق بود."
        try:
            payload = response.json()
            if isinstance(payload, dict):
                message = payload.get("message") or payload.get("error") or payload.get("detail") or message
        except ValueError:
            payload = response.text

        if response.status_code == 403:
            message = "حساب Esanj به این عملیات دسترسی ندارد، آزمون برای این کاربر فعال نیست یا مجوز/اعتبار لازم برای شروع آزمون موجود نیست."
        elif response.status_code == 404:
            message = "آزمون یا نتیجه در سرویس Esanj پیدا نشد."

        raise EsanjAPIError(message, response.status_code, payload)

    def test_bank(self, test_id: int | None = None) -> list[dict[str, Any]]:
        params = {"test_id": test_id} if test_id else None
        payload = self._request("GET", "/test/bank", params=params)
        tests = payload.get("tests", []) if isinstance(payload, dict) else []
        return tests if isinstance(tests, list) else []

    def questionnaire(self, test_id: int) -> dict[str, Any]:
        payload = self._request("GET", f"/questionnaire/{test_id}")
        return payload if isinstance(payload, dict) else {}

    def status_do(self, test_id: int | None = None, employee_id: int | None = None) -> list[dict[str, Any]]:
        params = {k: v for k, v in {"test_id": test_id, "employee_id": employee_id}.items() if v is not None}
        payload = self._request("GET", "/test/status-do", params=params or None)
        results = payload.get("results", []) if isinstance(payload, dict) else []
        return results if isinstance(results, list) else []

    def organization_information(self) -> dict[str, Any]:
        payload = self._request("GET", "/organization/information")
        info = payload.get("information", {}) if isinstance(payload, dict) else {}
        return info if isinstance(info, dict) else {}

    def list_employees(self) -> list[dict[str, Any]]:
        try:
            payload = self._request("GET", "/employees")
        except EsanjAPIError as exc:
            if exc.status_code == 404:
                return []
            raise
        employees = payload.get("employees", []) if isinstance(payload, dict) else []
        return employees if isinstance(employees, list) else []

    def find_employee(self, username: str | None = None, employee_id: int | None = None) -> dict[str, Any] | None:
        params = {k: v for k, v in {"username": username, "employee_id": employee_id}.items() if v}
        try:
            payload = self._request("GET", "/employees", params=params or None)
        except EsanjAPIError as exc:
            if exc.status_code == 404:
                return None
            raise
        employees = payload.get("employees", []) if isinstance(payload, dict) else []
        if isinstance(employees, list) and employees:
            return employees[0]
        return None

    def create_employee(
        self,
        *,
        username: str,
        name: str = "",
        phone_number: str = "",
        sex: str = "",
        birth_year: int | None = None,
    ) -> dict[str, Any] | None:
        params = {k: v for k, v in {
            "username": username,
            "name": name,
            "phone_number": phone_number,
            "sex": sex,
            "birth_year": birth_year,
            "is_active": "1",
        }.items() if v}
        payload = self._request("POST", "/employee/create", params=params)
        employee = payload.get("employee") if isinstance(payload, dict) else None
        return employee if isinstance(employee, dict) else None

    def update_employee(
        self,
        employee_id: int,
        *,
        username: str,
        name: str = "",
        phone_number: str = "",
        sex: str = "",
        birth_year: int | None = None,
        is_active: str = "1",
    ) -> dict[str, Any] | None:
        params = {k: v for k, v in {
            "username": username,
            "name": name,
            "phone_number": phone_number,
            "sex": sex,
            "birth_year": birth_year,
            "is_active": is_active,
        }.items() if v}
        payload = self._request("PATCH", f"/employee/{employee_id}/update", params=params)
        employee = payload.get("employee") if isinstance(payload, dict) else None
        return employee if isinstance(employee, dict) else None

    def delete_employee(self, employee_id: int) -> bool:
        self._request("DELETE", f"/employee/{employee_id}/delete")
        return True

    def questionnaire_html(
        self,
        *,
        test_id: int,
        sex: str,
        age: int,
        uuid: str,
        employee_id: int | None = None,
    ) -> str:
        params = {
            "test_id": test_id,
            "sex": sex,
            "age": age,
            "uuid": uuid,
            "employee_id": employee_id,
        }
        payload = self._request("GET", "/questionnaire/html", params={k: v for k, v in params.items() if v is not None})
        if not isinstance(payload, dict):
            return ""
        return str(payload.get("response") or payload.get("raw") or "")

    def submit_interpretation(
        self,
        *,
        test_id: int,
        uuid: str,
        answers_payload: dict[str, Any],
        employee_id: int | None = None,
    ) -> dict[str, Any]:
        params = {"employee_id": employee_id} if employee_id else None
        payload = self._request(
            "POST",
            f"/interpretation/{test_id}/json/{uuid}",
            params=params,
            json=answers_payload,
        )
        return payload if isinstance(payload, dict) else {"raw": payload}

    def get_grading(self, uuid: str) -> dict[str, Any]:
        payload = self._request("GET", f"/interpretation/grading/{uuid}")
        return payload if isinstance(payload, dict) else {"raw": payload}

    def get_interpretation(self, uuid: str) -> dict[str, Any]:
        payload = self._request("GET", f"/interpretation/json/{uuid}")
        return payload if isinstance(payload, dict) else {"raw": payload}
