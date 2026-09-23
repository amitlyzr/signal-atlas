import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Bookmark, Building2, Clock3, Flame, LoaderCircle, MessageCircle, RefreshCw, Rocket, Search, TrendingUp, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { cachedRequest, cacheTime, refreshRequest } from "./query";

type Story = {
  id: number;
  rank: number;
  title: string;
  by: string;
  score: number;
  comments: number;
  time: number;
  category: string;
  domain: string;
  url: string;
  discussionUrl: string;
};

const filters = [
  { id: "all", label: "All signals" },
  { id: "launches", label: "Launches" },
  { id: "ai", label: "AI & models" },
  { id: "capital", label: "Capital" },
  { id: "founders", label: "Founders" },
  { id: "platform", label: "Platforms" },
];

const categoryNames: Record<string, string> = {
  launches: "Launch watch",
  ai: "AI & models",
  capital: "Capital moves",
  founders: "Founder notes",
  platform: "Platform shift",
  general: "Front page",
};

function ageFrom(timestamp: number) {
  const minutes = Math.max(1, Math.floor((Date.now() - timestamp * 1000) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function loadWatchlist(): number[] {
  try { return JSON.parse(localStorage.getItem("signal-atlas-hn-watchlist") || "[]"); } catch { return []; }
}

export default function HackerNewsPage() {
  const [stories, setStories] = useState<Story[]>([]);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [watchlist, setWatchlist] = useState<number[]>(loadWatchlist);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState("");

  async function loadStories(force = false) {
    setLoading(true);
    setError("");
    try {
      const key = ["hackernews", "startups"] as const;
      const url = `/api/hackernews/startups${force ? "?refresh=1" : ""}`;
      const body = force
        ? await refreshRequest<{ stories: Story[]; generatedAt?: string }>(key, url)
        : await cachedRequest<{ stories: Story[]; generatedAt?: string }>(key, url, undefined, cacheTime.search);
      setStories(body.stories || []);
      setUpdatedAt(body.generatedAt || new Date().toISOString());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load Hacker News.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadStories(); }, []);
  useEffect(() => { localStorage.setItem("signal-atlas-hn-watchlist", JSON.stringify(watchlist)); }, [watchlist]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return stories.filter((story) => (filter === "all" || story.category === filter) && (!needle || `${story.title} ${story.domain} ${story.by}`.toLowerCase().includes(needle)));
  }, [stories, filter, query]);
  const featured = visible[0];
  const feed = visible.slice(1);
  const watchedStories = stories.filter((story) => watchlist.includes(story.id));
  const totalPoints = stories.reduce((sum, story) => sum + story.score, 0);
  const totalComments = stories.reduce((sum, story) => sum + story.comments, 0);
  const hottest = [...stories].sort((a, b) => (b.comments + b.score) - (a.comments + a.score)).slice(0, 4);

  function toggleWatch(id: number) {
    setWatchlist((current) => current.includes(id) ? current.filter((item) => item !== id) : [id, ...current]);
  }

  return (
    <main className="hn-main" id="top">
      <section className="hn-hero">
        <div className="hn-dateline"><span>Founder Wire / Hacker News</span><span>{new Intl.DateTimeFormat("en", { weekday: "long", day: "2-digit", month: "long" }).format(new Date())}</span></div>
        <div className="hn-hero-grid">
          <div><span className="kicker">Live startup intelligence</span><h1>The startup world,<br /><em>in motion.</em></h1></div>
          <div className="hn-hero-note"><Flame size={20} /><p>A fast read on products shipping, capital moving, and technical shifts earning founder attention—ranked live through Hacker News.</p><button onClick={() => loadStories(true)} disabled={loading}><RefreshCw size={14} className={loading ? "spinning" : ""} />Refresh wire</button></div>
        </div>
      </section>

      <section className="hn-ticker" aria-label="Startup signal summary">
        <div><strong>{String(stories.length).padStart(2, "0")}</strong><span>live stories</span></div>
        <div><strong>{totalPoints.toLocaleString()}</strong><span>signal points</span></div>
        <div><strong>{totalComments.toLocaleString()}</strong><span>comments tracked</span></div>
        <div><strong>{String(watchlist.length).padStart(2, "0")}</strong><span>on your watchlist</span></div>
        <div className="hn-ticker-time"><span className="live-dot" /><span>{updatedAt ? `Updated ${ageFrom(new Date(updatedAt).getTime() / 1000)}` : "Opening the wire"}</span></div>
      </section>

      <section className="hn-controls">
        <div className="hn-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search the wire…" aria-label="Search startup stories" /></div>
        <div className="hn-filters">{filters.map((item) => <button className={filter === item.id ? "active" : ""} onClick={() => setFilter(item.id)} key={item.id}>{item.label}</button>)}</div>
      </section>

      {error && <div className="hn-error"><Zap size={17} /><span>{error}</span><button onClick={() => loadStories(true)}>Retry</button></div>}

      {loading && !stories.length ? <div className="hn-loading"><LoaderCircle size={22} /><span>Scanning the front page for startup signal…</span></div> : (
        <section className="hn-workspace">
          <div className="hn-newsroom">
            {featured ? <motion.article className="hn-lead" initial={{ opacity: 0, y: 9 }} animate={{ opacity: 1, y: 0 }}>
              <div className="hn-lead-copy"><div className="hn-story-label"><span>Lead signal</span><b>{categoryNames[featured.category] || "Front page"}</b></div><h2>{featured.title}</h2><div className="hn-byline"><span>By {featured.by}</span><span>{featured.domain}</span><span>{ageFrom(featured.time)}</span></div><div className="hn-lead-actions"><a href={featured.url} target="_blank" rel="noreferrer">Read story<ArrowUpRight size={15} /></a><a href={featured.discussionUrl} target="_blank" rel="noreferrer"><MessageCircle size={14} />{featured.comments} comments</a><button className={watchlist.includes(featured.id) ? "active" : ""} onClick={() => toggleWatch(featured.id)}><Bookmark size={14} fill={watchlist.includes(featured.id) ? "currentColor" : "none"} />Watch</button></div></div>
              <div className="hn-lead-score"><span>Momentum</span><strong>{featured.score}</strong><small>points</small><i style={{ "--momentum": `${Math.min(100, Math.max(12, featured.score / 5))}%` } as React.CSSProperties} /></div>
            </motion.article> : <div className="hn-empty"><Search size={25} /><h2>No signal in this cut.</h2><p>Try another category or broaden your search.</p></div>}

            {feed.length > 0 && <div className="hn-feed"><header><span>Latest transmission</span><span>{String(feed.length).padStart(2, "0")} stories</span></header>{feed.map((story, index) => <motion.article key={story.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * .025, .2) }}><span className="hn-rank">{String(index + 2).padStart(2, "0")}</span><div className="hn-feed-copy"><span>{categoryNames[story.category] || "Front page"} · {story.domain}</span><a href={story.url} target="_blank" rel="noreferrer"><h3>{story.title}</h3></a><div><span><Clock3 size={12} />{ageFrom(story.time)}</span><span><TrendingUp size={12} />{story.score} points</span><a href={story.discussionUrl} target="_blank" rel="noreferrer"><MessageCircle size={12} />{story.comments}</a></div></div><button className={watchlist.includes(story.id) ? "hn-save active" : "hn-save"} onClick={() => toggleWatch(story.id)} aria-label={watchlist.includes(story.id) ? "Remove from watchlist" : "Add to watchlist"}><Bookmark size={16} fill={watchlist.includes(story.id) ? "currentColor" : "none"} /></button></motion.article>)}</div>}
          </div>

          <aside className="hn-sidebar">
            <section><div className="hn-side-title"><Rocket size={15} /><span>Most discussed</span></div>{hottest.map((story, index) => <a className="hn-hot-item" href={story.discussionUrl} target="_blank" rel="noreferrer" key={story.id}><strong>{String(index + 1).padStart(2, "0")}</strong><div><span>{story.comments} comments</span><p>{story.title}</p></div></a>)}</section>
            <section><div className="hn-side-title"><Bookmark size={15} /><span>Your watchlist</span></div>{watchedStories.length ? watchedStories.slice(0, 5).map((story) => <a className="hn-watch-item" href={story.url} target="_blank" rel="noreferrer" key={story.id}><span>{categoryNames[story.category] || "Signal"}</span><p>{story.title}</p></a>) : <div className="hn-watch-empty"><Building2 size={21} /><p>Save stories to build a compact founder briefing.</p></div>}</section>
          </aside>
        </section>
      )}
    </main>
  );
}
