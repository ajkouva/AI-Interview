import { EdgeTTS } from "@andresaya/edge-tts";

export type TTSVoice = 
  | "en-US-GuyNeural"          // US Male (Professional Technical)
  | "en-US-JennyNeural"        // US Female (Friendly / Conversational)
  | "en-US-ChristopherNeural"  // US Male (System Design / Authoritative)
  | "en-GB-RyanNeural"         // British Male
  | "en-IN-PrabhatNeural";     // Indian English Male

export async function synthesizeSpeechBase64(
    text: string, 
    voice: TTSVoice = "en-US-GuyNeural"
): Promise<string> {
    try {
        const tts = new EdgeTTS();
        await tts.synthesize(text, voice, {
            outputFormat: "audio-24khz-48kbitrate-mono-mp3",
        });
        return tts.toBase64();
    } catch (error) {
        console.error("[TTS Error] Failed to synthesize speech with Edge-TTS:", error);
        return ""; // Fallback to empty string so text-based flow is not blocked
    }
}
