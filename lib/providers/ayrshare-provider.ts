export interface AyrsharePostResult {
  status?: string;
  id?: string;
  ref?: string;
  message?: string;
  [key: string]: unknown;
}

export async function publishToAyrshare(platform: string, mediaUrl: string | string[], caption: string, scheduledPostId?: string): Promise<AyrsharePostResult> {
  const apiKey = process.env.AYRSHARE_API_KEY;
  const mediaUrls = Array.isArray(mediaUrl) ? mediaUrl : (mediaUrl ? [mediaUrl] : undefined);

  if (!apiKey) {
    const isProduction = process.env.NODE_ENV === "production";
    if (isProduction) {
      throw new Error("AYRSHARE_API_KEY is not configured; cannot publish in production");
    }
    // Mock publishing behavior for testing without real key
    console.log(`[Mock] Publishing to ${platform}: ${caption} (${Array.isArray(mediaUrl) ? mediaUrl.join(', ') : mediaUrl})`);
    return new Promise(resolve => setTimeout(() => resolve({
      status: "success",
      id: "mock_id_" + Date.now(),
      ref: "mock_ref"
    }), 2000));
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  let response: Response;
  try {
    response = await fetch("https://api.ayrshare.com/api/post", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        post: caption,
        platforms: [platform],
        mediaUrls,
        ...(scheduledPostId ? { idempotencyKey: scheduledPostId } : {}),
      })
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      throw new Error("Ayrshare request timed out after 30 seconds");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  const data = await response.json();

  if (data.status === "error") {
    throw new Error(data.message || "Failed to publish to Ayrshare");
  }

  return data;
}