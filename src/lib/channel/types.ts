// A channel is where the case team texts evidence and where the agent texts back.
// SimulatedChannel (in the page) and PhotonChannel (Phase 4) both implement this,
// so the agent never knows which transport it is talking through.

export type AttachmentKind = "image" | "audio" | "video" | "document";

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
}

export interface InboundMessage {
  text: string;
  attachments: Attachment[];
}

export interface ReplyMeta {
  /** The timeline item this reply is about, so the chat can link to it. */
  itemId?: string;
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
