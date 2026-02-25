from __future__ import annotations

import importlib
import pkgutil
from collections.abc import Iterable
from pathlib import Path

from ..base import AgentDef


def _collect_from_module(module) -> list[AgentDef]:
    items: list[AgentDef] = []

    exported = getattr(module, "AGENTS", None)
    if exported is not None:
        if not isinstance(exported, Iterable) or isinstance(exported, (str, bytes)):
            raise TypeError(f"{module.__name__}.AGENTS must be an iterable of AgentDef.")
        for agent in exported:
            if not isinstance(agent, AgentDef):
                raise TypeError(f"{module.__name__}.AGENTS contains non-AgentDef item: {type(agent)!r}")
            items.append(agent)
        return items

    # Fallback protocol: auto-pick module globals that are AgentDef instances.
    for value in module.__dict__.values():
        if isinstance(value, AgentDef):
            items.append(value)
    return items


def discover_agents() -> list[AgentDef]:
    """
    Protocol:
    - Any .py file in definitions/agents is discovered automatically (except private files).
    - Preferred export is AGENTS = [AgentDef(...), ...].
    - Fallback: any top-level AgentDef variables are collected.
    """
    package_dir = Path(__file__).resolve().parent
    collected: list[AgentDef] = []
    seen_slugs: set[str] = set()

    for module_info in pkgutil.iter_modules([str(package_dir)]):
        module_name = module_info.name
        if module_name.startswith("_") or module_name in {"protocol"}:
            continue

        module = importlib.import_module(f"{__name__}.{module_name}")
        module_agents = _collect_from_module(module)

        for agent in module_agents:
            if agent.slug in seen_slugs:
                raise ValueError(f"Duplicate agent slug discovered during sync: {agent.slug}")
            seen_slugs.add(agent.slug)
            collected.append(agent)

    return collected


AGENTS = discover_agents()
