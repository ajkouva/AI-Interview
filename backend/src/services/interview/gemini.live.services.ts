import { GoogleGenAI, Modality } from "@google/genai";
import type { WebSocket } from "ws";
import type { LiveInterviewContext, ServerMessage, LiveTranscriptTurn } from "./interview.types";
import { buildLiveInterviewPrompt } from "./interview.prompt";
import { prisma } from "../../config/db";

export class GeminiLiveService {
    private ai: GoogleGenAI;
    private geminiSession: any = null;
    private clientWs: WebSocket;
    private context: LiveInterviewContext;
    private isConnected: boolean = false;

    public currentAiTurnText: string = "";
    public currentUserTurnText: string = "";
    private transcriptHistory: LiveTranscriptTurn[] = [];
    private isSyncingTranscript: boolean = false;
    private pendingTranscriptSync: boolean = false;
    private wrapUpTimer: ReturnType<typeof setTimeout> | null = null;
    public onConclude?: () => void;

    constructor(clientWs: WebSocket, context: LiveInterviewContext) {
        this.clientWs = clientWs;
        this.context = context;
        this.ai = new GoogleGenAI({
            apiKey: process.env.GEMINI_API_KEY,
        });
    }

    private async syncTranscriptToDb(): Promise<void> {
        if (this.isSyncingTranscript) {
            this.pendingTranscriptSync = true;
            return;
        }
        this.isSyncingTranscript = true;
        try {
            await prisma.interviewSession.update({
                where: { id: this.context.sessionId },
                data: {
                    transcript: this.transcriptHistory as any,
                },
            });
        } catch (err) {
            console.error(`[DB Error] Failed to update real-time transcript:`, err);
        } finally {
            this.isSyncingTranscript = false;
            if (this.pendingTranscriptSync) {
                this.pendingTranscriptSync = false;
                void this.syncTranscriptToDb();
            }
        }
    }

    public recordTurn(speaker: "ai" | "user", text: string) {
        const clean = text.trim();
        if (clean) {
            this.transcriptHistory.push({
                speaker,
                text: clean,
                timestamp: new Date(),
            });

            // 💾 Debounced serialized PostgreSQL update to prevent race conditions
            void this.syncTranscriptToDb();
        }
    }

    public flushTurns() {
        if (this.currentAiTurnText.trim()) {
            this.recordTurn("ai", this.currentAiTurnText);
            this.currentAiTurnText = "";
        }
        if (this.currentUserTurnText.trim()) {
            this.recordTurn("user", this.currentUserTurnText);
            this.currentUserTurnText = "";
        }
    }

    public getTranscript(): LiveTranscriptTurn[] {
        this.flushTurns();
        return this.transcriptHistory;
    }

    private sendToClient(message: ServerMessage) {
        if (this.clientWs.readyState === this.clientWs.OPEN) {
            this.clientWs.send(JSON.stringify(message));
        } else {
            console.log("Client is not connected, skipping message", message);
        }
    }

    public async initializeSession(): Promise<void> {
        const systemPrompt = buildLiveInterviewPrompt(this.context);
        const voiceName = this.context.voiceName || "Aoede";

        try {
            this.geminiSession = await this.ai.live.connect({
                model: process.env.VOICE_MODEL || "gemini-2.5-flash-live",
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: {
                                voiceName: voiceName,
                            },
                        },
                    },

                    systemInstruction: {
                        parts: [{ text: systemPrompt }],
                    },
                },

                callbacks: {
                    onopen: async () => {
                        this.isConnected = true;
                        console.log(`🎙️ [Gemini Live] Connected for session: ${this.context.sessionId}`);
                        this.sendToClient({
                            type: 'STATUS',
                            message: 'AI Live Session established',
                        });

                        this.sendInitialGreeting();
                    },

                    onmessage: async (message: any) => {
                        this.handleGeminiMessage(message);
                    },

                    onerror: (err: any) => {
                        console.error(`❌ [Gemini Live Error] (Session: ${this.context.sessionId}):`, err);
                        this.sendToClient({
                            type: "ERROR",
                            message: "Gemini live connection encountered an error",
                        });
                    },

                    onclose: () => {
                        console.log(`🔌 [Gemini Live Closed] for session: ${this.context.sessionId}`);
                        this.isConnected = false;
                    },

                },
            });
        } catch (error: any) {
            console.error("Failed to connect to Gemini Live:", error);
            this.sendToClient({
                type: "ERROR",
                message: "Failed to initialize Gemini Live AI session",
            });
            throw error;
        }
    }

    private handleGeminiMessage(message: any) {
        if (process.env.DEBUG_AI === "true") {
            console.log("[Gemini Live Msg]:", JSON.stringify(message).substring(0, 300));
        }

        // 1. Audio chunks from AI Turn (24kHz PCM base64)
        if (message.serverContent?.modelTurn?.parts) {
            for (const part of message.serverContent.modelTurn.parts) {
                if (part.inlineData) {
                    this.sendToClient({
                        type: "AUDIO",
                        data: part.inlineData.data,
                        mimeType: part.inlineData.mimeType || "audio/pcm;rate=24000",
                    });
                }
                // Stream text token if modelTurn has text (fallback if outputTranscription not present)
                if (part.text && !message.serverContent?.outputTranscription?.text) {
                    // Flush any pending user turn before AI speaks
                    if (this.currentUserTurnText.trim()) {
                        this.recordTurn("user", this.currentUserTurnText);
                        this.currentUserTurnText = "";
                    }
                    this.currentAiTurnText += part.text;
                    this.sendToClient({
                        type: "TRANSCRIPT",
                        speaker: "ai",
                        text: part.text,
                    });
                }
            }
        }

        // 2. AI Speech-to-Text output transcription stream
        if (message.serverContent?.outputTranscription?.text) {
            // Flush any pending user turn before AI starts speaking
            if (this.currentUserTurnText.trim()) {
                this.recordTurn("user", this.currentUserTurnText);
                this.currentUserTurnText = "";
            }

            const chunk = message.serverContent.outputTranscription.text;
            this.currentAiTurnText += chunk;
            this.sendToClient({
                type: "TRANSCRIPT",
                speaker: "ai",
                text: chunk,
            });
        }

        // 3. Candidate speech-to-text input transcription stream
        if (message.serverContent?.inputTranscription?.text) {
            // Flush any pending AI turn before candidate starts speaking
            if (this.currentAiTurnText.trim()) {
                this.recordTurn("ai", this.currentAiTurnText);
                this.currentAiTurnText = "";
            }

            const chunk = message.serverContent.inputTranscription.text;
            this.currentUserTurnText += chunk;
            this.sendToClient({
                type: "TRANSCRIPT",
                speaker: "user",
                text: chunk,
            });

            // Commit user speech turn to transcript
            if (message.serverContent.inputTranscription.finished || this.currentUserTurnText.length > 200) {
                if (this.currentUserTurnText.trim()) {
                    this.recordTurn("user", this.currentUserTurnText);
                    this.currentUserTurnText = "";
                }
            }
        }

        // 4. Interruption detected by Gemini (candidate spoke while AI was speaking)
        if (message.serverContent?.interrupted) {
            console.log(`⚡ [Gemini Live] Interruption detected`);
            this.flushTurns();
            this.sendToClient({
                type: "INTERRUPTED",
            });
        }

        // 5. Turn Complete (AI finished current utterance)
        if (message.serverContent?.turnComplete) {
            const aiSpokenText = this.currentAiTurnText.toLowerCase();
            this.flushTurns();

            // Detect if AI has delivered its formal wrap-up goodbye
            const isConcluding =
                aiSpokenText.includes("wraps up our interview") ||
                aiSpokenText.includes("concludes our interview") ||
                aiSpokenText.includes("that wraps up our session") ||
                aiSpokenText.includes("that concludes our session") ||
                aiSpokenText.includes("interview_concluded") ||
                (aiSpokenText.includes("best of luck") && aiSpokenText.includes("goodbye"));

            if (isConcluding) {
                console.log(`🏁 [Gemini Live] AI naturally concluded the interview for session: ${this.context.sessionId}`);
                if (this.wrapUpTimer) clearTimeout(this.wrapUpTimer);
                // Give 3.5 seconds for the 24kHz audio buffer to finish playing in candidate's browser
                this.wrapUpTimer = setTimeout(() => {
                    this.wrapUpTimer = null;
                    if (this.onConclude) {
                        this.onConclude();
                    } else {
                        this.sendToClient({ type: "END" });
                        this.close();
                    }
                }, 3500);
            }
        }
    }
    /**
     * Sends the initial kick-off turn asking Gemini to start the interview
     */
    private sendInitialGreeting() {
        if (!this.geminiSession) return;
        this.geminiSession.sendClientContent({
            turns: [
                {
                    role: "user",
                    parts: [
                        {
                            text: `Hello, I am ${this.context.candidateName}. I am ready for the interview. Please greet me and ask the first question.`,
                        },
                    ],
                },
            ],
        });
    }
    /**
     * Forwards candidate microphone 16kHz PCM audio chunk to Gemini
     */
    public sendAudioChunk(base64Audio: string) {
        if (this.geminiSession && this.isConnected) {
            try {
                this.geminiSession.sendRealtimeInput({
                    media: {
                        mimeType: "audio/pcm;rate=16000",
                        data: base64Audio,
                    },
                });
            } catch {
                this.geminiSession.sendRealtimeInput([
                    {
                        mimeType: "audio/pcm;rate=16000",
                        data: base64Audio,
                    },
                ]);
            }
        }
    }
    /**
     * Forwards text or code updates to Gemini
     */
    public sendTextMessage(text: string) {
        if (this.geminiSession && this.isConnected) {
            this.flushTurns();
            this.recordTurn("user", text);
            this.geminiSession.sendClientContent({
                turns: [
                    {
                        role: "user",
                        parts: [{ text }],
                    },
                ],
            });
        }
    }
    /**
     * Gracefully closes the Gemini live session
     */
    public close() {
        if (this.wrapUpTimer) {
            clearTimeout(this.wrapUpTimer);
            this.wrapUpTimer = null;
        }
        if (this.geminiSession) {
            try {
                this.geminiSession.close();
            } catch (err) {
                console.warn("Error closing Gemini live session:", err);
            }
            this.geminiSession = null;
            this.isConnected = false;
        }
    }
}