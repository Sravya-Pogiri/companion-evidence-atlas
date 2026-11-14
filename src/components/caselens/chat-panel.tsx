import { useEffect, useRef, useState, type FormEvent } from "react";
import { FileText, Film, Image as ImageIcon, Mic, Paperclip, Send, X } from "lucide-react";
import { channel } from "@/lib/agent/runtime";
import { useCase } from "@/lib/case-store";
import {
  SAMPLE_ATTACHMENTS,
  newAttachmentId,
  type SampleAttachment,
} from "@/lib/channel/simulated";
import type { ChatMessage } from "@/lib/sample-case";
import { cn } from "@/lib/utils";

const ICONS = { video: Film, document: FileText, voice: Mic, image: ImageIcon } as const;

interface ChatPanelProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/**
 * Phone-style conversation. Simulated: the presenter plays the case team from here.
 * Photon: the conversation happens over iMessage and this only shows it.
 */
export function ChatPanel({ selectedId, onSelect }: ChatPanelProps) {
  const { messages, items, busy, mode } = useCase();
  const [text, setText] = useState("");
  const [staged, setStaged] = useState<SampleAttachment | null>(null);
  const endRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, busy]);

  // Only filed items are on the timeline, so only those can be selected from a bubble.
  const filedIds = new Set(items.filter((i) => i.status === "filed").map((i) => i.id));

  function send(e: FormEvent) {
    e.preventDefault();
    if (busy || (!text.trim() && !staged)) return;
    const attachments = staged ? [{ ...staged, id: newAttachmentId() }] : [];
    const message = { text: text.trim(), attachments };
    setText("");
    setStaged(null);
    void channel.receiveMessage(message);
  }

  return (
    <div className="mx-auto w-full max-w-sm rounded-[2.25rem] border-4 border-border bg-card p-3 shadow-lg xl:mx-0">
      <div className="flex items-center justify-between px-3 pb-3 pt-1">
        <div>
          <p className="font-serif text-lg font-semibold">Case line</p>
          <p className="text-xs text-muted-foreground">Text evidence to one number</p>
        </div>
        <span className="rounded border border-dashed border-gold px-2 py-0.5 font-mono text-xs uppercase tracking-wider text-muted-foreground">
          {mode === "photon" ? "Photon · iMessage" : "Simulated"}
        </span>
      </div>
      <ol
        className="h-[30rem] space-y-3 overflow-y-auto rounded-3xl bg-background/60 p-3"
        aria-live="polite"
      >
        {messages.map((m) => (
          <Bubble
            key={m.id}
            message={m}
            active={m.itemId !== undefined && m.itemId === selectedId}
            linkable={m.itemId !== undefined && filedIds.has(m.itemId)}
            onSelect={onSelect}
          />
        ))}
        {busy && (
          <li className="mr-auto w-fit rounded-2xl rounded-bl-sm bg-muted px-4 py-2.5 text-base text-muted-foreground">
            Checking…
          </li>
        )}
        <li ref={endRef} aria-hidden />
      </ol>

      {mode === "photon" ? (
        <p className="px-3 pb-2 pt-3 text-sm text-muted-foreground">
          Text the case line from your phone. The conversation and timeline update here.
        </p>
      ) : (
        <form onSubmit={send} className="mt-3 space-y-2 px-1 pb-1">
          <div
            className="flex flex-wrap items-center gap-2"
            role="group"
            aria-label="Attach a sample"
          >
            <Paperclip className="size-4 text-muted-foreground" aria-hidden />
            {SAMPLE_ATTACHMENTS.map((a) => (
              <button
                key={a.key}
                type="button"
                disabled={busy}
                onClick={() => setStaged(staged?.key === a.key ? null : a)}
                aria-pressed={staged?.key === a.key}
                className={cn(
                  "rounded-full border px-3 py-1 text-sm hover:border-gold disabled:opacity-50",
                  staged?.key === a.key && "border-gold bg-gold/15",
                )}
              >
                {a.chip}
              </button>
            ))}
          </div>
          {staged && (
            <p className="flex items-center justify-between gap-2 rounded-lg bg-muted px-3 py-1.5 text-sm">
              <span className="truncate">{staged.name}</span>
              <button type="button" onClick={() => setStaged(null)} aria-label="Remove attachment">
                <X className="size-4" />
              </button>
            </p>
          )}
          <div className="flex items-center gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={staged ? "Add a note (optional)" : "Text the case line"}
              aria-label="Message"
              className="min-w-0 flex-1 rounded-full border bg-background px-4 py-2 text-base outline-none focus:border-gold"
            />
            <button
              type="submit"
              disabled={busy || (!text.trim() && !staged)}
              aria-label="Send"
              className="grid size-10 shrink-0 place-items-center rounded-full bg-gold text-black disabled:opacity-40"
            >
              <Send className="size-4" />
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function Bubble({
  message,
  active,
  linkable,
  onSelect,
}: {
  message: ChatMessage;
  active: boolean;
  linkable: boolean;
  onSelect: (id: string) => void;
}) {
  const Icon = message.attachment ? ICONS[message.attachment] : null;
  const mine = message.from === "team";
  const body = (
    <>
      {Icon && (
        <span className="mb-1 flex items-center gap-1.5 text-sm font-medium">
          <Icon className="size-4" /> Attachment
        </span>
      )}
      <span className="text-base leading-snug">{message.text}</span>
    </>
  );
  const cls = cn(
    "block max-w-[85%] rounded-2xl px-4 py-2.5 text-left",
    mine
      ? "ml-auto rounded-br-sm bg-gold text-black"
      : "mr-auto rounded-bl-sm bg-muted text-foreground",
    active && "ring-2 ring-foreground",
  );
  return (
    <li>
      {linkable ? (
        <button
          type="button"
          className={cn(cls, "w-fit cursor-pointer")}
          onClick={() => onSelect(message.itemId!)}
        >
          {body}
        </button>
      ) : (
        <div className={cn(cls, "w-fit")}>{body}</div>
      )}
    </li>
  );
}
