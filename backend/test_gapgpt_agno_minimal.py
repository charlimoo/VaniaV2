import argparse
import json
import logging
import os
import sys
import traceback
from pathlib import Path

from dotenv import load_dotenv


ROOT_DIR = Path(__file__).resolve().parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))


logger = logging.getLogger("gapgpt-agno-minimal")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Minimal Agno GAPGPT test.")
    parser.add_argument("--model", action="append", dest="models", help="Model id to test. Can be passed multiple times.")
    parser.add_argument("--timeout", type=float, default=8.0, help="Timeout in seconds.")
    parser.add_argument(
        "--prompt",
        default="Reply with exactly: GAPGPT_OK",
        help="Prompt to send.",
    )
    return parser.parse_args()


def setup_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    )


def redact(value: str) -> str:
    if not value:
        return "<empty>"
    if len(value) <= 10:
        return "*" * len(value)
    return f"{value[:6]}...{value[-4:]}"


def clear_proxy_environment() -> None:
    for key in [
        "HTTP_PROXY",
        "HTTPS_PROXY",
        "ALL_PROXY",
        "NO_PROXY",
        "http_proxy",
        "https_proxy",
        "all_proxy",
        "no_proxy",
    ]:
        os.environ.pop(key, None)


def proxy_snapshot() -> dict:
    return {
        "HTTP_PROXY": os.getenv("HTTP_PROXY"),
        "HTTPS_PROXY": os.getenv("HTTPS_PROXY"),
        "ALL_PROXY": os.getenv("ALL_PROXY"),
        "NO_PROXY": os.getenv("NO_PROXY"),
        "http_proxy": os.getenv("http_proxy"),
        "https_proxy": os.getenv("https_proxy"),
        "all_proxy": os.getenv("all_proxy"),
        "no_proxy": os.getenv("no_proxy"),
    }


def main() -> int:
    args = parse_args()
    setup_logging()

    env_path = ROOT_DIR / ".env"
    load_dotenv(env_path)
    logger.info("Loaded environment file: %s", env_path)
    logger.info("Proxy environment before clearing: %s", json.dumps(proxy_snapshot(), ensure_ascii=False))

    clear_proxy_environment()
    os.environ["GAPGPT_TIMEOUT_SECONDS"] = str(args.timeout)

    logger.info("Proxy environment after clearing: %s", json.dumps(proxy_snapshot(), ensure_ascii=False))
    logger.info("Configured timeout override: %s", args.timeout)

    from agno.agent import Agent
    from agno.models.openai import OpenAIChat
    from core.ai_provider import get_agno_openai_kwargs

    model_kwargs = get_agno_openai_kwargs()
    safe_kwargs = dict(model_kwargs)
    if "api_key" in safe_kwargs:
        safe_kwargs["api_key"] = redact(str(safe_kwargs["api_key"]))

    logger.info("Using provider kwargs: %s", json.dumps(safe_kwargs, ensure_ascii=False))
    models = args.models or [
        "gpt-5.4",
        "gpt-5-chat-latest",
        "gpt-5.3-chat-latest",
        "gpt-4o",
        "claude-3-7-sonnet-20250219",
    ]
    logger.info("Models to test: %s", models)

    results = []
    for model_id in models:
        logger.info("Starting Agno agent run for model=%s", model_id)
        agent = Agent(
            model=OpenAIChat(id=model_id, **model_kwargs),
            instructions="You are a connectivity test. Reply briefly and exactly follow the user request.",
            markdown=False,
        )

        try:
            result = agent.run(args.prompt)
            content = getattr(result, "content", "")
            metrics = getattr(result, "metrics", None)
            if hasattr(metrics, "to_dict"):
                metrics = metrics.to_dict()
            elif hasattr(metrics, "__dict__"):
                metrics = metrics.__dict__

            logger.info("Run succeeded for model=%s", model_id)
            logger.info("Response content for %s: %r", model_id, content)
            logger.info("Metrics for %s: %s", model_id, json.dumps(metrics or {}, ensure_ascii=False))
            results.append({"model": model_id, "ok": True, "detail": content})
        except Exception as exc:
            logger.error("Run failed for model=%s: %s", model_id, exc)
            logger.error(traceback.format_exc())
            results.append({"model": model_id, "ok": False, "detail": str(exc)})

    logger.info("Summary:")
    for item in results:
        status = "OK" if item["ok"] else "FAIL"
        logger.info("  %s | %s | %s", status, item["model"], item["detail"])

    return 0 if any(item["ok"] for item in results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
