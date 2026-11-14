import { FileText, Film, Image as ImageIcon, Mic } from "lucide-react";
import { CONVERSATION, type ChatMessage } from "@/lib/sample-case";
import { cn } from "@/lib/utils";

const ICONS = { video: Film, document: FileText, voice: Mic, image: ImageIcon } as const;

interface ChatPanelProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/** Phone-style conversation. Simulated until the message pipeline is built. */
export function ChatPanel({ selectedId, onSelect }: ChatPanelProps) {
  return (
    <div className="mx-auto w-full max-w-sm rounded-[2.25rem] border-4 border-border bg-card p-3 shadow-lg xl:mx-0">
      <div className="flex items-center justify-between px-3 pb-3 pt-1">
        <div>
          <p className="font-serif text-lg font-semibold">Case line</p>
          <p className="text-xs text-muted-foreground">Text evidence to one number</p>
        </div>
        <span className="rounded border border-dashed border-gold px-2 py-0.5 font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Simulated
        </span>
      </div>
      <ol className="max-h-[36rem] space-y-3 overflow-y-auto rounded-3xl bg-background/60 p-3">
        {CONVERSATION.map((m) => (
          <Bubble key={m.id} message={m} active={m.itemId !== undefined && m.itemId === selectedId} onSelect={onSelect} />
        ))}
      </ol>
    </div>
  );
}

function Bubble({ message, active, onSelect }: { message: ChatMessage; active: boolean; onSelect: (id: string) => void }) {
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
    mine ? "ml-auto rounded-br-sm bg-gold text-black" : "mr-auto rounded-bl-sm bg-muted text-foreground",
    active && "ring-2 ring-foreground",
  );
  return (
    <li>
      {message.itemId ? (
        <button type="button" className={cn(cls, "w-fit cursor-pointer")} onClick={() => onSelect(message.itemId!)}>
          {body}
        </button>
      ) : (
        <div className={cn(cls, "w-fit")}>{body}</div>
      )}
    </li>
  );
}
