import { FormEvent, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUpRight,
  BookOpenText,
  ChevronRight,
  CircleAlert,
  Compass,
  ExternalLink,
  Flame,
  Globe2,
  Play,
  Search,
  Sparkles,
} from "lucide-react";
import CalendarPage from "./CalendarPage";
import DomainPage from "./DomainPage";
import LinearPage from "./LinearPage";
import YoutubePage from "./YoutubePage";
import GmailPage from "./GmailPage";

type Source = { id: string; title: string; url: string; domain: string; excerpt: string; position: number; category: string };
type Video = { id: string; title: string; channel: string; publishedAt: string; description: string; thumbnail: string; url: string };
type Lens = { gaps: { term: string; mentions: number }[]; domains: number; sourceCount: number; videoCount: number; generatedAt: string };
type Atlas = { query: string; sources: Source[]; videos: Video[]; lens: Lens; providerErrors: Record<string, string> };

const sampleTopics = ["small modular reactors", "solid-state batteries", "AI search behavior"];

function formatDate(date: string) {
  if (!date) return "Recent";
  return new Intl.DateTimeFormat("en", { month: "short", year: "numeric" }).format(new Date(date));
}

function App() {
  const isCalendar = window.location.pathname.startsWith("/calendar");
  const isDomains = window.location.pathname.startsWith("/domains");
  const isLinear = window.location.pathname.startsWith("/linear");
  const isYoutube = window.location.pathname.startsWith("/youtube");
  const isGmail = window.location.pathname.startsWith("/gmail");
  const [query, setQuery] = useState("");
  const [atlas, setAtlas] = useState<Atlas | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const noun = useMemo(() => atlas?.query || "the open web", [atlas]);

  async function discover(event?: FormEvent, suggested?: string) {
    event?.preventDefault();
    const nextQuery = (suggested ?? query).trim();
    if (!nextQuery || loading) return;
    setQuery(nextQuery);
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: nextQuery }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "The atlas could not be built.");
      setAtlas(body);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The atlas could not be built.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`app-shell ${isYoutube ? "app-shell--youtube" : ""}`}>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Signal Atlas home">
          <span className="brand-mark"><Compass size={19} strokeWidth={1.8} /></span>
          <span>{isYoutube ? "Signal/Room" : "Signal Atlas"}</span>
        </a>
        <nav className="product-nav" aria-label="Product">
          <a className={!isCalendar && !isDomains && !isLinear && !isYoutube && !isGmail ? "active" : ""} href="/">Research</a>
          <a className={isYoutube ? "active" : ""} href="/youtube">YouTube</a>
          <a className={isGmail ? "active" : ""} href="/gmail">Gmail</a>
          <a className={isCalendar ? "active" : ""} href="/calendar">Calendar</a>
          <a className={isDomains ? "active" : ""} href="/domains">Domains</a>
          <a className={isLinear ? "active" : ""} href="/linear">Linear</a>
        </nav>
        <div className="topbar-meta">
          <span className="live-dot" />
          <span>{isYoutube ? "Live YouTube connector" : isGmail ? "Live Gmail" : isCalendar ? "Google Calendar" : isDomains ? "Find a Domain" : isLinear ? "Linear MCP" : "Firecrawl + YouTube"}</span>
          <span className="edition">Field edition / 01</span>
        </div>
      </header>

      {isYoutube ? <YoutubePage /> : isGmail ? <GmailPage /> : isCalendar ? <CalendarPage /> : isDomains ? <DomainPage /> : isLinear ? <LinearPage /> : <>

      <main id="top">
        <section className={`hero ${atlas ? "hero--compact" : ""}`}>
          <div className="eyebrow"><span>Research instrument</span><span>Two surfaces, one signal</span></div>
          <div className="hero-copy">
            <h1>See where the web’s <em>evidence</em> meets YouTube’s conversation.</h1>
            <p>Enter one topic. Signal Atlas maps authoritative sources, the videos shaping attention, and the useful gaps between them.</p>
          </div>

          <form className="search-box" onSubmit={discover}>
            <Search size={21} aria-hidden="true" />
            <label className="sr-only" htmlFor="topic">Research a topic</label>
            <input id="topic" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="What signal are you tracing?" autoComplete="off" />
            <button type="submit" disabled={loading || query.trim().length < 3}>
              {loading ? <span className="button-loader" /> : <><span>Build atlas</span><ArrowUpRight size={17} /></>}
            </button>
            {loading && <motion.span className="scan-line" initial={{ x: "-120%" }} animate={{ x: "420%" }} transition={{ repeat: Infinity, duration: 1.6, ease: "linear" }} />}
          </form>

          {!atlas && (
            <div className="topic-row">
              <span>Try a live trail</span>
              {sampleTopics.map((topic) => <button key={topic} onClick={() => discover(undefined, topic)}>{topic}<ChevronRight size={13} /></button>)}
            </div>
          )}
          {error && <div className="global-error"><CircleAlert size={17} />{error}</div>}
        </section>

        {!atlas && <Manifesto />}

        <AnimatePresence mode="wait">
          {atlas && !loading && (
            <motion.section className="atlas" key={atlas.query} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
              <header className="atlas-header">
                <div><span className="kicker">Atlas / {new Date(atlas.lens.generatedAt).toISOString().slice(0, 10)}</span><h2>{noun}</h2></div>
                <div className="stats">
                  <div><strong>{atlas.lens.sourceCount.toString().padStart(2, "0")}</strong><span>sources</span></div>
                  <div><strong>{atlas.lens.domains.toString().padStart(2, "0")}</strong><span>domains</span></div>
                  <div><strong>{atlas.lens.videoCount.toString().padStart(2, "0")}</strong><span>videos</span></div>
                </div>
              </header>

              <div className="atlas-grid">
                <div className="evidence-column">
                  <SectionLabel icon={<Globe2 size={15} />} number="01" title="Web evidence" note="Ranked by Firecrawl" />
                  {atlas.providerErrors.firecrawl ? <ProviderError provider="Firecrawl" message={atlas.providerErrors.firecrawl} /> : (
                    <div className="source-list">
                      {atlas.sources.map((source, index) => (
                        <motion.a className="source-card" href={source.url} target="_blank" rel="noreferrer" key={source.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.045 }}>
                          <div className="source-index">{String(source.position).padStart(2, "0")}</div>
                          <div className="source-body">
                            <div className="source-domain"><span>{source.domain}</span><ExternalLink size={13} /></div>
                            <h3>{source.title}</h3>
                            <p>{source.excerpt}</p>
                          </div>
                        </motion.a>
                      ))}
                    </div>
                  )}
                </div>

                <aside className="signal-column">
                  <SectionLabel icon={<Play size={15} />} number="02" title="Video signal" note="Live from YouTube" accent />
                  {atlas.providerErrors.youtube ? <ProviderError provider="YouTube" message={atlas.providerErrors.youtube} /> : (
                    <div className="video-list">
                      {atlas.videos.map((video) => (
                        <a className="video-card" href={video.url} target="_blank" rel="noreferrer" key={video.id}>
                          <div className="video-thumb">
                            {video.thumbnail ? <img src={video.thumbnail} alt="" loading="lazy" /> : <div className="thumb-fallback"><Play size={24} /></div>}
                            <span className="play-badge"><Play size={12} fill="currentColor" /></span>
                          </div>
                          <div><span className="video-meta">{video.channel} · {formatDate(video.publishedAt)}</span><h3>{video.title}</h3></div>
                        </a>
                      ))}
                    </div>
                  )}

                  <div className="gap-lens">
                    <div className="gap-heading"><Sparkles size={16} /><span>Gap lens</span><span className="beta">heuristic</span></div>
                    <p>Terms recurring in web evidence but missing from returned video language.</p>
                    {atlas.lens.gaps.length ? <div className="gap-tags">{atlas.lens.gaps.map((gap) => <span key={gap.term}>{gap.term}<small>{gap.mentions}×</small></span>)}</div> : <div className="gap-empty">No clear gap surfaced in this pass.</div>}
                  </div>
                </aside>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      </>}

      <footer><span>Signal Atlas</span><span>Evidence has shape. Attention has velocity.</span><span>Built on connected tools</span></footer>
    </div>
  );
}

function Manifesto() {
  return (
    <section className="manifesto">
      <div className="manifesto-intro"><span className="kicker">The instrument</span><h2>Not another answer box.<br />A place to inspect the signal.</h2></div>
      <div className="manifesto-grid">
        <article><span>01</span><Globe2 size={23} /><h3>Trace the evidence</h3><p>Firecrawl surfaces ranked sources and query-relevant excerpts without flattening where each idea came from.</p></article>
        <article><span>02</span><Flame size={23} /><h3>Watch attention move</h3><p>YouTube reveals the creators, framings, and publication rhythm carrying the topic into public conversation.</p></article>
        <article><span>03</span><BookOpenText size={23} /><h3>Find the white space</h3><p>The gap lens highlights concepts present in evidence but absent from video language—a starting point for inquiry, not a verdict.</p></article>
      </div>
    </section>
  );
}

function SectionLabel({ icon, number, title, note, accent = false }: { icon: React.ReactNode; number: string; title: string; note: string; accent?: boolean }) {
  return <div className={`section-label ${accent ? "section-label--accent" : ""}`}><div>{icon}<span>{number}</span><strong>{title}</strong></div><small>{note}</small></div>;
}

function ProviderError({ provider, message }: { provider: string; message: string }) {
  return <div className="provider-error"><CircleAlert size={20} /><div><strong>{provider} signal unavailable</strong><p>{message}</p><small>The other connected source remains live. Try again after the connector recovers.</small></div></div>;
}

export default App;
