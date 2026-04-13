// Client-safe constants — no Node.js imports here
export const MASKED_SENTINEL = "••••••••";

export function isMaskedValue(value: string): boolean {
  return value === MASKED_SENTINEL;
}
