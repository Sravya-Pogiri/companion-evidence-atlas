import { useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { FileText, Mic, Paperclip, Play, Send, X } from "lucide-react";
import { FrameThumb, PageThumb } from "@/components/caselens/evidence-media";
import { LogoMark } from "@/components/caselens/logo";
import { channel } from "@/lib/agent/runtime";
import { useCase } from "@/lib/case-store";
import {
  SAMPLE_ATTACHMENTS,
  newAttachmentId,
  type SampleAttachment,
} from "@/lib/channel/simulated";
import { APP_NAME, CASE_LINE } from "@/lib/config";
import { mediaFor } from "@/lib/media";
import { ITEMS, findItem, type ChatMessage, type TimelineItem } from "@/lib/sample-case";
import { cn } from "@/lib/utils";

interface ChatPanelProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** True while the demo is playing; the composer waits. */
  locked?: boolean;
  /** A sample conversation to read. There is no composer. */
  readOnly?: boolean;
  className?: string;
}

/**
 * Phone-style conversation. Simulated: the presenter plays the case team from here.
 * Photon: the conversation happens over iMessage and this only shows it.
 */
export function ChatPanel({
  selectedId,
  onSelect,
  locked = false,
  readOnly = false,
  className,
}: ChatPanelProps) {
  const { messages, items, busy, mode } = useCase();
  const [text, setText] = useState("");
  const [staged, setStaged] = useState<SampleAttachment | null>(null);
  const threadRef = useRef<HTMLOListElement>(null);

  // Keep the newest message in view by scrolling the thread itself, never the page.
  useLayoutEffect(() => {
    const el = threadRef.current;
    if (el)
      el.scrollTo({ top: el.scrollHeight, behavior: messages.length > 1 ? "smooth" : "auto" });
  }, [messages.length, busy]);

  const filedIds = new Set(items.filter((i) => i.status === "filed").map((i) => i.id));
  const disabled = busy || locked;

  function send(e: FormEvent) {
    e.preventDefault();
    if (disabled || (!text.trim() && !staged)) return;
    const attachments = staged ? [{ ...staged, id: newAttachmentId() }] : [];
    const message = { text: text.trim(), attachments };
    setText("");
    setStaged(null);
    void channel.receiveMessage(message);
  }

  return (
    <div
      className={cn(
        "flex w-full flex-col overflow-hidden rounded-[2.25rem] border border-white/10 bg-[#121216] p-2 shadow-[0_20px_60px_-20px_rgb(0_0_0/0.8)]",
        className,
      )}
    >
      <div className="flex items-center gap-3 border-b border-white/[0.06] px-3 pb-3 pt-2">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#24242c] text-foreground">
          <LogoMark className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight">{APP_NAME}</p>
          <p className="font-mono text-[13px] leading-tight text-muted-foreground">{CASE_LINE}</p>
        </div>
        <span className="shrink-0 rounded-full border border-white/10 px-2 py-0.5 text-[13px] text-muted-foreground">
          {readOnly ? "Sample" : mode === "photon" ? "iMessage" : "Simulated"}
        </span>
      </div>

      <ol
        ref={threadRef}
        className="lx-thread min-h-0 flex-1 space-y-2.5 overflow-y-auto px-2.5 py-3"
        aria-live="polite"
      >
        {messages.map((m) => (
          <Bubble
            key={m.id}
            message={m}
            // Fall back to the sample so a thumbnail shows before the item is filed.
            item={findItem(items, m.itemId) ?? findItem(ITEMS, m.itemId)}
            active={m.itemId !== undefined && m.itemId === selectedId}
            linkable={m.itemId !== undefined && filedIds.has(m.itemId)}
            onSelect={onSelect}
          />
        ))}
        {busy && (
          <li
            className="lx-fade mr-auto flex w-fit items-center gap-1 rounded-2xl rounded-bl-md bg-[#24242c] px-3.5 py-3"
            aria-label="Lexora is typing"
          >
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="lx-pulse size-1.5 rounded-full bg-muted-foreground"
                style={{ animationDelay: `${i * 0.2}s`, animationDuration: "1.2s" }}
              />
            ))}
          </li>
        )}
      </ol>

      {readOnly ? (
        <p className="border-t border-white/[0.06] px-3 py-3 text-sm text-muted-foreground">
          A sample conversation for this public-record case. Filing new evidence by text runs on the
          Rosales footage case.
        </p>
      ) : mode === "photon" ? (
        <p className="border-t border-white/[0.06] px-3 py-3 text-sm text-muted-foreground">
          Text {CASE_LINE} from your phone. The conversation and timeline update here.
        </p>
      ) : (
        <form onSubmit={send} className="space-y-2 border-t border-white/[0.06] px-2 pb-1.5 pt-2.5">
          <div
            className="flex flex-wrap items-center gap-1.5"
            role="group"
            aria-label="Attach a sample"
          >
            <Paperclip className="size-4 text-muted-foreground" aria-hidden />
            {SAMPLE_ATTACHMENTS.map((a) => (
              <button
                key={a.key}
                type="button"
                disabled={disabled}
                onClick={() => setStaged(staged?.key === a.key ? null : a)}
                aria-pressed={staged?.key === a.key}
                className={cn(
                  "rounded-full border border-white/10 px-2.5 py-0.5 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50",
                  staged?.key === a.key && "border-white/30 bg-white/[0.06] text-foreground",
                )}
              >
                {a.chip}
              </button>
            ))}
          </div>
          {staged && (
            <p className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.05] px-3 py-1.5 text-sm">
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
              placeholder={staged ? "Add a note (optional)" : "Text message"}
              aria-label="Message"
              className="min-w-0 flex-1 rounded-full border border-white/10 bg-transparent px-4 py-2 text-[15px] outline-none placeholder:text-muted-foreground focus:border-white/25"
            />
            <button
              type="submit"
              disabled={disabled || (!text.trim() && !staged)}
              aria-label="Send"
              className="grid size-9 shrink-0 place-items-center rounded-full bg-gold text-[#14120d] disabled:opacity-35"
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
          className="aspect-video w-full rounded-xl"
        />
        <span className="absolute inset-0 grid place-items-center">
          <span className="grid size-8 place-items-center rounded-full bg-black/55 text-white">
            <Play className="ml-0.5 size-4 fill-current" />
          </span>
        </span>
      </span>
    );
  }
  if (message.attachment === "document" && media?.kind === "page") {
    return (
      <span className="relative mb-1.5 block">
        <PageThumb page={media.page} highlight focusTop className="h-28 w-full rounded-xl" />
        <span className="absolute bottom-1.5 right-1.5 rounded bg-black/70 px-1.5 py-px font-mono text-[13px] text-white">
          p.{media.page.page}
        </span>
      </span>
    );
  }
  if (message.preview) {
    return <FrameThumb src={message.preview} className="mb-1.5 aspect-video w-full rounded-xl" />;
  }
  if (message.attachment === "voice") {
    return (
      <span className="mb-1.5 flex items-center gap-2 rounded-xl bg-black/10 px-2.5 py-2">
        <Mic className="size-4 shrink-0" aria-hidden />
        <span className="flex h-5 flex-1 items-center gap-[3px]" aria-hidden>
          {[5, 9, 14, 8, 16, 11, 6, 13, 17, 9, 5, 12, 15, 7, 10, 6, 4].map((h, i) => (
            <span
              key={i}
              className="w-[3px] rounded-full bg-current opacity-70"
              style={{ height: h }}
            />
          ))}
        </span>
        <span className="font-mono text-[13px]">0:12</span>
      </span>
    );
  }
  if (message.attachment) {
    return (
      <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
        <FileText className="size-4" aria-hidden /> Attachment
      </span>
    );
  }
  return null;
}

function Bubble({
  message,
  item,
  active,
  linkable,
  onSelect,
}: {
  message: ChatMessage;
  item: TimelineItem | undefined;
  active: boolean;
  linkable: boolean;
  onSelect: (id: string) => void;
}) {
  const mine = message.from === "team";
  const conflict = !mine && (item?.flag === "conflict" || /possible conflict/i.test(message.text));
  const hasMedia = !!message.attachment;
  const body = (
    <>
      {conflict && (
        <span className="mb-1 flex items-center gap-1.5 text-[13px] font-semibold text-[#ff6b70]">
          <span className="size-1.5 rounded-full bg-contradiction" aria-hidden /> Possible conflict
        </span>
      )}
      {hasMedia && <Attachment message={message} item={item} />}
      <span className={cn("block text-[15px] leading-snug", hasMedia && "px-1")}>
        {message.text}
      </span>
    </>
  );
  const cls = cn(
    "lx-slide-in block w-fit max-w-[86%] text-left",
    hasMedia ? "w-[78%] rounded-2xl p-1.5 pb-2" : "rounded-2xl px-3.5 py-2",
    mine
      ? "ml-auto rounded-br-md bg-gold text-[#17140e]"
      : "mr-auto rounded-bl-md bg-[#24242c] text-foreground",
    active && "ring-2 ring-white/70",
  );
  return (
    <li>
      {linkable ? (
        <button
          type="button"
          className={cn(cls, "cursor-pointer")}
          onClick={() => onSelect(message.itemId!)}
        >
          {body}
        </button>
      ) : (
        <div className={cls}>{body}</div>
      )}
    </li>
  );
}
