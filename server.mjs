import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const isProduction = process.env.NODE_ENV === "production";
const port = Number(process.env.PORT || 5173);
const root = path.dirname(fileURLToPath(import.meta.url));

const TOOL_IDS = {
  firecrawl: "conn_d47ff201f511__firecrawl_search",
  youtube: "conn_0132855dd24c__youtube__search",
};

app.set("trust proxy", 1);
app.use(express.json({ limit: "256kb" }));

function parseMaybeJson(value) {
  if (typeof value !== "string") return value;
  try {
    return parseMaybeJson(JSON.parse(value));
  } catch {
    return value;
  }
}

function unwrap(value) {
  let current = parseMaybeJson(value);
  for (let depth = 0; depth < 8; depth += 1) {
    if (Array.isArray(current) && current.length === 1) {
      current = parseMaybeJson(current[0]);
      continue;
    }
    if (current && typeof current === "object") {
      if (current.success === true && current.data !== undefined) {
        current = parseMaybeJson(current.data);
        continue;
      }
      if (current.content && Array.isArray(current.content)) {
        const text = current.content.find((item) => item?.type === "text")?.text;
        if (text) {
          current = parseMaybeJson(text);
          continue;
        }
      }
    }
    break;
  }
  return current;
}

async function executeTool(id, args, timeoutMs = 25000) {
  const base = process.env.FORGE_TOOLS_URL;
  const key = process.env.FORGE_TOOLS_API_KEY;
  if (!base || !key) throw new Error("Connected tools are not configured in this environment.");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${base}/tools/${encodeURIComponent(id)}/execute`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ arguments: args }),
      signal: controller.signal,
    });
    const result = await response.json();
    if (!response.ok || !result.ok) {
      const error = new Error(result?.error?.message || `Tool request failed (${response.status})`);
      error.kind = result?.error?.kind || "gateway";
      throw error;
    }
    return unwrap(result.data);
  } finally {
    clearTimeout(timer);
  }
}

function cleanText(text = "") {
  return String(text).replace(/https?:\/\/\S+/g, "").replace(/[#*_`>\[\]]/g, "").replace(/\s+/g, " ").trim();
}

function hostFor(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "unknown source";
  }
}

function normalizeWeb(payload) {
  const web = payload?.web || payload?.data?.web || payload?.results || [];
  return (Array.isArray(web) ? web : []).slice(0, 8).map((item, index) => ({
    id: `web-${index}`,
    title: cleanText(item.title || "Untitled source"),
    url: item.url || item.link || "#",
    domain: hostFor(item.url || item.link || ""),
    excerpt: cleanText(item.description || item.snippet || item.markdown || "No excerpt returned."),
    position: item.position || index + 1,
    category: item.category || "web",
  }));
}

function normalizeVideos(payload) {
  const items = payload?.items || payload?.data?.items || payload?.results || [];
  return (Array.isArray(items) ? items : []).filter((item) => item?.id?.videoId || item?.videoId || item?.id).slice(0, 6).map((item, index) => {
    const snippet = item.snippet || item;
    const videoId = item?.id?.videoId || item.videoId || (typeof item.id === "string" ? item.id : "");
    return {
      id: videoId || `video-${index}`,
      title: cleanText(snippet.title || "Untitled video"),
      channel: cleanText(snippet.channelTitle || snippet.channel || "YouTube"),
      publishedAt: snippet.publishedAt || "",
      description: cleanText(snippet.description || ""),
      thumbnail: snippet.thumbnails?.medium?.url || snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url || "",
      url: videoId ? `https://www.youtube.com/watch?v=${videoId}` : "https://youtube.com",
    };
  });
}

const STOP_WORDS = new Set(["about", "after", "again", "also", "and", "are", "been", "before", "being", "between", "from", "have", "https", "into", "more", "most", "over", "retrieved", "that", "their", "these", "they", "this", "through", "under", "what", "when", "where", "which", "wiki", "wikipedia", "with", "would", "your"]);

function termsFrom(text) {
  return String(text).toLowerCase().match(/[a-z][a-z0-9-]{3,}/g)?.filter((word) => !STOP_WORDS.has(word)) || [];
}

function buildLens(query, sources, videos) {
  const webFreq = new Map();
  const videoWords = new Set(termsFrom(videos.map((video) => `${video.title} ${video.description}`).join(" ")));
  const queryWords = new Set(termsFrom(query));

  for (const source of sources) {
    const sourceTerms = new Set(termsFrom(`${source.title} ${source.excerpt}`));
    for (const word of sourceTerms) {
      if (!queryWords.has(word)) webFreq.set(word, (webFreq.get(word) || 0) + 1);
    }
  }
  const gaps = [...webFreq.entries()]
    .filter(([word, count]) => count >= 2 && !videoWords.has(word))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([term, mentions]) => ({ term, mentions }));
  const domains = [...new Set(sources.map((source) => source.domain))];
  return {
    gaps,
    domains: domains.length,
    sourceCount: sources.length,
    videoCount: videos.length,
    generatedAt: new Date().toISOString(),
  };
}

app.post("/api/discover", async (req, res) => {
  const query = String(req.body?.query || "").trim().slice(0, 240);
  if (query.length < 3) return res.status(400).json({ error: "Enter a topic with at least 3 characters." });

  const [webResult, youtubeResult] = await Promise.allSettled([
    executeTool(TOOL_IDS.firecrawl, { query, limit: 8, sources: ["web"], highlights: true }),
    executeTool(TOOL_IDS.youtube, {
      query: { q: query, type: "video", maxResults: 6, order: "relevance", safeSearch: "moderate" },
    }),
  ]);

  const sources = webResult.status === "fulfilled" ? normalizeWeb(webResult.value) : [];
  const videos = youtubeResult.status === "fulfilled" ? normalizeVideos(youtubeResult.value) : [];
  const providerErrors = {};
  if (webResult.status === "rejected") providerErrors.firecrawl = webResult.reason?.message || "Firecrawl did not respond.";
  if (youtubeResult.status === "rejected") providerErrors.youtube = youtubeResult.reason?.message || "YouTube did not respond.";

  if (!sources.length && !videos.length) {
    return res.status(502).json({ error: "Neither connected source returned results.", providerErrors });
  }

  return res.json({ query, sources, videos, lens: buildLens(query, sources, videos), providerErrors });
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, toolsConfigured: Boolean(process.env.FORGE_TOOLS_URL && process.env.FORGE_TOOLS_API_KEY) });
});

if (isProduction) {
  app.use(express.static(path.join(root, "dist")));
  app.get("/{*splat}", (_req, res) => res.sendFile(path.join(root, "dist", "index.html")));
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({ server: { middlewareMode: true }, appType: "spa" });
  app.use(vite.middlewares);
}

app.listen(port, "0.0.0.0", () => {
  console.log(`Signal Atlas listening on 0.0.0.0:${port}`);
});
