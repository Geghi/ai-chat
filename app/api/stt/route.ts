import { NextRequest, NextResponse } from "next/server";
import { SpeechClient } from "@google-cloud/speech";

export async function POST(req: NextRequest) {
  const credentialsJson = process.env.GOOGLE_CREDENTIALS_JSON;

  if (!credentialsJson) {
    console.error("GOOGLE_CREDENTIALS_JSON environment variable not set.");
    return NextResponse.json(
      {
        error:
          "Google Cloud credentials are not set up. Please provide the service account JSON content in the GOOGLE_CREDENTIALS_JSON environment variable.",
      },
      { status: 500 }
    );
  }

  try {
    const credentials = JSON.parse(credentialsJson);
    const speechClient = new SpeechClient({ credentials });
    const body = await req.json();
    const audioBytes = body.audio;

    if (!audioBytes) {
      return NextResponse.json(
        { error: "Audio data is required" },
        { status: 400 }
      );
    }

    const audio = {
      content: audioBytes,
    };
    const config = {
      encoding: "WEBM_OPUS" as const, 
      sampleRateHertz: 48000,
      languageCode: "en-US", 
    };
    const request = {
      audio: audio,
      config: config,
    };

    const [response] = await speechClient.recognize(request);
    const transcription = response.results
      ?.map((result) => result.alternatives?.[0].transcript)
      .join("\n");

    return NextResponse.json({ transcription });
  } catch (error) {
    console.error("Error in Google Speech-to-Text API:", error);
    return NextResponse.json(
      { error: "Failed to process audio" },
      { status: 500 }
    );
  }
}
