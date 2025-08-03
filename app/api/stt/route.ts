import { NextRequest, NextResponse } from "next/server";
import { SpeechClient } from "@google-cloud/speech";
import { z } from "zod";
import { promises as fs } from "fs";
import path from "path";
import { CONFIG } from "@/lib/constants";

const sttSchema = z.object({
  audio: z.string(),
});

export async function POST(req: NextRequest) {
  const credentialsJson = process.env.GOOGLE_CREDENTIALS_JSON;

  if (!credentialsJson) {
    console.error("GOOGLE_CREDENTIALS_JSON environment variable not set.");
    return NextResponse.json(
      {
        data: null,
        error:
          "Google Cloud credentials are not set up. Please provide the service account JSON content in the GOOGLE_CREDENTIALS_JSON environment variable.",
      },
      { status: 500 }
    );
  }

  try {
    const body = await req.json();
    const validation = sttSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { data: null, error: "Invalid request body" },
        { status: 400 }
      );
    }

    const { audio: audioBytes } = validation.data;

    // Save incoming audio to a file
    try {
      const audioBuffer = Buffer.from(audioBytes, "base64");
      const dirPath = path.join(process.cwd(), "audio_logs");
      await fs.mkdir(dirPath, { recursive: true });
      const filePath = path.join(dirPath, `stt_input_${Date.now()}.webm`);
      await fs.writeFile(filePath, audioBuffer);
      console.log(`Saved STT input audio to ${filePath}`);
    } catch (fsError) {
      console.error("Failed to save STT input audio:", fsError);
      // Do not block the main flow if file saving fails
    }

    const credentials = JSON.parse(credentialsJson);
    const speechClient = new SpeechClient({ credentials });

    const audio = {
      content: audioBytes,
    };
    const config = {
      encoding: "WEBM_OPUS" as const,
      sampleRateHertz: 48000,
      languageCode: CONFIG.GOOGLE_SPEECH_LANG,
    };
    const request = {
      audio: audio,
      config: config,
    };

    const [response] = await speechClient.recognize(request);
    const transcription =
      response.results
        ?.map((result) => result.alternatives?.[0].transcript)
        .join("\n") || null;

    return NextResponse.json({ data: { transcription }, error: null });
  } catch (error) {
    console.error("Error in Google Speech-to-Text API:", error);
    return NextResponse.json(
      { data: null, error: "Failed to process audio" },
      { status: 500 }
    );
  }
}
