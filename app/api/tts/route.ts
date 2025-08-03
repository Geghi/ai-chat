import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { promises as fs } from "fs";
import path from "path";
import { CONFIG } from "@/lib/constants";
import { handleApiError, logError } from "@/lib/error-handler";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY environment variable is not set");
}

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

const ttsSchema = z.object({
  text: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = ttsSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { data: null, error: "Invalid request body" },
        { status: 400 }
      );
    }

    const { text } = validation.data;

    const mp3 = await openai.audio.speech.create({
      model: CONFIG.TTS_MODEL,
      voice: CONFIG.TTS_VOICE,
      input: text,
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());
    const filename = `tts_output_${Date.now()}.mp3`;

    // Save outgoing audio to a file
    try {
      const dirPath = path.join(process.cwd(), "audio_logs");
      await fs.mkdir(dirPath, { recursive: true });
      const filePath = path.join(dirPath, filename);
      await fs.writeFile(filePath, buffer);
      console.log(`Saved TTS output audio to ${filePath}`);
    } catch (fsError) {
      console.error("Failed to save TTS output audio:", fsError);
      // Do not block the main flow if file saving fails
    }

    const headers = new Headers();
    headers.set("Content-Type", "audio/mpeg");
    headers.set("X-Audio-Filename", filename);

    return new NextResponse(buffer, { headers });
  } catch (error) {
    logError(error, "API /tts");
    const { message, statusCode } = handleApiError(error);
    return NextResponse.json(
      { data: null, error: `Error generating response audio: ${message}` },
      { status: statusCode }
    );
  }
}
