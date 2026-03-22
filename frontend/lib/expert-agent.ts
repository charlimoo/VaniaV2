import { API_BASE_URL, getAuthHeaders } from "@/lib/api";
import type { AgentService } from "@/lib/types";

const DEFAULT_EXPERT_AGENT_SLUG = "tarahi-jalasat-ravan-darman";

export async function resolveExpertCaseAgentSlug(): Promise<string> {
  try {
    const headers = getAuthHeaders();
    const res = await fetch(`${API_BASE_URL}/api/services/`, { headers });
    if (!res.ok) return DEFAULT_EXPERT_AGENT_SLUG;
    const services: AgentService[] = await res.json();
    const available = services.filter(
      (service) =>
        service.audience === "EXPERT" &&
        service.requires_visitor_selector === true &&
        (service.access_status === "OWNED" || service.access_status === "FREE")
    );
    const featured = available.find((service) => service.ui_config?.featured);
    return featured?.slug || available[0]?.slug || DEFAULT_EXPERT_AGENT_SLUG;
  } catch {
    return DEFAULT_EXPERT_AGENT_SLUG;
  }
}
