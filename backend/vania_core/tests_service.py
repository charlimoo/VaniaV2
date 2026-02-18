import os
import uuid
import logging
import re
import unicodedata
from datetime import datetime
from typing import Any, Dict, List, Optional

from django.conf import settings
from django.core.files.storage import default_storage

from openai import OpenAI
from pypdf import PdfReader

from users.models import UserContextEntry
from users.services import user_context_manager
from .tests_catalog import TEST_CATALOG, TEST_CATALOG_BY_ID

logger = logging.getLogger(__name__)

# Optional extractors for better Persian PDF handling.
try:
    import pdfplumber  # type: ignore
except Exception:
    pdfplumber = None

try:
    import fitz  # type: ignore
except Exception:
    fitz = None


class ClinicalTestsService:
    CONTEXT_KEY = "clinical_tests"
    MAX_EXTRACTED_TEXT_CHARS = 24000

    @staticmethod
    def list_catalog() -> List[Dict[str, Any]]:
        return TEST_CATALOG

    @staticmethod
    def _get_state(patient) -> Dict[str, Any]:
        entry = user_context_manager.get_context(patient, ClinicalTestsService.CONTEXT_KEY)
        if entry and isinstance(entry.data, dict):
            tests = entry.data.get("tests", [])
            if isinstance(tests, list):
                return {"tests": tests}
        return {"tests": []}

    @staticmethod
    def get_tests(patient) -> List[Dict[str, Any]]:
        state = ClinicalTestsService._get_state(patient)
        tests = state.get("tests", [])
        tests.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        return tests

    @staticmethod
    def save_tests(patient, tests: List[Dict[str, Any]], source=UserContextEntry.SourceType.USER, creator=None):
        user_context_manager.set_singleton_context(
            user=patient,
            key=ClinicalTestsService.CONTEXT_KEY,
            data={"tests": tests},
            source=source,
            creator=creator,
        )

    @staticmethod
    def add_test(
        patient,
        created_by,
        catalog_id: Optional[int] = None,
        title: Optional[str] = None,
        url: Optional[str] = None,
        result_summary: Optional[str] = None,
    ) -> Dict[str, Any]:
        tests = ClinicalTestsService.get_tests(patient)
        now_iso = datetime.now().isoformat()

        resolved_title = title or ""
        resolved_url = url or ""
        if catalog_id:
            item = TEST_CATALOG_BY_ID.get(int(catalog_id))
            if item:
                resolved_title = item["title"]
                resolved_url = item["url"]

        new_test = {
            "id": str(uuid.uuid4()),
            "catalog_id": int(catalog_id) if catalog_id else None,
            "title": resolved_title,
            "url": resolved_url,
            "result_summary": (result_summary or "").strip(),
            "file_path": None,
            "file_name": None,
            "file_uploaded_at": None,
            "created_at": now_iso,
            "updated_at": now_iso,
        }
        tests.insert(0, new_test)
        ClinicalTestsService.save_tests(patient, tests, creator=created_by)
        return new_test

    @staticmethod
    def update_test(patient, created_by, test_id: str, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        tests = ClinicalTestsService.get_tests(patient)
        updated = None
        for test in tests:
            if test.get("id") == test_id:
                for key in ["title", "url", "result_summary"]:
                    if key in payload:
                        test[key] = payload.get(key)
                if "catalog_id" in payload:
                    catalog_id = payload.get("catalog_id")
                    test["catalog_id"] = int(catalog_id) if catalog_id else None
                    if catalog_id and int(catalog_id) in TEST_CATALOG_BY_ID:
                        item = TEST_CATALOG_BY_ID[int(catalog_id)]
                        test["title"] = item["title"]
                        test["url"] = item["url"]
                test["updated_at"] = datetime.now().isoformat()
                updated = test
                break

        if updated is None:
            return None

        ClinicalTestsService.save_tests(patient, tests, creator=created_by)
        return updated

    @staticmethod
    def _delete_file_if_exists(file_path: Optional[str]):
        if file_path and default_storage.exists(file_path):
            default_storage.delete(file_path)

    @staticmethod
    def delete_test(patient, created_by, test_id: str) -> bool:
        tests = ClinicalTestsService.get_tests(patient)
        filtered = []
        removed = False
        for test in tests:
            if test.get("id") == test_id:
                removed = True
                ClinicalTestsService._delete_file_if_exists(test.get("file_path"))
                continue
            filtered.append(test)

        if not removed:
            return False

        ClinicalTestsService.save_tests(patient, filtered, creator=created_by)
        return True

    @staticmethod
    def attach_pdf_and_summarize(
        patient,
        created_by,
        test_id: str,
        uploaded_file,
        doctor_summary: Optional[str] = None,
        auto_summarize: bool = True,
    ) -> Optional[Dict[str, Any]]:
        tests = ClinicalTestsService.get_tests(patient)
        target = None
        for test in tests:
            if test.get("id") == test_id:
                target = test
                break

        if target is None:
            return None

        ClinicalTestsService._delete_file_if_exists(target.get("file_path"))

        extension = os.path.splitext(uploaded_file.name or "")[1].lower() or ".pdf"
        safe_name = f"{uuid.uuid4().hex}{extension}"
        relative_path = os.path.join("clinical_tests", str(patient.id), safe_name)
        saved_path = default_storage.save(relative_path, uploaded_file)

        target["file_path"] = saved_path
        target["file_name"] = uploaded_file.name
        target["file_uploaded_at"] = datetime.now().isoformat()

        summary_text = (doctor_summary or "").strip()
        if not summary_text and auto_summarize:
            extracted_text = ClinicalTestsService.extract_pdf_text(saved_path)
            if extracted_text:
                ai_summary = ClinicalTestsService.summarize_test_result(
                    test_title=target.get("title", "تست روانشناسی"),
                    test_text=extracted_text,
                )
                if ai_summary:
                    summary_text = ai_summary

        target["result_summary"] = summary_text
        target["updated_at"] = datetime.now().isoformat()

        ClinicalTestsService.save_tests(patient, tests, creator=created_by)
        return target

    @staticmethod
    def remove_test_file(patient, created_by, test_id: str) -> bool:
        tests = ClinicalTestsService.get_tests(patient)
        changed = False
        for test in tests:
            if test.get("id") == test_id:
                ClinicalTestsService._delete_file_if_exists(test.get("file_path"))
                test["file_path"] = None
                test["file_name"] = None
                test["file_uploaded_at"] = None
                test["updated_at"] = datetime.now().isoformat()
                changed = True
                break

        if not changed:
            return False

        ClinicalTestsService.save_tests(patient, tests, creator=created_by)
        return True

    @staticmethod
    def get_test(patient, test_id: str) -> Optional[Dict[str, Any]]:
        for test in ClinicalTestsService.get_tests(patient):
            if test.get("id") == test_id:
                return test
        return None

    @staticmethod
    def extract_pdf_text(storage_path: str) -> str:
        extractors = [
            ("pypdf", ClinicalTestsService._extract_with_pypdf),
            ("pdfplumber", ClinicalTestsService._extract_with_pdfplumber),
            ("fitz", ClinicalTestsService._extract_with_fitz),
        ]

        for extractor_name, extractor in extractors:
            try:
                raw_text = extractor(storage_path)
            except Exception as e:
                logger.warning(f"PDF extractor '{extractor_name}' failed for {storage_path}: {e}")
                continue

            cleaned = ClinicalTestsService._sanitize_extracted_text(raw_text)
            if ClinicalTestsService._is_text_quality_acceptable(cleaned):
                final_text = ClinicalTestsService._truncate_on_paragraph(cleaned, ClinicalTestsService.MAX_EXTRACTED_TEXT_CHARS)
                logger.info(f"PDF extraction successful via '{extractor_name}' for {storage_path}")
                return final_text
            if cleaned:
                logger.info(f"PDF extraction via '{extractor_name}' rejected due to low text quality for {storage_path}")

        logger.warning(f"All PDF extraction strategies failed or low-quality for {storage_path}")
        return ""

    @staticmethod
    def _extract_with_pypdf(storage_path: str) -> str:
        try:
            with default_storage.open(storage_path, "rb") as f:
                reader = PdfReader(f)
                text_chunks: List[str] = []
                for page in reader.pages:
                    extracted = page.extract_text() or ""
                    if extracted:
                        text_chunks.append(extracted)
            return "\n".join(text_chunks)
        except Exception:
            raise

    @staticmethod
    def _extract_with_pdfplumber(storage_path: str) -> str:
        if pdfplumber is None:
            return ""
        with default_storage.open(storage_path, "rb") as f:
            text_chunks: List[str] = []
            with pdfplumber.open(f) as pdf:
                for page in pdf.pages:
                    extracted = page.extract_text() or ""
                    if extracted:
                        text_chunks.append(extracted)
            return "\n".join(text_chunks)

    @staticmethod
    def _extract_with_fitz(storage_path: str) -> str:
        if fitz is None:
            return ""
        with default_storage.open(storage_path, "rb") as f:
            data = f.read()
        text_chunks: List[str] = []
        doc = fitz.open(stream=data, filetype="pdf")
        try:
            for page in doc:
                extracted = page.get_text("text") or ""
                if extracted:
                    text_chunks.append(extracted)
        finally:
            doc.close()
        return "\n".join(text_chunks)

    @staticmethod
    def _sanitize_extracted_text(text: str) -> str:
        if not text:
            return ""
        normalized = unicodedata.normalize("NFC", text)

        # Strip invisible/formatting characters that frequently pollute Persian PDF extraction.
        invisible_chars = [
            "\u200b", "\u200c", "\u200d", "\u200e", "\u200f", "\ufeff", "\u2066", "\u2067", "\u2068", "\u2069"
        ]
        for ch in invisible_chars:
            normalized = normalized.replace(ch, " ")

        # Remove control chars but keep line breaks/tabs.
        normalized = "".join(ch for ch in normalized if ch == "\n" or ch == "\t" or ord(ch) >= 32)

        # Normalize line endings and trim whitespace around lines.
        normalized = normalized.replace("\r\n", "\n").replace("\r", "\n")
        lines = [re.sub(r"\s+", " ", line).strip() for line in normalized.split("\n")]

        filtered_lines: List[str] = []
        for line in lines:
            if not line:
                filtered_lines.append("")
                continue
            # Drop lines dominated by replacement chars or symbols.
            replacement_count = line.count("�")
            symbol_count = len(re.findall(r"[^\w\u0600-\u06FF\s]", line))
            meaningful_chars = len(re.findall(r"[\u0600-\u06FFA-Za-z0-9]", line))
            if replacement_count > max(2, len(line) // 8):
                continue
            if meaningful_chars == 0:
                continue
            if symbol_count > meaningful_chars * 3:
                continue
            filtered_lines.append(line)

        cleaned = "\n".join(filtered_lines)
        # Collapse repeated punctuation and whitespace noise.
        cleaned = re.sub(r"[ \t]+", " ", cleaned)
        cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
        cleaned = re.sub(r"([!?.،؛:])\1{2,}", r"\1", cleaned)
        return cleaned.strip()

    @staticmethod
    def _is_text_quality_acceptable(text: str) -> bool:
        if not text:
            return False
        if len(text) < 120:
            return False
        meaningful = len(re.findall(r"[\u0600-\u06FFA-Za-z0-9]", text))
        total_non_space = len(re.sub(r"\s+", "", text))
        if total_non_space == 0:
            return False
        ratio = meaningful / total_non_space
        return ratio >= 0.35

    @staticmethod
    def _truncate_on_paragraph(text: str, limit: int) -> str:
        if len(text) <= limit:
            return text
        paragraphs = text.split("\n\n")
        out: List[str] = []
        current_len = 0
        for p in paragraphs:
            p = p.strip()
            if not p:
                continue
            chunk_len = len(p) + (2 if out else 0)
            if current_len + chunk_len > limit:
                break
            out.append(p)
            current_len += chunk_len
        if out:
            return "\n\n".join(out).strip()
        return text[:limit].strip()

    @staticmethod
    def summarize_test_result(test_title: str, test_text: str) -> str:
        api_key = getattr(settings, "OPENAI_API_KEY", None)
        if not api_key:
            logger.warning("OPENAI_API_KEY is missing; skipping automatic test summary.")
            return ""

        try:
            client = OpenAI(api_key=api_key)
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                temperature=0.2,
                messages=[
                    {
                        "role": "system",
                        "content": "شما یک دستیار بالینی برای روانشناس هستید. خروجی باید فارسی، حرفه‌ای، خلاصه و قابل استفاده در پرونده باشد.",
                    },
                    {
                        "role": "user",
                        "content": (
                            f"نام تست: {test_title}\n\n"
                            "بر اساس متن نتیجه تست زیر، یک خلاصه بالینی کوتاه (حداکثر ۸ خط) بنویس. "
                            "خروجی باید شامل: یافته‌های اصلی، تفسیر محتاطانه، و نکات قابل پیگیری در جلسه بعد باشد. "
                            "از ادعاهای قطعی بدون شواهد خودداری کن.\n\n"
                            f"متن تست:\n{test_text}"
                        ),
                    },
                ],
            )
            content = response.choices[0].message.content if response.choices else ""
            return (content or "").strip()
        except Exception as e:
            logger.warning(f"Failed to generate AI summary for test: {e}")
            return ""
