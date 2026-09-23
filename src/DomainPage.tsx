import { FormEvent, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, Check, CircleAlert, Globe2, Sparkles, X } from "lucide-react";
import { cachedRequest, cacheTime } from "./query";

type DomainResult = { domain: string; tld: string; status: string; error?: string };
const preferredTlds = ["com", "ai", "io", "co", "app", "dev", "tech", "xyz"];

function DomainPage() {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>(["com", "ai", "io", "co"]);
  const [allTlds, setAllTlds] = useState<string[]>(preferredTlds);
  const [results, setResults] = useState<DomainResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchedName, setSearchedName] = useState("");

  useEffect(() => {
    cachedRequest<{ tlds: string[] }>(["domains", "tlds"], "/api/domains/tlds", undefined, cacheTime.catalog)
      .then((body) => { if (Array.isArray(body.tlds)) setAllTlds(body.tlds); })
      .catch(() => undefined);
  }, []);

  const tldOptions = useMemo(() => {
    const first = preferredTlds.filter((tld) => allTlds.includes(tld));
    return [...first, ...selected.filter((tld) => !first.includes(tld))];
  }, [allTlds, selected]);

  function toggleTld(tld: string) {
    setSelected((current) => current.includes(tld) ? current.filter((item) => item !== tld) : current.length < 12 ? [...current, tld] : current);
  }

  async function searchDomains(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    setResults([]);
    try {
      const body = await cachedRequest<{ name: string; results: DomainResult[] }>(["domains", "search", name.trim().toLowerCase(), [...selected].sort()], "/api/domains/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, tlds: selected }),
      }, cacheTime.search);
      setSearchedName(body.name);
      setResults(body.results || []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Domain search failed.");
    } finally {
      setLoading(false);
    }
  }

  const available = results.filter((result) => result.status === "available").length;

  return (
    <main className="domain-main">
      <section className="domain-hero">
        <div><span className="kicker">Domain fieldbook</span><h1>Name the<br /><em>next thing.</em></h1></div>
        <div className="domain-aside"><p>Search the namespace before the idea gets crowded. One name, the extensions that matter, live availability.</p><div><span>850</span><small>extensions indexed</small></div></div>
      </section>

      <section className="domain-search-panel">
        <form onSubmit={searchDomains}>
          <div className="domain-input-row"><Globe2 size={22} /><span className="protocol">https://</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="your-next-name" aria-label="Domain name" autoComplete="off" /><button disabled={loading || name.trim().length < 2 || !selected.length}>{loading ? "Checking…" : <><span>Check domains</span><ArrowUpRight size={17} /></>}</button></div>
          <div className="tld-selector"><span>Extensions</span><div>{tldOptions.map((tld) => <button type="button" className={selected.includes(tld) ? "selected" : ""} key={tld} onClick={() => toggleTld(tld)}>{selected.includes(tld) && <Check size={12} />}.{tld}</button>)}</div><label className="custom-tld"><span>+</span><input aria-label="Add custom extension" placeholder="other" list="tld-list" onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); const tld = event.currentTarget.value.toLowerCase().replace(/^\./, ""); if (allTlds.includes(tld) && !selected.includes(tld) && selected.length < 12) setSelected([...selected, tld]); event.currentTarget.value = ""; } }} /><datalist id="tld-list">{allTlds.map((tld) => <option value={tld} key={tld} />)}</datalist></label></div>
        </form>
      </section>

      {error && <div className="domain-error"><CircleAlert size={18} />{error}</div>}

      <AnimatePresence mode="wait">
        {results.length > 0 && <motion.section className="domain-results" key={searchedName} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <header><div><span className="kicker">Availability ledger</span><h2>{searchedName}</h2></div><div className="result-tally"><strong>{available.toString().padStart(2, "0")}</strong><span>of {results.length} available</span></div></header>
          <div className="domain-result-grid">
            {results.map((result, index) => {
              const isAvailable = result.status === "available";
              return <motion.article className={`domain-result ${isAvailable ? "domain-result--available" : ""}`} key={result.domain} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .045 }}>
                <div className="status-mark">{isAvailable ? <Check size={17} /> : <X size={17} />}</div>
                <span className="domain-status">{result.status === "error" ? "Check failed" : result.status}</span>
                <h3>{searchedName}<strong>.{result.tld}</strong></h3>
                <p>{isAvailable ? "Open territory. Ready to register with your preferred registrar." : result.status === "error" ? result.error : "Already claimed. Try another extension or a sharper variation."}</p>
                {isAvailable && <a href={`https://www.google.com/search?q=${encodeURIComponent(`register ${result.domain}`)}`} target="_blank" rel="noreferrer">Find a registrar <ArrowUpRight size={14} /></a>}
              </motion.article>;
            })}
          </div>
          <div className="domain-note"><Sparkles size={15} /><p>Availability can change quickly. Confirm price and final availability with a registrar before making brand commitments.</p></div>
        </motion.section>}
      </AnimatePresence>

      {!results.length && !loading && <section className="domain-principles"><span className="kicker">A useful name is</span><div><article><strong>01</strong><h3>Speakable</h3><p>Easy to say once and type correctly.</p></article><article><strong>02</strong><h3>Ownable</h3><p>Distinct enough to hold a clear identity.</p></article><article><strong>03</strong><h3>Expandable</h3><p>Room for the product to become more.</p></article></div></section>}
    </main>
  );
}

export default DomainPage;
