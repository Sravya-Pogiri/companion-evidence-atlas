import { useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { FileText, Mic, Paperclip, Play, Send, X } from "lucide-react";
import { FrameThumb, PageThumb } from "@/components/caselens/evidence-media";
import { channel } from "@/lib/agent/runtime";
import { useCase } from "@/lib/case-store";
import {
  SAMPLE_ATTACHMENTS,
  newAttachmentId,
  type SampleAttachment,
} from "@/lib/channel/simulated";
import { CASE_LINE } from "@/lib/config";
import { mediaFor } from "@/lib/media";
import { ITEMS, findItem, type ChatMessage, type TimelineItem } from "@/lib/sample-case";
import { cn } from "@/lib/utils";
import { citationsFor, useWorkspace } from "./context";
import { Citations } from "./source-citation";

/**
 * The case line. Simulated: the presenter plays the case team from here. Photon: the team
 * texts from their phones and this mirrors the server's conversation.
 */
export function MessagingPanel() {
  const { messages, items, busy, mode } = useCase();
  const { replaying, focusItem } = useWorkspace();
  const [text, setText] = useState("");
  const [staged, setStaged] = useState<SampleAttachment | null>(null);
  const threadRef = useRef<HTMLOListElement>(null);

  useLayoutEffect(() => {
    const el = threadRef.current;
    if (el)
      el.scrollTo({ top: el.scrollHeight, behavior: messages.length > 1 ? "smooth" : "auto" });
  }, [messages.length, busy]);

  const filed = new Set(items.map((i) => i.id));
  const disabled = busy || replaying;

  function send(e: FormEvent) {
    e.preventDefault();
    if (disabled || (!text.trim() && !staged)) return;
    const attachments = staged ? [{ ...staged, id: newAttachmentId() }] : [];
    setText("");
    setStaged(null);
    void channel.receiveMessage({ text: text.trim(), attachments });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-border bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <p className="text-[13px] text-muted-foreground">
          Text evidence to <span className="font-mono text-foreground">{CASE_LINE}</span>
        </p>
        <span className="rounded border border-border px-1.5 font-mono text-[11px] leading-5 text-muted-foreground">
          {mode === "photon" ? "iMessage via Photon" : "Simulated"}
        </span>
      </div>

      <ol
        ref={threadRef}
        className="lx-scroll min-h-0 flex-1 space-y-2.5 overflow-y-auto px-4 py-4"
        aria-live="polite"
      >
        {messages.length === 0 && (
          <li className="text-[14px] text-muted-foreground">No messages yet.</li>
        )}
        {messages.map((m) => {
          const item = findItem(items, m.itemId) ?? findItem(ITEMS, m.itemId);
          return (
            <Bubble
              key={m.id}
              message={m}
              item={item}
              linkable={!!m.itemId && filed.has(m.itemId)}
              onOpen={() => m.itemId && focusItem(m.itemId)}
            />
          );
        })}
        {busy && (
          <li
            className="lx-fade mr-auto flex w-fit items-center gap-1 rounded-2xl rounded-bl-md bg-[#f1f2f4] px-3.5 py-3"
            aria-label="Reading the message"
          >
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="lx-pulse size-1.5 rounded-full bg-[#9aa2b4]"
                style={{ animationDelay: `${i * 0.2}s`, animationDuration: "1.2s" }}
              />
            ))}
          </li>
        )}
      </ol>

      {mode === "photon" ? (
        <p className="border-t border-border px-4 py-3 text-[13px] text-muted-foreground">
          The team texts {CASE_LINE} from their phones. New evidence lands on the timeline here.
        </p>
      ) : (
        <form onSubmit={send} className="space-y-2 border-t border-border px-3 pb-3 pt-2.5">
          <div
            className="flex flex-wrap items-center gap-1.5"
            role="group"
            aria-label="Attach a sample"
          >
            <Paperclip className="size-3.5 text-muted-foreground" aria-hidden />
            {SAMPLE_ATTACHMENTS.map((a) => (
              <button
                key={a.key}
                type="button"
                disabled={disabled}
                onClick={() => setStaged(staged?.key === a.key ? null : a)}
                aria-pressed={staged?.key === a.key}
                className={cn(
                  "h-7 rounded-md border px-2 text-[13px] transition-colors disabled:opacity-50",
                  staged?.key === a.key
                    ? "border-primary bg-accent text-primary"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {a.chip}
              </button>
            ))}
          </div>
          {staged && (
            <p className="flex items-center justify-between gap-2 rounded-md bg-muted px-3 py-1.5 text-[13px]">
              <span className="truncate">{staged.name}</span>
              <button type="button" onClick={() => setStaged(null)} aria-label="Remove attachment">
                <X className="size-3.5" />
              </button>
            </p>
          )}
          <div className="flex items-center gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={staged ? "Add a note (optional)" : "Text the case line"}
              aria-label="Message"
              className="h-9 min-w-0 flex-1 rounded-md border border-border bg-white px-3 text-[14px] outline-none placeholder:text-muted-foreground focus:border-primary"
            />
            <button
              type="submit"
              disabled={disabled || (!text.trim() && !staged)}
              aria-label="Send"
              className="grid size-9 shrink-0 place-items-center rounded-md bg-foreground text-white disabled:opacity-35"
            >
              <Send className="size-4" />
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function Attachment({ message, item }: { message: ChatMessage; item: TimelineItem | undefined }) {
  const media = item ? mediaFor(item) : null;
  if (message.attachment === "video" && media?.kind === "video") {
    return (
      <span className="relative mb-1.5 block">
        <FrameThumb
          src={media.frame}
          {...(item ? { duration: item.end - item.start } : {})}
          className="aspect-video w-full rounded-lg"
        />
        <span className="absolute inset-0 grid place-items-center">
          <span className="grid size-7 place-items-center rounded-full bg-black/55 text-white">
            <Play className="ml-0.5 size-3.5 fill-current" />
          </span>
        </span>
      </span>
    );
  }
  if (message.attachment === "document" && media?.kind === "page") {
    return (
      <span className="relative mb-1.5 block">
        <PageThumb
          page={media.page}
          highlight
          focusTop
          className="h-24 w-full rounded-lg border border-black/5"
        />
        <span className="absolute bottom-1 right-1 rounded bg-black/65 px-1 font-mono text-[11px] text-white">
          p.{media.page.page}
        </span>
      </span>
    );
  }
  if (message.preview)
    return <FrameThumb src={message.preview} className="mb-1.5 aspect-video w-full rounded-lg" />;
  if (message.attachment === "voice") {
    return (
      <span className="mb-1.5 flex items-center gap-2 rounded-lg bg-black/5 px-2.5 py-2">
        <Mic className="size-3.5 shrink-0" aria-hidden />
        <span className="flex h-4 flex-1 items-center gap-[3px]" aria-hidden>
          {[5, 9, 13, 8, 14, 10, 6, 12, 15, 8, 5, 11, 13, 7].map((h, i) => (
            <span
              key={i}
              className="w-[2px] rounded-full bg-current opacity-60"
              style={{ height: h }}
            />
          ))}
        </span>
      </span>
    );
  }
  if (message.attachment) {
    return (
      <span className="mb-1 flex items-center gap-1.5 text-[13px] font-medium">
        <FileText className="size-3.5" aria-hidden /> Attachment
      </span>
    );
  }
  return null;
}

function Bubble({
  message,
  item,
  linkable,
  onOpen,
}: {
  message: ChatMessage;
  item: TimelineItem | undefined;
  linkable: boolean;
  onOpen: () => void;
}) {
  const mine = message.from === "team";
  const conflict = !mine && (item?.flag === "conflict" || /possible conflict/i.test(message.text));
  const media = !!message.attachment;
  return (
    <li className={cn("lx-slide-in flex flex-col", mine ? "items-end" : "items-start")}>
      <div
        onClick={linkable ? onOpen : undefined}
        className={cn(
          "max-w-[84%] text-[14px] leading-snug",
          media ? "w-[72%] rounded-xl p-1.5 pb-2" : "rounded-xl px-3 py-2",
          mine
            ? "rounded-br-sm bg-foreground text-white"
            : "rounded-bl-sm bg-[#f1f2f4] text-foreground",
          linkable && "cursor-pointer",
        )}
      >
        {conflict && (
          <span className="mb-0.5 flex items-center gap-1.5 text-[12px] font-semibold text-contradiction">
            <span className="size-1.5 rounded-full bg-contradiction" aria-hidden /> Possible
            conflict
          </span>
        )}
        {media && <Attachment message={message} item={item} />}
        <span className={cn("block", media && "px-1")}>{message.text}</span>
      </div>
      {!mine && item && linkable && <Citations cites={citationsFor(item)} className="mt-1" />}
    </li>
  );
}
