import { WebSocketServer, type WebSocket } from "ws";
import type { Server, IncomingMessage } from "http";
import { verifyToken } from "@clerk/express";
import interviewService from "./interview.services";
import { GeminiLiveService } from "./gemini.live.services";
import type { ClientMessage } from "./interview.types";

interface ExtWebSocket extends WebSocket {
    isAlive: boolean;
}

const activeFinalizations = new Set<Promise<void>>();

export async function awaitAllInterviewFinalizations(): Promise<void> {
    if (activeFinalizations.size > 0) {
        console.log(`⏳ [WebSocket] Awaiting ${activeFinalizations.size} active session finalization(s)...`);
        await Promise.allSettled(Array.from(activeFinalizations));
    }
}

function safeCompleteSession(sessionId: string, transcript?: any[]): Promise<void> {
    const promise = interviewService.completeLiveSession(sessionId, transcript)
        .catch((err) => {
            console.error(`[WebSocket] Error completing live session ${sessionId}:`, err);
        })
        .finally(() => {
            activeFinalizations.delete(promise);
        });
    activeFinalizations.add(promise);
    return promise;
}

export function setupInterviewWebSocket(server: Server): WebSocketServer {
    const wss = new WebSocketServer({ server, path: "/ws/interview" });

    // 30-Second Ping/Pong Heartbeat to terminate dead / half-open TCP connections
    const heartbeatInterval = setInterval(() => {
        wss.clients.forEach((ws) => {
            const extWs = ws as ExtWebSocket;
            if (extWs.isAlive === false) {
                console.log("💀 [WebSocket] Terminating dead client connection (missed heartbeat pong)");
                return extWs.terminate();
            }
            extWs.isAlive = false;
            extWs.ping();
        });
    }, 30_000);

    wss.on("close", () => {
        clearInterval(heartbeatInterval);
    });

    wss.on("connection", async (ws: WebSocket, req: IncomingMessage) => {
        const extWs = ws as ExtWebSocket;
        extWs.isAlive = true;

        extWs.on("pong", () => {
            extWs.isAlive = true;
        });

        console.log("⚡ [WebSocket] Client attempting connection to /ws/interview");

        const url = new URL(req.url || "", `http://${req.headers.host}`);
        const sessionId = url.searchParams.get("sessionId");
        
        // Extract token from query param or Sec-WebSocket-Protocol header
        let token = url.searchParams.get("token");
        const protocolHeader = req.headers["sec-websocket-protocol"];
        if (!token && protocolHeader) {
            const raw = Array.isArray(protocolHeader) ? protocolHeader[0] : protocolHeader;
            token = raw ? raw.split(",")[0]?.trim() || null : null;
        }

        const devClerkUserId =
            url.searchParams.get("clerkId") ||
            (req.headers["x-clerk-user-id"] as string);

        if (!sessionId) {
            ws.close(1008, "Missing required sessionId parameter");
            return;
        }

        let clerkId: string | null = null;

        // 1. Strict Local Development Bypass
        if (
            process.env.NODE_ENV !== "production" &&
            process.env.ALLOW_DEV_AUTH_BYPASS !== "false" &&
            devClerkUserId
        ) {
            clerkId = devClerkUserId;
        }
        // 2. Production Clerk Token Verification
        else if (token) {
            try {
                const verified = await verifyToken(token, {
                    secretKey: process.env.CLERK_SECRET_KEY,
                });
                clerkId = verified.sub;
            } catch (err: any) {
                console.error("[WebSocket Auth Error] Invalid token:", err.message);
                ws.close(1008, "Invalid or expired Clerk authentication token");
                return;
            }
        }

        if (!clerkId) {
            ws.close(1008, "Unauthorized: Authentication credentials missing");
            return;
        }

        let context;
        try {
            context = await interviewService.getLiveSessionContext(sessionId, clerkId);
        } catch (error: any) {
            console.error(`[WebSocket Setup Error]: ${error.message}`);
            ws.close(1008, error.message || "Failed to load session context");
            return;
        }

        const geminiLive = new GeminiLiveService(ws, context);

        let wrapUpReminderTimer: ReturnType<typeof setTimeout> | undefined;
        let hardStopTimer: ReturnType<typeof setTimeout> | undefined;

        const clearSessionTimers = () => {
            if (wrapUpReminderTimer) clearTimeout(wrapUpReminderTimer);
            if (hardStopTimer) clearTimeout(hardStopTimer);
        };

        // Auto-wrap up when AI naturally concludes the interview
        geminiLive.onConclude = async () => {
            clearSessionTimers();
            console.log(`🏁 [WebSocket] AI concluded interview for session: ${sessionId}`);
            const transcript = geminiLive.getTranscript();
            geminiLive.close();
            await safeCompleteSession(sessionId, transcript);
            if (ws.readyState === ws.OPEN) {
                ws.send(JSON.stringify({ type: "END" }));
                ws.close(1000, "Interview concluded by interviewer");
            }
        };

        try {
            await geminiLive.initializeSession();
            await interviewService.markLiveSessionActive(sessionId);
        } catch (error: any) {
            clearSessionTimers();
            console.error("[WebSocket] Failed to start Gemini live session:", error);
            geminiLive.close();
            // Securely refund owner only after context ownership was verified
            await interviewService.refundLiveSessionCredit(sessionId, clerkId);
            ws.close(1011, "Failed to start AI live session");
            return;
        }

        // 13-Minute Reminder: Prompt Gemini to start wrapping up
        wrapUpReminderTimer = setTimeout(() => {
            if (ws.readyState === ws.OPEN) {
                console.log(`⏱️ [WebSocket] 13-minute mark reached for session: ${sessionId}. Triggering wrap-up reminder.`);
                geminiLive.sendTextMessage("SYSTEM NOTE: Time is almost up. Please wrap up the interview and give your final concluding remarks now.");
            }
        }, 13 * 60 * 1000);

        // 15-Minute Hard Stop: Automatically conclude session to prevent runaway token usage
        hardStopTimer = setTimeout(async () => {
            clearSessionTimers();
            console.log(`⏰ [WebSocket] Session ${sessionId} reached 15-minute limit. Auto-completing session.`);
            const transcript = geminiLive.getTranscript();
            geminiLive.close();
            await safeCompleteSession(sessionId, transcript);
            if (ws.readyState === ws.OPEN) {
                ws.send(JSON.stringify({ type: "END" }));
                ws.close(1000, "Maximum interview duration reached");
            }
        }, 15 * 60 * 1000);

        ws.on("message", async (rawMessage, isBinary) => {
            // 1. Raw Binary Audio Stream from Microphone (16kHz PCM Buffer)
            if (isBinary && Buffer.isBuffer(rawMessage)) {
                geminiLive.sendAudioChunk(rawMessage.toString("base64"));
                return;
            }

            const rawStr = rawMessage.toString().trim();
            if (!rawStr) return;

            // 2. Try parsing structured JSON frame
            try {
                const message = JSON.parse(rawStr) as ClientMessage;

                switch (message.type) {
                    case "AUDIO_CHUNK":
                        if (message.data) {
                            geminiLive.sendAudioChunk(message.data);
                        }
                        break;

                    case "TEXT":
                        if (message.text) {
                            geminiLive.sendTextMessage(message.text);
                        }
                        break;

                    case "CODE_UPDATE":
                        if (message.code) {
                            const codePrompt = `Candidate updated code (${message.language || "code"}):\n\`\`\`\n${message.code}\n\`\`\``;
                            geminiLive.sendTextMessage(codePrompt);
                        }
                        break;

                    case "END": {
                        clearSessionTimers();
                        console.log(`⏹️ [WebSocket] Candidate requested to end live session: ${sessionId}`);
                        const endTranscript = geminiLive.getTranscript();
                        geminiLive.close();
                        await safeCompleteSession(sessionId, endTranscript);
                        ws.send(JSON.stringify({ type: "END" }));
                        ws.close(1000, "Interview completed by candidate");
                        break;
                    }

                    default:
                        // If JSON was sent without 'type', but contains text/prompt
                        if ((message as any).text) {
                            geminiLive.sendTextMessage((message as any).text);
                        } else {
                            console.warn("[WebSocket] Unknown JSON message received:", message);
                        }
                }
            } catch {
                // 3. Fallback: If client sent plain text (e.g. "hi" from Postman), treat it as a text turn
                console.log(`💬 [WebSocket] Received plain text turn: "${rawStr}"`);
                geminiLive.sendTextMessage(rawStr);
            }
        });

        ws.on("close", async () => {
            clearSessionTimers();
            console.log(`🔌 [WebSocket] Client disconnected from interview session: ${sessionId}`);
            const transcript = geminiLive.getTranscript();
            geminiLive.close();
            await safeCompleteSession(sessionId, transcript);
        });

        ws.on("error", (err) => {
            clearSessionTimers();
            console.error(`[WebSocket Client Error] Session ${sessionId}:`, err);
            geminiLive.close();
        });
    });
    console.log("🚀 [WebSocket] Live Interview Server initialized on path /ws/interview");
    return wss;
}