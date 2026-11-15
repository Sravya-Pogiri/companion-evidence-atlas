// Who may text the case line. Pure helpers, no env and no network.
//
// TEAM_NUMBERS is a comma-separated list of phone numbers (any common format) and,
// optionally, iMessage email addresses. An empty list lets nobody in: this line holds case
// material, so it fails closed.

export const NOT_ON_TEAM = "This number is for case team members only.";

/** Digits only, with a missing US country code added: "(720) 722-4393" and "+17207224393" match. */
export function normalizePhone(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) return `1${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return digits;
  return null;
}

function normalizeHandle(value: string): string | null {
  const v = value.trim();
  if (v.includes("@")) return v.toLowerCase();
  return normalizePhone(v);
}

/**
 * Entries are separated by commas, semicolons or new lines, so a number may contain spaces
 * ("+1 (720) 722-4393"). An entry that is not one valid number is tried as a space-separated list.
 */
export function parseTeamNumbers(raw: string | undefined): Set<string> {
  const out = new Set<string>();
  for (const part of (raw ?? "").split(/[,;\n]+/)) {
    const whole = part.trim() ? normalizeHandle(part) : null;
    if (whole) {
      out.add(whole);
      continue;
    }
    for (const piece of part.split(/\s+/)) {
      const n = piece ? normalizeHandle(piece) : null;
      if (n) out.add(n);
    }
  }
  return out;
}

export function isTeamMember(handle: string | null | undefined, team: Set<string>): boolean {
  if (!handle) return false;
  const n = normalizeHandle(handle);
  return n !== null && team.has(n);
}
