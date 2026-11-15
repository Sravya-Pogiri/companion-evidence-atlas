// Ids for the items and sources built from a public-record case. Shared by the app's items
// (cases.ts) and the documents the Case Analysis tab reads (case-sources.ts), so they line up.

/** A dated event. `n` counts from 1. */
export const eventId = (caseId: string, n: number) => `${caseId}-t${n}`;

/** One side of a finding. `finding` and `side` count from 1 and 0. */
export const sideId = (caseId: string, finding: number, side: number) =>
  `${caseId}-f${finding}-s${side}`;

/** The open-prompts item. */
export const gapId = (caseId: string) => `${caseId}-gap`;
