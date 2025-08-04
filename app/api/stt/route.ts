import { NextRequest, NextResponse } from "next/server";
import { SpeechClient } from "@google-cloud/speech";
import { createClient } from "@deepgram/sdk";
import { z } from "zod";
import { promises as fs } from "fs";
import path from "path";
import { CONFIG } from "@/lib/constants";

const sttSchema = z.object({
  audio: z.string(),
});

async function transcribeWithGoogle(audioBytes: string) {
  const credentialsJson = process.env.GOOGLE_CREDENTIALS_JSON;
  if (!credentialsJson) {
    throw new Error("GOOGLE_CREDENTIALS_JSON environment variable not set.");
  }

  const credentials = JSON.parse(credentialsJson);
  const speechClient = new SpeechClient({ credentials });

  const audio = { content: audioBytes };
  const config = {
    encoding: "WEBM_OPUS" as const,
    sampleRateHertz: 48000,
    languageCode: CONFIG.GOOGLE_SPEECH_LANG,
  };
  const request = { audio, config };

  const [response] = await speechClient.recognize(request);
  return (
    response.results
      ?.map((result) => result.alternatives?.[0].transcript)
      .join("\n") || null
  );
}

async function transcribeWithDeepgram(audioBuffer: Buffer) {
  const deepgramApiKey = process.env.DEEPGRAM_API_KEY;
  if (!deepgramApiKey) {
    throw new Error("DEEPGRAM_API_KEY environment variable not set.");
  }

  const deepgram = createClient(deepgramApiKey);
  const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
    audioBuffer,
    {
      model: "nova-2",
      smart_format: true,
    }
  );

  if (error) {
    throw error;
  }

  return result.results.channels[0].alternatives[0].transcript;
}

async function saveAudioToFile(audioBuffer: Buffer) {
  try {
    const dirPath = path.join(process.cwd(), "audio_logs");
    await fs.mkdir(dirPath, { recursive: true });
    const filePath = path.join(dirPath, `stt_input_${Date.now()}.webm`);
    await fs.writeFile(filePath, audioBuffer);
    console.log(`Saved STT input audio to ${filePath}`);
  } catch (fsError) {
    console.error("Failed to save STT input audio:", fsError);
  }
}

export async function POST(req: NextRequest) {
  const provider = req.headers.get("X-STT-Provider") || "google";

  try {
    let transcription: string | null = null;

    if (provider === "deepgram") {
      const audioBlob = await req.blob();
      const audioBuffer = Buffer.from(await audioBlob.arrayBuffer());
      await saveAudioToFile(audioBuffer);
      transcription = await transcribeWithDeepgram(audioBuffer);
    } else {
      // Default to Google
      const body = await req.json();
      const validation = sttSchema.safeParse(body);

      if (!validation.success) {
        return NextResponse.json(
          { data: null, error: "Invalid request body" },
          { status: 400 }
        );
      }
      const { audio: audioBytes } = validation.data;
      const audioBuffer = Buffer.from(audioBytes, "base64");
      await saveAudioToFile(audioBuffer);
      transcription = await transcribeWithGoogle(audioBytes);
    }

    return NextResponse.json({ data: { transcription }, error: null });
  } catch (error) {
    console.error(`Error in ${provider} Speech-to-Text API:`, error);
    return NextResponse.json(
      { data: null, error: "Failed to process audio" },
      { status: 500 }
    );
  }
}
