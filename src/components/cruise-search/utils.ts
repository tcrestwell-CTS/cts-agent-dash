import { format, parseISO } from "date-fns";
import {
  AVAILABLE_OPERATORS,
  RIVER_OPERATORS,
  FAMILY_OPERATORS,
  LUXURY_OPERATORS,
  ADULTS_OPERATORS,
  PROMOTION_KEYWORDS,
  type WidgetySailing,
  type WidgetyPricingDeal,
} from "./types";

export const formatShortDate = (d?: string) => {
  if (!d) return "";
  try {
    return format(parseISO(d), "MMM d, yyyy");
  } catch {
    return d;
  }
};

export const formatMonthYear = (d?: string) => {
  if (!d) return "";
  try {
    return format(parseISO(d), "MMM yyyy");
  } catch {
    return d;
  }
};

export const formatPrice = (v: number | null | undefined) => {
  if (v == null || isNaN(v)) return "—";
  return `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
};

export const getOperatorLabel = (slug: string) => {
  return AVAILABLE_OPERATORS.find((o) => o.slug === slug)?.label || slug;
};

export const getCruiseType = (operatorSlug: string): "ocean" | "river" => {
  return RIVER_OPERATORS.has(operatorSlug) ? "river" : "ocean";
};

export const getAudienceTags = (operatorSlug: string): ("family" | "luxury" | "adults")[] => {
  const tags: ("family" | "luxury" | "adults")[] = [];
  if (FAMILY_OPERATORS.has(operatorSlug)) tags.push("family");
  if (LUXURY_OPERATORS.has(operatorSlug)) tags.push("luxury");
  if (ADULTS_OPERATORS.has(operatorSlug)) tags.push("adults");
  return tags;
};

export const operatorSlugFromTitle = (title?: string): string => {
  if (!title) return "";
  const lower = title.toLowerCase();
  return AVAILABLE_OPERATORS.find((op) => op.label.toLowerCase() === lower)?.slug || "";
};

export const getPromotionTags = (deals?: WidgetyPricingDeal[]): string[] => {
  if (!deals?.length) return [];
  const tags = new Set<string>();
  const haystack = deals.map((d) => `${d.name} ${d.description || ""}`.toLowerCase()).join(" ");
  for (const [key, words] of Object.entries(PROMOTION_KEYWORDS)) {
    if (words.some((w) => haystack.includes(w))) tags.add(key);
  }
  return Array.from(tags);
};

export const promotionLabel = (key: string): string => {
  const map: Record<string, string> = {
    obc: "Onboard Credit",
    reduced_deposit: "Reduced Deposit",
    free_drinks: "Drinks Included",
    free_wifi: "Wi-Fi Included",
    kids_sail_free: "Kids Sail Free",
  };
  return map[key] || key;
};

export const getPortPreview = (sailing: WidgetySailing): string => {
  const parts: string[] = [];
  if (sailing.starts_at?.name) parts.push(sailing.starts_at.name);
  if (sailing.ends_at?.name && sailing.ends_at.name !== sailing.starts_at?.name) {
    parts.push(sailing.ends_at.name);
  }
  return parts.join(" → ");
};

export const getMonthKey = (d?: string): string => {
  if (!d) return "";
  try {
    return format(parseISO(d), "yyyy-MM");
  } catch {
    return "";
  }
};