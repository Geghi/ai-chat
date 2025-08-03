import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ filename: string[] }> }
) {
  const resolvedParams = await params;
  const filename = resolvedParams.filename.join("/");
  if (!filename) {
    return NextResponse.json(
      { error: "Filename is required" },
      { status: 400 }
    );
  }

  try {
    const dirPath = path.join(process.cwd(), "audio_logs");
    const filePath = path.join(dirPath, filename);

    // Basic security check to prevent path traversal
    if (path.dirname(filePath) !== dirPath) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    const stat = await fs.stat(filePath);
    const data = await fs.readFile(filePath);

    const headers = new Headers();
    headers.set("Content-Type", "audio/mpeg");
    headers.set("Content-Length", stat.size.toString());

    return new NextResponse(data, { headers });
  } catch (error) {
    console.error(`Failed to read audio file ${filename}:`, error);
    return NextResponse.json(
      { error: "File not found or could not be read" },
      { status: 404 }
    );
  }
}
