import { API_BASE_URL, getAuthHeaders } from "@/lib/api";
import type { AgentService } from "@/lib/types";

const DEFAULT_EXPERT_AGENT_SLUG = "tarahi-jalasat-ravan-darman";

export async function resolveExpertCaseAgentSlug(): Promise<string> {
  try {
    const headers = getAuthHeaders();
    const res = await fetch(`${API_BASE_URL}/api/services/`, { headers });
    if (!res.ok) return DEFAULT_EXPERT_AGENT_SLUG;
    const services: AgentService[] = await res.json();
    const target = services.find(
      (service) =>
        service.audience === "EXPERT" &&
        service.requires_visitor_selector === true &&
        (service.access_status === "OWNED" || service.access_status === "FREE")
    );
    return  DEFAULT_EXPERT_AGENT_SLUG || target?.slug;
  } catch {
    return DEFAULT_EXPERT_AGENT_SLUG;
  }
}
