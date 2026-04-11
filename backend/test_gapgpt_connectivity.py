import argparse
import json
import logging
import os
import socket
import sys
import time
import traceback
from pathlib import Path
from typing import Any, Dict, Optional
from urllib.parse import urlparse

import httpx
from dotenv import load_dotenv
from openai import OpenAI


ROOT_DIR = Path(__file__).resolve().parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))


def setup_logging(verbose: bool) -> None:
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    )


logger = logging.getLogger("gapgpt-connectivity")


def redact(value: Optional[str], keep_start: int = 6, keep_end: int = 4) -> str:
    if not value:
        return "<empty>"
    if len(value) <= keep_start + keep_end:
        return "*" * len(value)
    return f"{value[:keep_start]}...{value[-keep_end:]}"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Verbose GAPGPT connectivity test for Vania agents."
    )
    parser.add_argument(
        "--target",
        choices=["domain", "ip", "both"],
        default="both",
        help="Which endpoint style to test.",
    )
    parser.add_argument(
        "--ip",
        default="185.143.234.235",
        help="Direct IP to test against when --target includes ip.",
    )
    parser.add_argument(
        "--prompt",
        default="Reply with exactly: GAPGPT_OK",
        help="Tiny prompt for generation checks.",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=8.0,
        help="Override timeout in seconds.",
    )
    parser.add_argument(
        "--sdk-retries",
        type=int,
        default=0,
        help="OpenAI SDK retry count. Use 0 for faster failure.",
    )
    parser.add_argument(
        "--transport",
        choices=["env", "direct", "both"],
        default="both",
        help="Test requests with environment proxy settings, direct connections, or both.",
    )
    parser.add_argument(
        "--skip-generation",
        action="store_true",
        help="Only test transport and model listing, skip text generation calls.",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Enable debug-level logs.",
    )
    return parser.parse_args()


def load_environment() -> None:
    env_path = ROOT_DIR / ".env"
    load_dotenv(env_path)
    logger.info("Loaded environment file: %s", env_path)


def load_agent_models() -> Dict[str, str]:
    from definitions.agents.expert import AGENT as EXPERT_AGENT
    from definitions.agents.visitor import AGENT as VISITOR_AGENT

    models = {
        "expert": EXPERT_AGENT.model_id,
        "visitor": VISITOR_AGENT.model_id,
    }
    logger.info("Resolved agent models from code: %s", models)
    return models


def read_provider_config(timeout_override: Optional[float]) -> Dict[str, Any]:
    provider = (os.getenv("AI_PROVIDER") or "openai").strip().lower()
    gapgpt_base_url = (os.getenv("GAPGPT_BASE_URL") or "https://api.gapgpt.app/v1").strip()
    api_key = (os.getenv("GAPGPT_API_KEY") or "").strip()
    timeout_raw = (
        timeout_override
        if timeout_override is not None
        else os.getenv("GAPGPT_TIMEOUT_SECONDS")
        or os.getenv("AI_TIMEOUT_SECONDS")
        or "300"
    )
    timeout = float(timeout_raw)
    config = {
        "ai_provider_env": provider,
        "gapgpt_base_url": gapgpt_base_url.rstrip("/"),
        "gapgpt_api_key": api_key,
        "timeout": timeout,
    }
    logger.info(
        "Provider config: AI_PROVIDER=%s, GAPGPT_BASE_URL=%s, GAPGPT_API_KEY=%s, timeout=%s",
        config["ai_provider_env"],
        config["gapgpt_base_url"],
        redact(config["gapgpt_api_key"]),
        config["timeout"],
    )
    if not api_key:
        raise RuntimeError("GAPGPT_API_KEY is missing from environment.")
    return config


def log_proxy_environment() -> None:
    proxy_vars = {
        "HTTP_PROXY": os.getenv("HTTP_PROXY"),
        "HTTPS_PROXY": os.getenv("HTTPS_PROXY"),
        "ALL_PROXY": os.getenv("ALL_PROXY"),
        "NO_PROXY": os.getenv("NO_PROXY"),
        "http_proxy": os.getenv("http_proxy"),
        "https_proxy": os.getenv("https_proxy"),
        "all_proxy": os.getenv("all_proxy"),
        "no_proxy": os.getenv("no_proxy"),
    }
    logger.info("Proxy-related environment: %s", json.dumps(proxy_vars, ensure_ascii=False, indent=2))


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


def build_scenarios(base_url: str, ip: str, target: str) -> list[Dict[str, Any]]:
    parsed = urlparse(base_url)
    host_header = parsed.netloc
    path_prefix = parsed.path.rstrip("/")

    scenarios = []
    if target in {"domain", "both"}:
        scenarios.append(
            {
                "name": "domain",
                "base_url": base_url,
                "host": parsed.hostname,
                "port": parsed.port or (443 if parsed.scheme == "https" else 80),
                "headers": {},
                "verify": True,
                "notes": "Uses GAPGPT_BASE_URL exactly as configured.",
            }
        )
    if target in {"ip", "both"}:
        scenarios.append(
            {
                "name": "ip",
                "base_url": f"{parsed.scheme}://{ip}{path_prefix}",
                "host": ip,
                "port": parsed.port or (443 if parsed.scheme == "https" else 80),
                "headers": {"Host": host_header},
                "verify": False,
                "notes": (
                    "Forces the request to the provided IP and sends the original host "
                    "in the Host header. TLS verification is disabled for this path "
                    "because certificates usually do not match raw IPs."
                ),
            }
        )
    return scenarios


def log_section(title: str) -> None:
    logger.info("")
    logger.info("=" * 30 + " %s " + "=" * 30, title)


def resolve_dns(host: Optional[str]) -> None:
    if not host:
        logger.warning("No hostname available for DNS resolution.")
        return
    log_section(f"DNS resolution for {host}")
    try:
        infos = socket.getaddrinfo(host, None, proto=socket.IPPROTO_TCP)
        unique_addrs = []
        seen = set()
        for info in infos:
            addr = info[4][0]
            if addr not in seen:
                unique_addrs.append(addr)
                seen.add(addr)
        logger.info("Resolved addresses: %s", unique_addrs or "<none>")
    except Exception:
        logger.error("DNS resolution failed for host=%s", host)
        logger.error(traceback.format_exc())


def test_tcp(host: str, port: int, timeout: float) -> None:
    log_section(f"TCP connectivity to {host}:{port}")
    started = time.perf_counter()
    try:
        with socket.create_connection((host, port), timeout=timeout):
            elapsed = time.perf_counter() - started
            logger.info("TCP connection succeeded in %.3fs", elapsed)
    except Exception:
        elapsed = time.perf_counter() - started
        logger.error("TCP connection failed after %.3fs", elapsed)
        logger.error(traceback.format_exc())


def make_http_client(
    *,
    timeout: float,
    headers: Dict[str, str],
    verify: bool,
    label: str,
    trust_env: bool,
) -> httpx.Client:
    def on_request(request: httpx.Request) -> None:
        safe_headers = dict(request.headers)
        if "authorization" in safe_headers:
            safe_headers["authorization"] = f"Bearer {redact(request.headers.get('authorization', '').replace('Bearer ', ''))}"
        logger.info(
            "[%s] HTTP request: %s %s | headers=%s",
            label,
            request.method,
            request.url,
            json.dumps(safe_headers, ensure_ascii=False),
        )

    def on_response(response: httpx.Response) -> None:
        req = response.request
        snippet = "<stream-not-read>"
        try:
            response.read()
            snippet = response.text[:500].replace("\n", "\\n")
        except Exception as exc:
            snippet = f"<failed-to-read-body: {exc}>"
        logger.info(
            "[%s] HTTP response: %s %s -> %s | body=%s",
            label,
            req.method,
            req.url,
            response.status_code,
            snippet,
        )

    return httpx.Client(
        timeout=timeout,
        headers=headers,
        verify=verify,
        follow_redirects=True,
        trust_env=trust_env,
        event_hooks={"request": [on_request], "response": [on_response]},
    )


def raw_models_check(
    base_url: str,
    timeout: float,
    headers: Dict[str, str],
    verify: bool,
    api_key: str,
    label: str,
    trust_env: bool,
) -> None:
    log_section(f"{label}: raw GET /models")
    started = time.perf_counter()
    try:
        with make_http_client(timeout=timeout, headers=headers, verify=verify, label=label, trust_env=trust_env) as client:
            response = client.get(
                f"{base_url.rstrip('/')}/models",
                headers={"Authorization": f"Bearer {api_key}"},
            )
            elapsed = time.perf_counter() - started
            logger.info("[%s] Raw /models completed in %.3fs", label, elapsed)
            response.raise_for_status()
    except Exception:
        elapsed = time.perf_counter() - started
        logger.error("[%s] Raw /models failed after %.3fs", label, elapsed)
        logger.error(traceback.format_exc())


def sdk_models_check(
    base_url: str,
    timeout: float,
    headers: Dict[str, str],
    verify: bool,
    api_key: str,
    label: str,
    trust_env: bool,
    max_retries: int,
) -> None:
    log_section(f"{label}: OpenAI SDK models.list()")
    started = time.perf_counter()
    try:
        with make_http_client(timeout=timeout, headers=headers, verify=verify, label=label, trust_env=trust_env) as http_client:
            client = OpenAI(
                api_key=api_key,
                base_url=base_url,
                timeout=timeout,
                http_client=http_client,
                max_retries=max_retries,
            )
            models = client.models.list()
            elapsed = time.perf_counter() - started
            model_ids = []
            for item in getattr(models, "data", [])[:15]:
                model_ids.append(getattr(item, "id", "<missing-id>"))
            logger.info("[%s] models.list() succeeded in %.3fs", label, elapsed)
            logger.info("[%s] First model ids: %s", label, model_ids)
    except Exception:
        elapsed = time.perf_counter() - started
        logger.error("[%s] models.list() failed after %.3fs", label, elapsed)
        logger.error(traceback.format_exc())


def sdk_generation_check(
    *,
    base_url: str,
    timeout: float,
    headers: Dict[str, str],
    verify: bool,
    api_key: str,
    label: str,
    model_id: str,
    prompt: str,
    trust_env: bool,
    max_retries: int,
) -> None:
    log_section(f"{label}: OpenAI SDK chat.completions.create() with model={model_id}")
    started = time.perf_counter()
    try:
        with make_http_client(timeout=timeout, headers=headers, verify=verify, label=label, trust_env=trust_env) as http_client:
            client = OpenAI(
                api_key=api_key,
                base_url=base_url,
                timeout=timeout,
                http_client=http_client,
                max_retries=max_retries,
            )
            response = client.chat.completions.create(
                model=model_id,
                messages=[
                    {
                        "role": "system",
                        "content": "You are a network connectivity test. Reply briefly.",
                    },
                    {"role": "user", "content": prompt},
                ],
                max_completion_tokens=30,
            )
            elapsed = time.perf_counter() - started
            content = ""
            if response.choices:
                message = response.choices[0].message
                content = message.content or ""
            logger.info("[%s] chat.completions.create() succeeded in %.3fs", label, elapsed)
            logger.info("[%s] Completion text: %r", label, content)
    except Exception:
        elapsed = time.perf_counter() - started
        logger.error("[%s] chat.completions.create() failed after %.3fs", label, elapsed)
        logger.error(traceback.format_exc())


def run_scenario(
    *,
    scenario: Dict[str, Any],
    api_key: str,
    timeout: float,
    models: Dict[str, str],
    prompt: str,
    skip_generation: bool,
    trust_env: bool,
    max_retries: int,
    transport_label: str,
) -> None:
    log_section(f"Scenario: {scenario['name']} | transport={transport_label}")
    logger.info("Scenario details: %s", json.dumps(
        {
            "base_url": scenario["base_url"],
            "host": scenario["host"],
            "port": scenario["port"],
            "headers": scenario["headers"],
            "verify": scenario["verify"],
            "trust_env": trust_env,
            "sdk_retries": max_retries,
            "notes": scenario["notes"],
        },
        ensure_ascii=False,
        indent=2,
    ))

    resolve_dns(scenario["host"])
    test_tcp(scenario["host"], scenario["port"], timeout=min(timeout, 10.0))
    raw_models_check(
        base_url=scenario["base_url"],
        timeout=timeout,
        headers=scenario["headers"],
        verify=scenario["verify"],
        api_key=api_key,
        label=f"{scenario['name']}:{transport_label}",
        trust_env=trust_env,
    )
    sdk_models_check(
        base_url=scenario["base_url"],
        timeout=timeout,
        headers=scenario["headers"],
        verify=scenario["verify"],
        api_key=api_key,
        label=f"{scenario['name']}:{transport_label}",
        trust_env=trust_env,
        max_retries=max_retries,
    )

    if skip_generation:
        logger.info("[%s] Skipping generation checks because --skip-generation was passed.", f"{scenario['name']}:{transport_label}")
        return

    for agent_name, model_id in models.items():
        sdk_generation_check(
            base_url=scenario["base_url"],
            timeout=timeout,
            headers=scenario["headers"],
            verify=scenario["verify"],
            api_key=api_key,
            label=f"{scenario['name']}:{transport_label}:{agent_name}",
            model_id=model_id,
            prompt=prompt,
            trust_env=trust_env,
            max_retries=max_retries,
        )


def main() -> int:
    args = parse_args()
    setup_logging(args.verbose)
    load_environment()
    models = load_agent_models()
    config = read_provider_config(timeout_override=args.timeout)
    log_proxy_environment()

    logger.info(
        "This script mirrors the active agent model setup: expert=%s, visitor=%s",
        models["expert"],
        models["visitor"],
    )
    logger.info(
        "Agent definitions currently keep reasoning disabled; this connectivity script only verifies transport and basic generation."
    )

    scenarios = build_scenarios(
        base_url=config["gapgpt_base_url"],
        ip=args.ip,
        target=args.target,
    )
    logger.info("Prepared scenarios: %s", [scenario["name"] for scenario in scenarios])

    transports = []
    if args.transport in {"env", "both"}:
        transports.append(("env", True))
    if args.transport in {"direct", "both"}:
        transports.append(("direct", False))

    for transport_label, trust_env in transports:
        if transport_label == "direct":
            clear_proxy_environment()
            logger.info("Cleared proxy environment variables for direct transport.")
            log_proxy_environment()
        for scenario in scenarios:
            run_scenario(
                scenario=scenario,
                api_key=config["gapgpt_api_key"],
                timeout=config["timeout"],
                models=models,
                prompt=args.prompt,
                skip_generation=args.skip_generation,
                trust_env=trust_env,
                max_retries=args.sdk_retries,
                transport_label=transport_label,
            )

    logger.info("Connectivity test run finished.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
