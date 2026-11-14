import { appendMessage } from "@/lib/case-store";
import { sourceLinks } from "@/lib/case-data";
import type { ChatMessage } from "@/lib/sample-case";
import type {
  Attachment,
  AttachmentKind,
  ChannelAdapter,
  InboundMessage,
  MessageHandler,
  ReplyMeta,
} from "./types";

// The in-page stand-in for a texting channel. The person at the keyboard plays the case team.
// Nothing is sent over a phone network.
export class SimulatedChannel implements ChannelAdapter {
  readonly name = "simulated";
  private handler: MessageHandler | null = null;

  onMessage(handler: MessageHandler): void {
    this.handler = handler;
  }

  async receiveMessage(message: InboundMessage): Promise<void> {
    const attachment = message.attachments[0];
    const text = attachment
      ? [attachment.name, message.text.trim()].filter(Boolean).join(": ")
      : message.text.trim();
    appendMessage({
      from: "team",
      text,
      ...(attachment ? { attachment: ICON_FOR[attachment.kind] } : {}),
    });
    await this.handler?.(message);
  }

  async sendReply(text: string, meta?: ReplyMeta): Promise<void> {
    appendMessage({ from: "agent", text, ...(meta?.itemId ? { itemId: meta.itemId } : {}) });
  }
}

const ICON_FOR: Record<AttachmentKind, NonNullable<ChatMessage["attachment"]>> = {
  image: "image",
  audio: "voice",
  video: "video",
  document: "document",
};

/**
 * Sample attachments the presenter can "text in". The text each carries stands in for what
 * OCR or a transcript would produce. All are labeled synthetic or derived from the public footage.
 */
export interface SampleAttachment extends Omit<Attachment, "id"> {
  key: string;
  chip: string;
}

export const SAMPLE_ATTACHMENTS: SampleAttachment[] = [
  {
    key: "voice-note",
    chip: "Voice note",
    kind: "audio",
    name: "Team voice note on the dashcam clip (synthetic)",
    mimeType: "audio/m4a",
    url: sourceLinks.dashcam,
    extractedText:
      "Team voice note, transcribed: I rewatched the dashcam angle. The left signal looks like it only starts blinking right as the Mustang reaches the turn, around the 0:55 mark. I can't tell from this angle.",
  },
  {
    key: "still-frame",
    chip: "Still frame",
    kind: "image",
    name: "Still frame from the bodycam, about 0:50",
    mimeType: "image/png",
    url: "https://www.youtube.com/watch?v=Z6z35SUVpdQ&t=50s",
    extractedText:
      "Still frame exported from the public bodycam video at about 0:50. The Mustang's left turn signal lamp appears lit.",
  },
  {
    key: "blurry",
    chip: "Blurry photo",
    kind: "image",
    name: "Photo, too dark to read (synthetic)",
    mimeType: "image/jpeg",
    extractedText: "Photo of a dark, blurred scene. Nothing in it is legible.",
  },
];

let counter = 0;
export function newAttachmentId(): string {
  counter += 1;
  return `${Date.now().toString(36)}-${counter}`;
}
