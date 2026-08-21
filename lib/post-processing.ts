import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";

const DOWNLOAD_TIMEOUT_MS = 60_000;
const MAX_DOWNLOAD_BYTES = 50 * 1024 * 1024;

async function downloadBounded(url: string): Promise<Buffer> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (!response.body) throw new Error("No response body");
    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength > MAX_DOWNLOAD_BYTES) throw new Error("Download too large");
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.length;
      if (received > MAX_DOWNLOAD_BYTES) {
        await reader.cancel();
        throw new Error("Download too large");
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks.map((c) => Buffer.from(c)));
  } finally {
    clearTimeout(timer);
  }
}

function escapeXml(text: string): string {
  return text.replace(
    /[&<>'"]/g,
    (tag) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      }[tag] || tag)
  );
}

function wrapText(text: string, maxCharsPerLine: number, maxLines: number): string[] {
  const words: string[] = [];
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (word.length > maxCharsPerLine) {
      for (let i = 0; i < word.length; i += maxCharsPerLine) {
        words.push(word.slice(i, i + maxCharsPerLine));
      }
    } else {
      words.push(word);
    }
  }
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (current && (current + " " + word).length > maxCharsPerLine) {
      lines.push(current);
      current = word;
    } else {
      current = current ? current + " " + word : word;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, maxLines);
}

export async function uploadVideoToSupabase(
  videoUrl: string,
  projectId: string,
  assetId: string
): Promise<string> {
  try {
    const buffer = await downloadBounded(videoUrl);

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const fileName = `${projectId}/${assetId}.mp4`;
    const { error: uploadError } = await supabase.storage
      .from("generated-assets")
      .upload(fileName, buffer, { contentType: "video/mp4", upsert: true });

    if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

    const { data } = supabase.storage.from("generated-assets").getPublicUrl(fileName);
    return data.publicUrl;
  } catch (error) {
    console.error("Video upload error:", error);
    throw error;
  }
}

export async function applyPostProcessing(
  imageUrl: string,
  hookText: string,
  projectId: string,
  assetId: string
): Promise<string> {
  try {
    // 1. Download image
    const imageBuffer = await downloadBounded(imageUrl);

    // 2. Add text overlay with sharp using SVG compositing
    const width = 1024;
    const height = 1024; // SDXL square_hd default

    // Create an SVG with wrapped text to composite over the image
    const overlayHeight = 200;
    const fontPx = 48;
    const maxLines = Math.floor(overlayHeight / (fontPx * 1.2));
    const maxCharsPerLine = Math.floor(width / (fontPx * 0.55));
    const hookLines = wrapText(hookText, maxCharsPerLine, maxLines);
    const lineSpacing = fontPx * 1.2;
    const firstLineY = height - overlayHeight / 2 - (lineSpacing * (hookLines.length - 1)) / 2;
    const svgOverlay = `
      <svg width="${width}" height="${height}">
        <rect x="0" y="${height - overlayHeight}" width="${width}" height="${overlayHeight}" fill="rgba(0,0,0,0.6)" />
        <text
          x="50%"
          font-family="sans-serif"
          font-size="${fontPx}"
          font-weight="bold"
          fill="white"
          text-anchor="middle"
          dominant-baseline="central"
        >
          ${hookLines
            .map(
              (line, i) =>
                `<tspan x="50%" y="${firstLineY + i * lineSpacing}">${escapeXml(line)}</tspan>`
            )
            .join("")}
        </text>
      </svg>
    `;

    const processedBuffer = await sharp(Buffer.from(imageBuffer))
      .resize(width, height)
      .composite([
        {
          input: Buffer.from(svgOverlay),
          top: 0,
          left: 0,
        },
      ])
      .jpeg({ quality: 90 })
      .toBuffer();

    // 3. Upload to Supabase Storage
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const fileName = `${projectId}/${assetId}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from("generated-assets")
      .upload(fileName, processedBuffer, {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

    // 4. Get public URL
    const { data } = supabase.storage
      .from("generated-assets")
      .getPublicUrl(fileName);

    return data.publicUrl;
  } catch (error) {
    console.error("Sharp post-processing/upload error:", error);
    throw error;
  }
}
