import type { RouterConfig, RouterModel } from "../types";

export function availableChatModels(config: RouterConfig | null | undefined): RouterModel[] {
  const source = config?.available_models ?? config?.models ?? [];
  const seen = new Set<string>();
  return source.filter((model) => {
    if (!(model.enabled && model.authorized)) return false;
    const route = `${model.provider.trim().toLowerCase()}\u0000${model.model.trim().toLowerCase()}`;
    if (!model.provider.trim() || !model.model.trim() || seen.has(route)) return false;
    seen.add(route);
    return true;
  });
}

export function chatModelOptionLabel(model: RouterModel): string {
  const name = model.label || model.model;
  return `${name} · ${model.provider} · ${model.tier}${model.active ? " · active" : ""}`;
}
