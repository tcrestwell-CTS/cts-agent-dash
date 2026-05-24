export const CAR_RENTAL_PORTALS: Record<string, string> = {
  enterprise: "https://www.enterprise.com",
  national:   "https://www.nationalcar.com",
  alamo:      "https://www.alamo.com",
  hertz:      "https://www.hertz.com",
  thrifty:    "https://www.thrifty.com",
  dollar:     "https://www.dollar.com",
  sixt:       "https://www.sixt.com",
  avis:       "https://www.avis.com",
  budget:     "https://www.budget.com",
  fox:        "https://www.foxrentacar.com",
  europcar:   "https://www.europcar.com",
};

export function getProviderPortal(providerKey?: string | null): string | null {
  if (!providerKey) return null;
  return CAR_RENTAL_PORTALS[providerKey.toLowerCase().trim()] ?? null;
}