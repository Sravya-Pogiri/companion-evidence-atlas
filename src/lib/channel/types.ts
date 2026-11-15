// A channel is where the case team texts evidence and where the agent texts back.
// SimulatedChannel (in the page) and PhotonChannel (Phase 4) both implement this,
// so the agent never knows which transport it is talking through.

export type AttachmentKind = "image" | "audio" | "video" | "document";

/** An error whose message is already in plain words and safe to text back to a person. */
export class PlainError extends Error {}

export interface Attachment {
  id: string;
  kind: AttachmentKind;
  /** Short human name, also used as the source label, e.g. "Complaint, page 24". */
  name: string;
  mimeType?: string;
  /** Link to the original. Becomes the item's source link. */
  url?: string;
  /**
   * Text already read from the attachment (OCR or a transcript). The simulated channel
   * supplies it. A real channel leaves it out until an extraction step exists.
   */
  extractedText?: string;
  /** A thumbnail to show in the conversation (sample attachments only). */
  previewUrl?: string;
  /** Set when the file could not be downloaded or read, in plain words. The pipeline passes it on. */
  readError?: string;
}

export interface InboundMessage {
  text: string;
  attachments: Attachment[];
  /**
   * Which conversation it came from, when the channel has more than one person texting it.
   * Replies are sent back to that conversation, and a "Y" only counts from the one it was asked of.
   */
  conversationId?: string;
  /** Who sent it (an E.164 phone number or an iMessage email), when the channel knows. Never shown in the page. */
  sender?: string;
}

export interface ReplyMeta {
  /** The timeline item this reply is about, so the chat can link to it. */
  itemId?: string;
  /** The conversation to send this reply to (copied from the message it answers). */
  conversationId?: string;
}

export type MessageHandler = (message: InboundMessage) => Promise<void>;

export interface ChannelAdapter {
  readonly name: string;
  /** The transport calls this when a message arrives from the case team. */
  receiveMessage(message: InboundMessage): Promise<void>;
  /** The agent calls this to text something back. */
  sendReply(text: string, meta?: ReplyMeta): Promise<void>;
  /** The agent registers itself here to receive messages. */
  onMessage(handler: MessageHandler): void;
}
