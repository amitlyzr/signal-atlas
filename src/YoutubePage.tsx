import { FormEvent, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, CircleAlert, ExternalLink, LoaderCircle, Play, Search, X } from "lucide-react";
import { cachedRequest, cacheTime } from "./query";

type Video = { id: string; title: string; channel: string; publishedAt: string; description: string; thumbnail: string; url: string };
type SearchResult = { query: string; order: string; duration: string; videos: Video[] };

const suggestions = ["Rehbara", "Vilen", "Abhijeet Srivastava", "Kamal Khan"];

function readableDate(value: string) {
  if (!value) return "Recent";
  return new Intl.DateTimeFormat("en", { year: "numeric" }).format(new Date(value));
}

export default function YoutubePage() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [selected, setSelected] = useState<Video | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function search(event?: FormEvent, suggested?: string) {
    event?.preventDefault();
    const nextQuery = (suggested ?? query).trim();
    if (nextQuery.length < 2 || loading) return;
    setQuery(nextQuery);
    setLoading(true);
    setError("");
    try {
      const body = await cachedRequest<SearchResult>(["youtube", "search", nextQuery.toLowerCase()], "/api/youtube/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: nextQuery, order: "relevance", duration: "any" }),
      }, cacheTime.search);
      setResult(body);
      setSelected(body.videos?.[0] || null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "YouTube search failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="youtube-main" id="top">
      <div className="yt-noise" aria-hidden="true" />
      <section className={`yt-hero ${result ? "yt-hero--searched" : ""}`}>
        <span className="yt-ghost-word" aria-hidden="true">LISTEN</span>
        <div className="yt-hero-label"><b>01</b><span>Music discovery, tuned by signal</span></div>
        <h1>Find the song.<br /><em>Keep the feeling.</em></h1>

        <form className="yt-search" onSubmit={search}>
          <Search size={23} aria-hidden="true" />
          <label className="sr-only" htmlFor="youtube-query">Search songs on YouTube</label>
          <input id="youtube-query" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search a song, artist, mood…" autoComplete="off" />
          {query && <button className="yt-clear" type="button" onClick={() => setQuery("")} aria-label="Clear search"><X size={18} /></button>}
          <button className="yt-submit" type="submit" disabled={loading || query.trim().length < 2}>
            {loading ? <LoaderCircle className="yt-spin" size={20} /> : <><span>Search</span><ArrowUpRight size={17} /></>}
          </button>
        </form>

        <div className="yt-suggestions"><span>Try</span>{suggestions.map((suggestion) => <button key={suggestion} onClick={() => search(undefined, suggestion)}>{suggestion}</button>)}</div>
        {error && <div className="yt-error"><CircleAlert size={17} />{error}</div>}
      </section>

      {!result && !loading && (
        <section className="yt-intro">
          <div><span className="yt-section-label">Live catalog</span><strong>YouTube</strong></div>
          <p>Search for the track you remember—or just the feeling you don’t want to lose.</p>
          <small>Connected and ready</small>
        </section>
      )}

      <AnimatePresence mode="wait">
        {result && !loading && (
          <motion.section className="yt-results" key={result.query} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: .35 }}>
            {selected ? (
              <>
                <article className="yt-feature">
                  <div className="yt-video-stage">
                    <iframe key={selected.id} src={`https://www.youtube.com/embed/${selected.id}?rel=0`} title={selected.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />
                    <span className="yt-source-stamp">YT / {selected.channel.slice(0, 4).toUpperCase()}</span>
                  </div>
                  <div className="yt-track-dossier">
                    <div className="yt-tabs"><span>Now selected</span><span>Details</span></div>
                    <h2>{selected.title}</h2>
                    <strong className="yt-channel">{selected.channel}</strong>
                    <p>{selected.description || "A song surfaced from the live YouTube catalog. Press play and keep the feeling close."}</p>
                    <dl>
                      <div><dt>Released</dt><dd>{readableDate(selected.publishedAt)}</dd></div>
                      <div><dt>Format</dt><dd>Video</dd></div>
                      <div><dt>Source</dt><dd>YouTube</dd></div>
                    </dl>
                    <a className="yt-play-link" href={selected.url} target="_blank" rel="noreferrer"><Play size={16} fill="currentColor" /><span>Play on YouTube</span><ExternalLink size={15} /></a>
                  </div>
                </article>

                <section className="yt-library" id="youtube-library">
                  <header><div><span className="yt-section-label">02 / Search results</span><h2>More from “{result.query}”</h2></div><span>{String(result.videos.length).padStart(2, "0")} tracks</span></header>
                  <div className="yt-library-grid">
                    {result.videos.map((video, index) => (
                      <button className={video.id === selected.id ? "active" : ""} onClick={() => setSelected(video)} key={`${video.id}-${index}`}>
                        <span className="yt-card-image">{video.thumbnail ? <img src={video.thumbnail} alt="" loading="lazy" /> : <span className="yt-image-fallback"><Play size={22} /></span>}<i><Play size={13} fill="currentColor" /></i></span>
                        <span className="yt-card-index">{String(index + 1).padStart(2, "0")}</span>
                        <span className="yt-card-copy"><strong>{video.title}</strong><small>{video.channel} · {readableDate(video.publishedAt)}</small></span>
                      </button>
                    ))}
                  </div>
                </section>
              </>
            ) : <div className="yt-no-results"><Search size={25} /><h2>No song found</h2><p>Try a broader title or artist.</p></div>}
          </motion.section>
        )}
      </AnimatePresence>
    </main>
  );
}
