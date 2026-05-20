import type { OperatingPolicy } from "amotion";

export const LANGGRAPH_END = "__end__";

export type LangGraphRouteMap = {
  proceed: string;
  verify: string;
  replan: string;
  escalate: string;
  abort: string;
};

export const DEFAULT_LANGGRAPH_ROUTES: LangGraphRouteMap = {
  proceed: "proceed",
  verify: "verify",
  replan: "replan",
  escalate: "escalate",
  abort: LANGGRAPH_END
};

export function routeByOperatingPolicy(
  policy: OperatingPolicy,
  routes: Partial<LangGraphRouteMap> = {}
): string {
  const routeMap = { ...DEFAULT_LANGGRAPH_ROUTES, ...routes };
  if (policy.stop) return routeMap.abort;
  return routeMap[policy.control];
}
