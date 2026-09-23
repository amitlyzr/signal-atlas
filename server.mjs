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
  calendarList: "conn_b60ecebd9160__google_calendar__events_list",
  calendarInsert: "conn_b60ecebd9160__google_calendar__events_insert",
  calendarUpdate: "conn_b60ecebd9160__google_calendar__events_update",
  calendarDelete: "conn_b60ecebd9160__google_calendar__events_delete",
  domainCheck: "conn_e22c52efaaf8__check_domain",
  domainTlds: "conn_e22c52efaaf8__list_tlds",
  linearIssues: "conn_c13cae132707__list_issues",
  linearProjects: "conn_c13cae132707__list_projects",
  linearStatuses: "conn_c13cae132707__list_issue_statuses",
  linearTeams: "conn_c13cae132707__list_teams",
  linearUser: "conn_c13cae132707__get_user",
  linearSaveIssue: "conn_c13cae132707__save_issue",
  linearSaveProject: "conn_c13cae132707__save_project",
  gmailList: "conn_70e109d5f466__gmail__messages_list",
  gmailGet: "conn_70e109d5f466__gmail__messages_get",
  gmailModify: "conn_70e109d5f466__gmail__messages_modify",
  gmailTrash: "conn_70e109d5f466__gmail__messages_trash",
  gmailSend: "conn_70e109d5f466__gmail__send_email",
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
  return String(text)
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[#*_`>\[\]]/g, "")
    .replace(/\s+/g, " ")
    .trim();
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

function normalizeVideos(payload, limit = 6) {
  const items = payload?.items || payload?.data?.items || payload?.results || [];
  return (Array.isArray(items) ? items : []).filter((item) => item?.id?.videoId || item?.videoId || item?.id).slice(0, limit).map((item, index) => {
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

app.post("/api/youtube/search", async (req, res) => {
  const query = String(req.body?.query || "").trim().slice(0, 180);
  const allowedOrders = new Set(["relevance", "date", "viewCount"]);
  const allowedDurations = new Set(["any", "short", "medium", "long"]);
  const order = allowedOrders.has(req.body?.order) ? req.body.order : "relevance";
  const duration = allowedDurations.has(req.body?.duration) ? req.body.duration : "any";
  if (query.length < 2) return res.status(400).json({ error: "Enter at least two characters to search YouTube." });

  try {
    const body = await executeTool(TOOL_IDS.youtube, {
      query: {
        q: query,
        type: "video",
        maxResults: 12,
        order,
        safeSearch: "moderate",
        videoEmbeddable: "true",
        videoDuration: duration,
      },
    });
    res.json({
      query,
      order,
      duration,
      videos: normalizeVideos(body, 12),
      nextPageToken: body?.nextPageToken || body?.data?.nextPageToken || null,
    });
  } catch (cause) {
    res.status(502).json({ error: cause instanceof Error ? cause.message : "YouTube search did not respond." });
  }
});

function gmailHeaders(message) {
  return Object.fromEntries((message?.payload?.headers || []).map((header) => [String(header.name || "").toLowerCase(), String(header.value || "")]));
}

function decodeGmailData(value = "") {
  if (!value) return "";
  try {
    const normalized = String(value).replace(/-/g, "+").replace(/_/g, "/");
    return Buffer.from(normalized, "base64").toString("utf8");
  } catch {
    return "";
  }
}

function gmailBodyParts(part, found = { plain: [], html: [] }) {
  if (!part) return found;
  const decoded = decodeGmailData(part.body?.data);
  if (decoded && part.mimeType === "text/plain") found.plain.push(decoded);
  if (decoded && part.mimeType === "text/html") found.html.push(decoded);
  for (const child of part.parts || []) gmailBodyParts(child, found);
  return found;
}

function readableMailBody(message) {
  const parts = gmailBodyParts(message?.payload);
  if (parts.plain.length) return parts.plain.join("\n\n").replace(/\r/g, "").trim();
  const html = parts.html.join("\n") || decodeGmailData(message?.payload?.body?.data);
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>|<\/div>|<\/tr>|<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function normalizeGmailMessage(message, includeBody = false) {
  const headers = gmailHeaders(message);
  const labels = Array.isArray(message?.labelIds) ? message.labelIds : [];
  return {
    id: message?.id || "",
    threadId: message?.threadId || "",
    from: headers.from || "Unknown sender",
    to: headers.to || "",
    subject: cleanText(headers.subject || "(no subject)"),
    date: headers.date || (message?.internalDate ? new Date(Number(message.internalDate)).toISOString() : ""),
    snippet: cleanText(message?.snippet || ""),
    labels,
    unread: labels.includes("UNREAD"),
    starred: labels.includes("STARRED"),
    important: labels.includes("IMPORTANT"),
    ...(includeBody ? { body: readableMailBody(message) } : {}),
  };
}

app.get("/api/gmail/messages", async (req, res) => {
  const query = String(req.query.q || "").trim().slice(0, 300);
  const mailbox = String(req.query.mailbox || "INBOX").toUpperCase();
  const allowed = new Set(["INBOX", "STARRED", "SENT", "DRAFT", "ALL"]);
  const label = allowed.has(mailbox) ? mailbox : "INBOX";
  try {
    const list = await executeTool(TOOL_IDS.gmailList, {
      query: {
        ...(label !== "ALL" ? { labelIds: [label] } : {}),
        ...(query ? { q: query } : {}),
        maxResults: 12,
      },
    });
    const references = Array.isArray(list?.messages) ? list.messages : [];
    const messages = [];
    const detailErrors = [];
    for (let start = 0; start < references.length; start += 4) {
      const batch = references.slice(start, start + 4);
      const settled = await Promise.allSettled(batch.map((message) => executeTool(TOOL_IDS.gmailGet, {
        path: { id: message.id },
        query: { format: "metadata", metadataHeaders: ["From", "To", "Subject", "Date"] },
      }, 10000)));
      for (const item of settled) {
        if (item.status === "fulfilled") messages.push(normalizeGmailMessage(item.value));
        else detailErrors.push(item.reason);
      }
    }
    if (references.length && !messages.length) throw detailErrors[0] || new Error("Gmail returned message references without details.");
    res.json({ mailbox: label, query, messages, resultSizeEstimate: list?.resultSizeEstimate || messages.length, nextPageToken: list?.nextPageToken || null });
  } catch (cause) {
    res.status(502).json({ error: cause instanceof Error ? cause.message : "Could not load Gmail." });
  }
});

app.get("/api/gmail/messages/:id", async (req, res) => {
  try {
    const message = await executeTool(TOOL_IDS.gmailGet, { path: { id: req.params.id }, query: { format: "full" } });
    res.json({ message: normalizeGmailMessage(message, true) });
  } catch (cause) {
    res.status(502).json({ error: cause instanceof Error ? cause.message : "Could not open this message." });
  }
});

app.patch("/api/gmail/messages/:id", async (req, res) => {
  const addLabelIds = [];
  const removeLabelIds = [];
  if (req.body?.read === true) removeLabelIds.push("UNREAD");
  if (req.body?.read === false) addLabelIds.push("UNREAD");
  if (req.body?.starred === true) addLabelIds.push("STARRED");
  if (req.body?.starred === false) removeLabelIds.push("STARRED");
  try {
    await executeTool(TOOL_IDS.gmailModify, { path: { id: req.params.id }, body: { addLabelIds, removeLabelIds } });
    res.json({ ok: true });
  } catch (cause) {
    res.status(502).json({ error: cause instanceof Error ? cause.message : "Could not update this message." });
  }
});

app.delete("/api/gmail/messages/:id", async (req, res) => {
  try {
    await executeTool(TOOL_IDS.gmailTrash, { path: { id: req.params.id } });
    res.status(204).end();
  } catch (cause) {
    res.status(502).json({ error: cause instanceof Error ? cause.message : "Could not move this message to trash." });
  }
});

app.post("/api/gmail/send", async (req, res) => {
  const recipient = String(req.body?.recipient || "").trim().slice(0, 320);
  const subject = String(req.body?.subject || "").trim().slice(0, 500);
  const body = String(req.body?.body || "").slice(0, 50000);
  if (!recipient.includes("@") || !body.trim()) return res.status(400).json({ error: "Add a valid recipient and message." });
  try {
    const sent = await executeTool(TOOL_IDS.gmailSend, { sender: "me", recipient, subject, body });
    res.json({ sent: true, id: sent?.id || null, threadId: sent?.threadId || null });
  } catch (cause) {
    res.status(502).json({ error: cause instanceof Error ? cause.message : "Could not send this email." });
  }
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, toolsConfigured: Boolean(process.env.FORGE_TOOLS_URL && process.env.FORGE_TOOLS_API_KEY) });
});

function eventPayload(body) {
  const allDay = Boolean(body.allDay);
  const timeZone = String(body.timeZone || "UTC");
  const payload = {
    summary: String(body.summary || "Untitled event").slice(0, 200),
    description: String(body.description || "").slice(0, 4000),
    location: String(body.location || "").slice(0, 500),
    start: allDay ? { date: body.startDate } : { dateTime: body.start, timeZone },
    end: allDay ? { date: body.endDate } : { dateTime: body.end, timeZone },
  };
  if (Array.isArray(body.attendees)) {
    payload.attendees = body.attendees.filter((email) => typeof email === "string" && email.includes("@")).slice(0, 20).map((email) => ({ email }));
  }
  return payload;
}

function calendarError(res, cause) {
  const status = Number(cause?.status) || 502;
  res.status(status).json({ error: cause instanceof Error ? cause.message : "Calendar request failed." });
}

app.get("/api/calendar/events", async (req, res) => {
  try {
    const from = String(req.query.from || new Date().toISOString());
    const fallbackTo = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
    const to = String(req.query.to || fallbackTo);
    const body = await executeTool(TOOL_IDS.calendarList, {
      path: { calendarId: "primary" },
      query: {
        timeMin: from,
        timeMax: to,
        singleEvents: true,
        orderBy: "startTime",
        maxResults: 80,
      },
    });
    res.json({
      account: "Primary Google Calendar",
      timeZone: body?.timeZone || body?.data?.timeZone || "UTC",
      events: body?.items || body?.data?.items || [],
    });
  } catch (cause) {
    calendarError(res, cause);
  }
});

app.post("/api/calendar/events", async (req, res) => {
  try {
    if (!String(req.body?.summary || "").trim()) return res.status(400).json({ error: "Event title is required." });
    const body = await executeTool(TOOL_IDS.calendarInsert, {
      path: { calendarId: "primary" },
      query: { sendUpdates: "all" },
      body: eventPayload(req.body),
    });
    res.status(201).json(body);
  } catch (cause) {
    calendarError(res, cause);
  }
});

app.patch("/api/calendar/events/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const body = await executeTool(TOOL_IDS.calendarUpdate, {
      path: { calendarId: "primary", eventId: id },
      query: { sendUpdates: "all" },
      body: eventPayload(req.body),
    });
    res.json(body);
  } catch (cause) {
    calendarError(res, cause);
  }
});

app.delete("/api/calendar/events/:id", async (req, res) => {
  try {
    const id = req.params.id;
    await executeTool(TOOL_IDS.calendarDelete, {
      path: { calendarId: "primary", eventId: id },
      query: { sendUpdates: "all" },
    });
    res.status(204).end();
  } catch (cause) {
    calendarError(res, cause);
  }
});

app.get("/api/domains/tlds", async (_req, res) => {
  try {
    const body = await executeTool(TOOL_IDS.domainTlds, {});
    const tlds = body?.tlds || body?.data?.tlds || [];
    res.json({ count: body?.count || tlds.length, tlds });
  } catch (cause) {
    res.status(502).json({ error: cause instanceof Error ? cause.message : "Could not load domain extensions." });
  }
});

app.post("/api/domains/search", async (req, res) => {
  const name = String(req.body?.name || "").toLowerCase().trim().replace(/^https?:\/\//, "").split(".")[0].replace(/[^a-z0-9-]/g, "").replace(/^-+|-+$/g, "").slice(0, 63);
  const tlds = [...new Set((Array.isArray(req.body?.tlds) ? req.body.tlds : []).map((tld) => String(tld).toLowerCase().replace(/^\./, "").replace(/[^a-z0-9-]/g, "")).filter(Boolean))].slice(0, 12);
  if (name.length < 2) return res.status(400).json({ error: "Enter at least two letters for the domain name." });
  if (!tlds.length) return res.status(400).json({ error: "Choose at least one extension." });

  const checks = await Promise.allSettled(tlds.map((tld) => executeTool(TOOL_IDS.domainCheck, { name, tld, whois: false }, 20000)));
  const results = checks.map((check, index) => {
    const tld = tlds[index];
    if (check.status === "rejected") return { domain: `${name}.${tld}`, tld, status: "error", error: check.reason?.message || "Check failed" };
    const body = check.value;
    const status = String(body?.status || body?.data?.status || (body?.available === true ? "available" : body?.available === false ? "taken" : "unknown")).toLowerCase();
    return { domain: `${name}.${tld}`, tld, status };
  });
  res.json({ name, checkedAt: new Date().toISOString(), results });
});

async function collectLinearPages(toolId, baseArgs, key, maxPages = 12) {
  const collected = [];
  let cursor;
  for (let page = 0; page < maxPages; page += 1) {
    const body = await executeTool(toolId, cursor ? { ...baseArgs, cursor } : baseArgs);
    collected.push(...(Array.isArray(body?.[key]) ? body[key] : []));
    const nextCursor = body?.nextPageCursor || body?.cursor;
    if (!body?.hasNextPage || !nextCursor) break;
    cursor = nextCursor;
  }
  return collected;
}

app.get("/api/linear/board", async (_req, res) => {
  try {
    const [user, teams] = await Promise.all([
      executeTool(TOOL_IDS.linearUser, { query: "me" }),
      collectLinearPages(TOOL_IDS.linearTeams, { limit: 250, includeArchived: false, orderBy: "updatedAt" }, "teams"),
    ]);
    const primaryTeam = teams[0];
    if (!primaryTeam) return res.json({ user, teams: [], statuses: [], issues: [], projects: [] });

    const [statuses, issues, projects] = await Promise.all([
      executeTool(TOOL_IDS.linearStatuses, { team: primaryTeam.id }),
      collectLinearPages(TOOL_IDS.linearIssues, {
        team: primaryTeam.id,
        limit: 250,
        includeArchived: false,
        orderBy: "updatedAt",
        fields: ["id", "title", "description", "priority", "url", "createdAt", "updatedAt", "dueDate", "status", "statusType", "labels", "project", "projectId", "team", "teamId", "assignee"],
      }, "issues"),
      collectLinearPages(TOOL_IDS.linearProjects, {
        team: primaryTeam.id,
        limit: 50,
        includeArchived: false,
        includeMembers: true,
        orderBy: "updatedAt",
        fields: ["id", "name", "summary", "url", "priority", "status", "teams", "members", "targetDate", "updatedAt"],
      }, "projects"),
    ]);
    res.json({ user, teams, team: primaryTeam, statuses: Array.isArray(statuses) ? statuses : statuses?.statuses || [], issues, projects });
  } catch (cause) {
    res.status(502).json({ error: cause instanceof Error ? cause.message : "Linear did not return the board." });
  }
});

app.post("/api/linear/issues", async (req, res) => {
  try {
    const title = String(req.body?.title || "").trim().slice(0, 240);
    const team = String(req.body?.team || "").trim();
    if (!title || !team) return res.status(400).json({ error: "Task title and team are required." });
    const args = {
      title,
      team,
      assignee: "me",
      description: String(req.body?.description || "").slice(0, 12000),
      priority: Number(req.body?.priority || 0),
    };
    if (req.body?.state) args.state = String(req.body.state);
    if (req.body?.project) args.project = String(req.body.project);
    if (req.body?.dueDate) args.dueDate = String(req.body.dueDate);
    const issue = await executeTool(TOOL_IDS.linearSaveIssue, args);
    res.status(201).json(issue);
  } catch (cause) {
    res.status(502).json({ error: cause instanceof Error ? cause.message : "Could not create the Linear task." });
  }
});

app.patch("/api/linear/issues/:id", async (req, res) => {
  try {
    const args = { id: req.params.id };
    if (req.body?.state) args.state = String(req.body.state);
    if (req.body?.title) args.title = String(req.body.title).slice(0, 240);
    if (req.body?.priority !== undefined) args.priority = Number(req.body.priority);
    if (req.body?.project !== undefined) args.project = req.body.project ? String(req.body.project) : null;
    const issue = await executeTool(TOOL_IDS.linearSaveIssue, args);
    res.json(issue);
  } catch (cause) {
    res.status(502).json({ error: cause instanceof Error ? cause.message : "Could not update the Linear task." });
  }
});

app.post("/api/linear/projects", async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim().slice(0, 200);
    const team = String(req.body?.team || "").trim();
    if (!name || !team) return res.status(400).json({ error: "Project name and team are required." });
    const project = await executeTool(TOOL_IDS.linearSaveProject, {
      name,
      summary: String(req.body?.summary || "").slice(0, 255),
      addTeams: [team],
      leadTeam: team,
      lead: "me",
    });
    res.status(201).json(project);
  } catch (cause) {
    res.status(502).json({ error: cause instanceof Error ? cause.message : "Could not create the Linear project." });
  }
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
