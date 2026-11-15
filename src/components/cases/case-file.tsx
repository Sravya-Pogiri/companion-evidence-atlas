import { ExternalLink } from "lucide-react";
import { caseMeta, publicCase } from "@/lib/cases";

/**
 * The case file for a public-record case: what the linked public sources say, in one place.
 * It stands in for Case Analysis, which is built around the Rosales documents and footage.
 */
export function CaseFile({ caseId }: { caseId: string }) {
  const c = publicCase(caseId);
  const meta = caseMeta(caseId);
  if (!c) return null;

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6">
      <header>
        <p className="font-mono text-sm text-gold">{meta.label}</p>
        <h1 className="mt-1 font-serif text-3xl font-medium">{c.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {c.location} · {c.type} · {c.category}
        </p>
        <p className="mt-4 rounded-lg border border-dashed border-missing/60 px-4 py-2.5 text-sm text-muted-foreground">
          Summarized from the linked public sources, not from the original records. Findings are
          suggestions. Confirm before use.
        </p>
      </header>

      <section aria-labelledby="summary">
        <h2 id="summary" className="font-serif text-xl">
          Summary
        </h2>
        <p className="mt-2 text-base leading-relaxed">{c.summary}</p>
      </section>

      <section aria-labelledby="facts">
        <h2 id="facts" className="font-serif text-xl">
          Key facts
        </h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          {c.facts.map(([k, v]) => (
            <div key={k} className="rounded-lg border bg-card px-4 py-3">
              <dt className="font-mono text-sm text-muted-foreground">{k}</dt>
              <dd className="mt-0.5 text-base">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="issues">
        <h2 id="issues" className="font-serif text-xl">
          Issues the sources raise
        </h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-base">
          {c.issues.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="evidence">
        <h2 id="evidence" className="font-serif text-xl">
          Evidence in the record
        </h2>
        <ul className="mt-3 space-y-2">
          {c.evidence.map((e) => (
            <li key={e.name} className="rounded-lg border bg-card px-4 py-3">
              <p className="text-base font-medium">{e.name}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{e.desc}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="questions">
        <h2 id="questions" className="font-serif text-xl">
          Questions for the defense team
        </h2>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-base">
          {c.questions.map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="sources">
        <h2 id="sources" className="font-serif text-xl">
          Sources
        </h2>
        <ul className="mt-3 space-y-1.5 text-sm">
          {c.sources.map((s) => (
            <li key={s.url}>
              <a
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-gold hover:underline"
              >
                {s.label} <ExternalLink className="size-4" />
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
