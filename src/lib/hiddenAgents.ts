/**
 * Agents hidden across the app UI (team lists, chat, storefronts, presence).
 * Their data is untouched in the database — this only affects presentation.
 */
export const HIDDEN_AGENT_USER_IDS: string[] = [
  "122757fd-e24a-459e-9f47-1c6e3238736e", // Robert Pleasant
];

export function isHiddenAgent(userId?: string | null): boolean {
  return !!userId && HIDDEN_AGENT_USER_IDS.includes(userId);
}
