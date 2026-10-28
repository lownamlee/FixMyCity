import { Conversation } from "@elevenlabs/client";

export type VoiceSessionState = "idle" | "connecting" | "connected" | "disconnecting" | "error";

export interface VoiceSessionSnapshot {
  state: VoiceSessionState;
  error?: string;
}

export interface ElevenLabsClientOptions {
  /** Called whenever connection state changes. */
  onStateChange?: (snapshot: VoiceSessionSnapshot) => void;
  /** Called with agent speech transcripts and other SDK messages. */
  onMessage?: (message: unknown) => void;
}

/**
 * Browser client for the local, same-origin signed URL endpoint.
 * Instantiate and call start() only from a clear user action after explaining
 * microphone use and obtaining consent in the UI.
 */
export class ElevenLabsVoiceClient {
  private conversation: Awaited<ReturnType<typeof Conversation.startSession>> | null = null;
  private readonly options: ElevenLabsClientOptions;
  private snapshot: VoiceSessionSnapshot = { state: "idle" };
  private startInFlight: Promise<void> | null = null;
  private generation = 0;

  constructor(options: ElevenLabsClientOptions = {}) {
    this.options = options;
  }

  get state(): VoiceSessionSnapshot {
    return this.snapshot;
  }

  /**
   * Starts only after explicit consent. The endpoint is same-origin and is
   * asked for a signed URL only after the user activates this action.
   */
  start(consent: boolean): Promise<void> {
    if (!consent) {
      return Promise.reject(new Error("Voice conversation requires your consent."));
    }
    if (this.snapshot.state === "connected") return Promise.resolve();
    if (this.startInFlight) return this.startInFlight;

    const attempt = ++this.generation;
    this.setState("connecting");
    this.startInFlight = this.connect(attempt).finally(() => {
      this.startInFlight = null;
    });
    return this.startInFlight;
  }

  /** Disconnects the conversation and invalidates any pending connection attempt. */
  async disconnect(): Promise<void> {
    ++this.generation;
    const session = this.conversation;
    this.conversation = null;
    if (!session) {
      this.setState("idle");
      return;
    }

    this.setState("disconnecting");
    try {
      await session.endSession();
    } finally {
      this.setState("idle");
    }
  }

  private async connect(attempt: number): Promise<void> {
    try {
      const response = await fetch("/api/voice/elevenlabs/session", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consent: true }),
      });
      if (!response.ok) {
        throw new Error(response.status === 403
          ? "Voice access was not authorized."
          : "Could not prepare the voice conversation. Please try again.");
      }

      const payload: unknown = await response.json();
      const signedUrl = this.readSignedUrl(payload);
      if (attempt !== this.generation) return;

      const session = await Conversation.startSession({
        signedUrl,
        onConnect: () => {
          if (attempt === this.generation) this.setState("connected");
        },
        onDisconnect: () => {
          if (attempt === this.generation) {
            this.conversation = null;
            this.setState("idle");
          }
        },
        onMessage: (message) => this.options.onMessage?.(message),
        onError: (error) => {
          if (attempt === this.generation) this.setState("error", this.describeError(error));
        },
      });

      if (attempt !== this.generation) {
        await session.endSession();
        return;
      }
      this.conversation = session;
      // Some SDK transports may resolve before the connect event is delivered.
      if (this.snapshot.state === "connecting") this.setState("connected");
    } catch (error) {
      if (attempt === this.generation) {
        const message = this.describeError(error);
        this.setState("error", message);
        throw new Error(message, { cause: error });
      }
    }
  }

  private readSignedUrl(value: unknown): string {
    if (typeof value !== "object" || value === null || !("signedUrl" in value) ||
        typeof value.signedUrl !== "string" || !value.signedUrl.startsWith("wss://")) {
      throw new Error("The voice session endpoint returned an invalid response.");
    }
    return value.signedUrl;
  }

  private describeError(error: unknown): string {
    if (error instanceof Error && /permission|microphone|denied/i.test(error.message)) {
      return "Microphone access was denied. Allow microphone access to use voice.";
    }
    return error instanceof Error ? error.message : "The voice conversation could not be started.";
  }

  private setState(state: VoiceSessionState, error?: string): void {
    this.snapshot = error ? { state, error } : { state };
    this.options.onStateChange?.(this.snapshot);
  }
}
