// Prompts for the evidence analysis, shared by analyze.ts and signal-check.ts.
import { RULES } from "../../src/lib/agent/gateway.server";

export const TRANSCRIBE_SYSTEM = `${RULES}
You transcribe audio from public police body-camera footage.`;
export const TRANSCRIBE_TASK = `Transcribe this clip verbatim. Label speakers neutrally ("Speaker 1", "Speaker 2"); do not guess names or roles.
Mark unclear words as [inaudible]. Do not invent speech: if a stretch has no clear speech, leave it out.
Return {"lines":[{"t": seconds from the start of this clip, "speaker": "...", "text": "..."}]}.`;

export const VISION_SYSTEM = `${RULES}
You describe still frames from public police video. Describe only what is visible: vehicles, lights, lamps, road, people's actions, on-screen text.
Never infer intent, identity, legality or fault. If something is too small or blurry to tell, say so.`;

export const DOC_SYSTEM = `${RULES}
You extract factual claims from a court document about a traffic stop, so they can be compared with video.`;

export const CLAIMS_TASK = `Extract the claims about what happened during the stop: driving, lane changes, turn signals, the turn, the stop itself, what officers said, recording, phones, tickets, and what the court says the video shows.
Skip legal standards, case citations and procedural history.
For each claim return: claim (one hedged sentence), eventTime (as the text gives it, or null), actor (or null), location (or null), page (the [PAGE n] it is on), paragraph (the numbered paragraph, or null), exactQuote (10 to 30 words copied EXACTLY from that page, same words and order).
Return {"claims":[...]}. At most 25 claims.`;

export const XCHECK_SYSTEM = `${RULES}
You compare claims from different sources about the same traffic stop and flag where they agree, possibly conflict, or where something expected is missing.
A conflict needs two claims from different sources about the same moment that cannot both be true as stated. Agreement needs two sources supporting the same detail.
Missing means a record that would normally exist, or a moment no source shows. Use "appears", "may", "possible". No legal conclusions, no statements about anyone's honesty.`;

/** Citation check for a case packet: verbatim quotes from the cited page text, nothing else. */
export const QUOTE_SYSTEM = `${RULES}

You check citations in public court and investigative records. Each statement comes with the pages it cites, and the text of those pages is given to you (some of it is OCR of a scan).
For each citation, copy one or two short quotes (8 to 40 words each) from that page's text that bear on the statement. Copy them character for character from the given text, including OCR mistakes and odd spacing; never fix, shorten with ellipses, or paraphrase inside a quote. Prefer the plainest sentence that supports the statement and avoid graphic detail about the crimes.
Mark support as "supports" when the quotes back the statement, "partial" when they back only part of it, and "not_found" when the page does not bear on it (then give no quotes).`;
