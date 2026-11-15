// Answering a question from the stored case files. Pure apart from the model call it is given.
//
// The model only words the answer. Code decides what it may use (the retrieved passages), checks
// what comes back (every sentence cited with a label that was actually retrieved, short, no
// conclusions) and falls back to quoting the closest passage when the model is missing or fails.
import { retrieve, tokens, type Scored } from "./case-knowledge";
import { hasConclusion } from "./pipeline";

export const NOT_IN_FILES = "I don't see that in the case files.";

export interface Turn {
  question: string;
  answer: string;
}

export interface AnswerInput {
  question: string;
  /** This person's last few exchanges, oldest first, so a follow-up can be understood. */
  history: Turn[];
  passages: { cite: string; text: string }[];
}

/** Returns the model's answer text. Throws an Error with a plain-words message when it cannot. */
export type AnswerFn = (input: AnswerInput) => Promise<string>;

const MAX_TURNS = 3;

/** A short memory per conversation. Lives in the server process, like the rest of the case state. */
export class QaMemory {
  private readonly turns = new Map<string, Turn[]>();
  recent(who: string): Turn[] {
    return this.turns.get(who) ?? [];
  }
  add(who: string, turn: Turn): void {
    this.turns.set(who, [...this.recent(who), turn].slice(-MAX_TURNS));
  }
}

const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
const clip = (t: string, max: number) => (t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t);

/**
 * Checks a model answer. Returns the answer text if it is safe to send, NOT_IN_FILES if the model
 * said so, and null if it broke a rule (so the caller can fall back).
 */
export function validateAnswer(raw: string, allowedCites: string[]): string | null {
  const answer = raw.replace(/\s+/g, " ").trim();
  if (!answer) return null;
  if (/don'?t see that in the case files/i.test(answer)) return NOT_IN_FILES;
  if (answer.length > 520 || hasConclusion(answer)) return null;

  const allowed = new Set(allowedCites.map(norm));
  // Every parenthesis must be a citation made of retrieved labels, separated by semicolons.
  for (const m of answer.matchAll(/\(([^)]*)\)/g)) {
    const parts = m[1]!.split(";").map(norm).filter(Boolean);
    if (parts.length === 0 || !parts.every((p) => allowed.has(p))) return null;
  }
  // Up to four sentences, and each one carries a citation.
  const shielded = answer.replace(/\([^)]*\)/g, "(C)");
  const sentences = shielded.split(/(?<=[.!?])\s+(?=[A-Z"“(])/).filter((s) => s.trim());
  if (sentences.length === 0 || sentences.length > 4) return null;
  if (!sentences.every((s) => s.includes("(C)"))) return null;
  return answer;
}

/** No model, or it failed: quote the closest passages instead of guessing. */
export function extractiveAnswer(passages: Scored[]): string {
  const usable = passages.filter((p) => !hasConclusion(p.text)).slice(0, 2);
  if (usable.length === 0) {
    const first = passages[0];
    return first
      ? `The files discuss this (${first.cite}), but I can't summarize it neutrally. Please read it directly.`
      : NOT_IN_FILES;
  }
  // The paraphrase, not the long quote, so it fits a text message.
  const short = (t: string) => clip(t.split(" Quote:")[0]!.trim(), 200);
  return `Closest match in the files: ${usable.map((p) => `${short(p.text)} (${p.cite})`).join(" ")}`;
}

const FOLLOW_UP = /^(?:and|also|then|so|what about|how about|what of)\b/i;

/** The search text: a short follow-up borrows the person's previous question. */
export function searchText(question: string, history: Turn[]): string {
  const last = history[history.length - 1];
  const short = tokens(question).length <= 4 || FOLLOW_UP.test(question.trim());
  return short && last ? `${last.question} ${question}` : question;
}

export async function answerQuestion(
  question: string,
  who: string,
  memory: QaMemory,
  ask?: AnswerFn,
): Promise<string> {
  const history = memory.recent(who);
  const passages = retrieve(searchText(question, history), undefined, 6, question);

  let answer: string;
  if (passages.length === 0) {
    answer = NOT_IN_FILES;
  } else if (!ask) {
    answer = extractiveAnswer(passages);
  } else {
    try {
      const raw = await ask({
        question,
        history,
        passages: passages.map(({ cite, text }) => ({ cite, text })),
      });
      answer =
        validateAnswer(
          raw,
          passages.map((p) => p.cite),
        ) ?? extractiveAnswer(passages);
    } catch {
      answer = extractiveAnswer(passages);
    }
  }
  memory.add(who, { question, answer });
  return answer;
}
