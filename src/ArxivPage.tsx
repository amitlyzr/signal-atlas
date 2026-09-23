import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Bookmark, BookOpenText, CalendarDays, CircleAlert, ExternalLink, FileText, LoaderCircle, Search, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { cachedRequest, cacheTime } from "./query";

type Paper = { id: string; title: string; summary: string; published: string; updated: string; authors: string[]; categories: string[]; primaryCategory: string; url: string; pdfUrl: string };
type Sort = "relevance" | "submittedDate" | "lastUpdatedDate";

const categories = [
  { id: "", label: "All fields" },
  { id: "cs.AI", label: "Artificial intelligence" },
  { id: "cs.LG", label: "Machine learning" },
  { id: "cs.CL", label: "Computation & language" },
  { id: "stat.ML", label: "Statistical ML" },
  { id: "quant-ph", label: "Quantum physics" },
];
const prompts = ["agentic AI systems", "retrieval augmented generation", "small language models"];

function paperDate(value: string) {
  if (!value) return "Undated";
  return new Intl.DateTimeFormat("en", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function loadSaved(): Paper[] {
  try { return JSON.parse(localStorage.getItem("signal-atlas-arxiv") || "[]"); } catch { return []; }
}

export default function ArxivPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState<Sort>("relevance");
  const [papers, setPapers] = useState<Paper[]>([]);
  const [selected, setSelected] = useState<Paper | null>(null);
  const [saved, setSaved] = useState<Paper[]>(loadSaved);
  const [mode, setMode] = useState<"search" | "saved">("search");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { localStorage.setItem("signal-atlas-arxiv", JSON.stringify(saved)); }, [saved]);
  const visiblePapers = mode === "saved" ? saved : papers;
  const savedIds = useMemo(() => new Set(saved.map((paper) => paper.id)), [saved]);

  async function search(event?: FormEvent, suggested?: string, daily = false) {
    event?.preventDefault();
    const nextQuery = (suggested ?? query).trim();
    if (!daily && nextQuery.length < 2) return;
    setQuery(nextQuery);
    setLoading(true);
    setError("");
    setMode("search");
    try {
      const params = new URLSearchParams({ q: nextQuery, category, sort, ...(daily ? { mode: "daily" } : {}) });
      const body = await cachedRequest<{ papers: Paper[] }>(["arxiv", "papers", params.toString()], `/api/arxiv/papers?${params}`, undefined, cacheTime.search);
      setPapers(body.papers || []);
      setSelected(body.papers?.[0] || null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "arXiv search failed.");
    } finally {
      setLoading(false);
    }
  }

  function toggleSaved(paper: Paper) {
    setSaved((current) => current.some((item) => item.id === paper.id) ? current.filter((item) => item.id !== paper.id) : [paper, ...current]);
  }

  return (
    <main className="arxiv-main" id="top">
      <section className="arxiv-hero">
        <div className="arxiv-issue"><span>Research index</span><b>Vol. 01 / arXiv</b></div>
        <div className="arxiv-title"><div><span className="kicker">Connected scholarly search</span><h1>Read the frontier.<br /><em>Keep the thread.</em></h1></div><p>Search arXiv by idea and discipline. Compare abstracts, inspect authorship, open the PDF, and keep a private reading list in this browser.</p></div>
        <form className="arxiv-search" onSubmit={search}><Search size={21} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search a method, problem, or paper title…" aria-label="Search arXiv" /><select value={sort} onChange={(event) => setSort(event.target.value as Sort)} aria-label="Sort papers"><option value="relevance">Relevance</option><option value="submittedDate">Newest submitted</option><option value="lastUpdatedDate">Recently updated</option></select><button disabled={loading || query.trim().length < 2}>{loading ? <LoaderCircle size={17} /> : <ArrowUpRight size={17} />}Search papers</button></form>
        <div className="arxiv-controls"><div className="arxiv-categories">{categories.map((item) => <button className={category === item.id ? "active" : ""} onClick={() => setCategory(item.id)} key={item.id}>{item.label}</button>)}</div><button className="arxiv-daily" onClick={() => search(undefined, undefined, true)}><Sparkles size={14} />Daily dispatch</button></div>
        <div className="arxiv-prompts"><span>Trace a live question</span>{prompts.map((prompt) => <button onClick={() => search(undefined, prompt)} key={prompt}>{prompt}</button>)}</div>
        {error && <div className="arxiv-error"><CircleAlert size={17} /><span>{error}</span></div>}
      </section>

      <section className="arxiv-index">
        <aside className="arxiv-index-rail"><span className="kicker">Desk mode</span><button className={mode === "search" ? "active" : ""} onClick={() => setMode("search")}><Search size={15} />Results <b>{papers.length}</b></button><button className={mode === "saved" ? "active" : ""} onClick={() => setMode("saved")}><Bookmark size={15} />Reading list <b>{saved.length}</b></button><div><FileText size={17} /><p>Abstracts and metadata come directly from the connected arXiv catalog.</p></div></aside>

        <div className="arxiv-results">
          <header><div><span className="kicker">{mode === "saved" ? "Private shelf" : query ? `Query / ${query}` : "Research desk"}</span><h2>{mode === "saved" ? "Saved papers" : papers.length ? "Search results" : "Begin with a question"}</h2></div><span>{String(visiblePapers.length).padStart(2, "0")} indexed</span></header>
          {loading ? <div className="arxiv-loading"><LoaderCircle size={20} />Consulting the archive…</div> : visiblePapers.length ? <div className="arxiv-paper-list">{visiblePapers.map((paper, index) => <motion.article className={selected?.id === paper.id ? "selected" : ""} key={paper.id || index} initial={{ opacity: 0, y: 7 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * .035, .25) }}><button className="arxiv-paper-open" onClick={() => setSelected(paper)}><span className="arxiv-paper-number">{String(index + 1).padStart(2, "0")}</span><span><small>{paper.primaryCategory || paper.categories[0] || "arXiv"} · {paperDate(paper.published)}</small><h3>{paper.title}</h3><p>{paper.summary}</p><em>{paper.authors.slice(0, 3).join(", ")}{paper.authors.length > 3 ? ` +${paper.authors.length - 3}` : ""}</em></span></button><button className={savedIds.has(paper.id) ? "arxiv-bookmark active" : "arxiv-bookmark"} onClick={() => toggleSaved(paper)} aria-label={savedIds.has(paper.id) ? "Remove from reading list" : "Save to reading list"}><Bookmark size={16} fill={savedIds.has(paper.id) ? "currentColor" : "none"} /></button></motion.article>)}</div> : <div className="arxiv-empty"><BookOpenText size={29} /><h3>{mode === "saved" ? "Your reading list is empty" : "The index is waiting"}</h3><p>{mode === "saved" ? "Bookmark papers from a search and they will stay here." : "Search a topic above or open today’s category dispatch."}</p></div>}
        </div>

        <aside className={`arxiv-detail ${selected ? "arxiv-detail--open" : ""}`}>
          {selected ? <div><span className="kicker">Paper / {selected.id}</span><h2>{selected.title}</h2><div className="arxiv-authors">{selected.authors.map((author) => <span key={author}>{author}</span>)}</div><dl><div><dt>Submitted</dt><dd>{paperDate(selected.published)}</dd></div><div><dt>Updated</dt><dd>{paperDate(selected.updated)}</dd></div><div><dt>Primary field</dt><dd>{selected.primaryCategory || "—"}</dd></div></dl><section><span>Abstract</span><p>{selected.summary || "No abstract returned."}</p></section><div className="arxiv-detail-actions"><button onClick={() => toggleSaved(selected)}><Bookmark size={15} fill={savedIds.has(selected.id) ? "currentColor" : "none"} />{savedIds.has(selected.id) ? "Saved" : "Save paper"}</button><a href={selected.pdfUrl || `https://arxiv.org/pdf/${selected.id}.pdf`} target="_blank" rel="noreferrer">Open PDF<ExternalLink size={15} /></a></div></div> : <div className="arxiv-detail-empty"><CalendarDays size={27} /><span className="kicker">Paper notes</span><h2>Select a result<br />to inspect it.</h2><p>The complete abstract, author list, categories, and PDF link will appear here.</p></div>}
        </aside>
      </section>
    </main>
  );
}
