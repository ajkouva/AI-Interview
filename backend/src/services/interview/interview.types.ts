import type { Difficulty, SessionType } from "../../../generated/prisma/enums";

export interface ClientAudioChunkMessage {
    type: "AUDIO_CHUNK";
    data: string;
}

export interface ClientTextMessage {
    type: "TEXT";
    text: string;
}

export interface ClientCodeUpdateMessage {
    type: "CODE_UPDATE";
    code: string;
    language?: string;
}

export interface ClientEndMessage {
    type: "END";
}

export type ClientMessage = 
    | ClientAudioChunkMessage 
    | ClientTextMessage 
    | ClientCodeUpdateMessage
    | ClientEndMessage;

export interface ServerStatusMessage {
    type: "STATUS";
    message: string;
}

export interface ServerAudioMessage {
    type: "AUDIO";
    data: string;
    mimeType: string;
}

export interface ServerTranscriptMessage {
    type: "TRANSCRIPT";
    speaker: "ai" | "user";
    text: string;
}

export interface ServerInterruptedMessage {
    type: "INTERRUPTED";
}

export interface ServerErrorMessage {
    type: "ERROR";
    message: string;
}

export interface ServerEndMessage {
    type: "END";
}

export type ServerMessage =
    | ServerStatusMessage
    | ServerAudioMessage
    | ServerTranscriptMessage
    | ServerInterruptedMessage
    | ServerErrorMessage
    | ServerEndMessage;

export type SupportedVoice = "Aoede" | "Puck" | "Charon" | "Kore" | "Fenrir";

export interface LiveInterviewContext {
    sessionId: string;
    candidateName: string;
    targetRole: string;
    experienceLevel?: string;
    resumeSummary?: string;
    jobTitle?: string;
    jobDescription?: string;
    difficulty: Difficulty;
    sessionType: SessionType;
    voiceName?: SupportedVoice;
}

export interface LiveTranscriptTurn {
    speaker: "ai" | "user";
    text: string;
    timestamp: Date;
}
