import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowUpRight, CircleAlert, ExternalLink, FileSpreadsheet, Link2, LoaderCircle, Plus, RefreshCw, Rows3, Save, Table2, X } from "lucide-react";

type Cell = string | number | boolean;
type RecentSheet = { id: string; label: string };
type SheetData = { spreadsheetId: string; range: string; values: Cell[][]; url: string };

const DEFAULT_RANGE = "Sheet1!A1:L24";

function columnName(index: number) {
  let value = index + 1;
  let name = "";
  while (value > 0) { value -= 1; name = String.fromCharCode(65 + (value % 26)) + name; value = Math.floor(value / 26); }
  return name;
}

function readRecents(): RecentSheet[] {
  try { return JSON.parse(localStorage.getItem("signal-atlas-sheets") || "[]").slice(0, 6); } catch { return []; }
}

export default function SheetsPage() {
  const [source, setSource] = useState("");
  const [range, setRange] = useState(DEFAULT_RANGE);
  const [sheet, setSheet] = useState<SheetData | null>(null);
  const [values, setValues] = useState<Cell[][]>([]);
  const [recents, setRecents] = useState<RecentSheet[]>(readRecents);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [appendOpen, setAppendOpen] = useState(false);

  const rowCount = Math.max(20, values.length);
  const columnCount = Math.min(16, Math.max(10, ...values.map((row) => row.length), 0));
  const grid = useMemo(() => Array.from({ length: rowCount }, (_, row) => Array.from({ length: columnCount }, (_, column) => values[row]?.[column] ?? "")), [values, rowCount, columnCount]);

  useEffect(() => {
    localStorage.setItem("signal-atlas-sheets", JSON.stringify(recents));
  }, [recents]);

  async function openSheet(event?: FormEvent, directId?: string, label?: string) {
    event?.preventDefault();
    const nextSource = directId || source;
    if (!nextSource.trim() || loading) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/sheets/open", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ spreadsheetId: nextSource, range }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not open spreadsheet.");
      setSheet(body);
      setValues(body.values || []);
      setSource(body.spreadsheetId);
      setDirty(false);
      setRecents((current) => [{ id: body.spreadsheetId, label: label || body.spreadsheetId.slice(0, 12) }, ...current.filter((item) => item.id !== body.spreadsheetId)].slice(0, 6));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not open spreadsheet.");
    } finally {
      setLoading(false);
    }
  }

  function updateCell(row: number, column: number, value: string) {
    setValues((current) => {
      const next = current.map((item) => [...item]);
      while (next.length <= row) next.push([]);
      while (next[row].length <= column) next[row].push("");
      next[row][column] = value;
      return next;
    });
    setDirty(true);
  }

  async function saveValues() {
    if (!sheet || saving) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/sheets/values", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ spreadsheetId: sheet.spreadsheetId, range, values: grid }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not save spreadsheet.");
      setDirty(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save spreadsheet.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="sheets-main" id="top">
      <section className="sheets-heading">
        <div><span className="kicker">Connected spreadsheet workspace</span><h1>Make the grid<br /><em>work for you.</em></h1></div>
        <div><p>Open a Google Sheet by URL or ID, inspect any A1 range, edit cells, append rows, and create a fresh ledger.</p><button onClick={() => setCreateOpen(true)}><Plus size={16} />New spreadsheet</button></div>
      </section>

      <section className="sheets-connect">
        <form onSubmit={openSheet}><Link2 size={18} /><input value={source} onChange={(event) => setSource(event.target.value)} placeholder="Paste a Google Sheets URL or spreadsheet ID" aria-label="Spreadsheet URL or ID" /><label><span>Range</span><input value={range} onChange={(event) => setRange(event.target.value)} aria-label="A1 range" /></label><button type="submit" disabled={loading || !source.trim()}>{loading ? <LoaderCircle size={17} /> : <ArrowUpRight size={17} />}<span>{loading ? "Opening…" : "Open sheet"}</span></button></form>
        {recents.length > 0 && <div className="sheets-recents"><span>Recent ledgers</span>{recents.map((item) => <button key={item.id} onClick={() => openSheet(undefined, item.id, item.label)}>{item.label}</button>)}</div>}
        {error && <div className="sheets-error"><CircleAlert size={16} />{error}</div>}
      </section>

      {sheet ? (
        <section className="sheet-workspace">
          <header><div><span className="kicker">Live range / {range}</span><h2>{sheet.spreadsheetId.slice(0, 16)}…</h2></div><div className="sheet-actions"><span className={dirty ? "dirty" : ""}>{dirty ? "Unsaved changes" : "In sync"}</span><button onClick={() => openSheet(undefined, sheet.spreadsheetId)} aria-label="Refresh range"><RefreshCw size={16} /></button><button onClick={() => setAppendOpen(true)}><Rows3 size={16} />Append row</button><button className="sheet-save" onClick={saveValues} disabled={!dirty || saving}><Save size={16} />{saving ? "Saving…" : "Save range"}</button><a href={sheet.url} target="_blank" rel="noreferrer" aria-label="Open in Google Sheets"><ExternalLink size={16} /></a></div></header>
          <div className="sheet-grid-shell"><table><thead><tr><th className="sheet-corner"><Table2 size={13} /></th>{Array.from({ length: columnCount }, (_, index) => <th key={index}>{columnName(index)}</th>)}</tr></thead><tbody>{grid.map((row, rowIndex) => <tr key={rowIndex}><th>{rowIndex + 1}</th>{row.map((cell, columnIndex) => <td key={columnIndex}><input value={String(cell)} onChange={(event) => updateCell(rowIndex, columnIndex, event.target.value)} aria-label={`Cell ${columnName(columnIndex)}${rowIndex + 1}`} /></td>)}</tr>)}</tbody></table></div>
          <footer><span><FileSpreadsheet size={14} />Connected through Google Sheets</span><span>{rowCount} rows · {columnCount} columns shown</span></footer>
        </section>
      ) : <section className="sheets-empty"><div className="sheet-stack" aria-hidden="true"><span /><span /><FileSpreadsheet size={33} /></div><div><span className="kicker">Awaiting a ledger</span><h2>Every useful system<br />starts with one cell.</h2><p>Connect an existing spreadsheet above, or create a blank one and begin shaping the data.</p></div></section>}

      {createOpen && <CreateSheet onClose={() => setCreateOpen(false)} onCreated={(created) => { setCreateOpen(false); setSource(created.spreadsheetId); setRecents((current) => [{ id: created.spreadsheetId, label: created.title }, ...current].slice(0, 6)); openSheet(undefined, created.spreadsheetId, created.title); }} />}
      {appendOpen && sheet && <AppendRow columnCount={columnCount} onClose={() => setAppendOpen(false)} onAppend={async (row) => { const response = await fetch("/api/sheets/append", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ spreadsheetId: sheet.spreadsheetId, range, row }) }); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || "Could not append row."); setAppendOpen(false); await openSheet(undefined, sheet.spreadsheetId); }} />}
    </main>
  );
}

function CreateSheet({ onClose, onCreated }: { onClose: () => void; onCreated: (sheet: { spreadsheetId: string; title: string }) => void }) {
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function create(event: FormEvent) { event.preventDefault(); setLoading(true); setError(""); try { const response = await fetch("/api/sheets/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }) }); const body = await response.json(); if (!response.ok) throw new Error(body.error || "Could not create spreadsheet."); onCreated(body); } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create spreadsheet."); } finally { setLoading(false); } }
  return <div className="sheet-modal-backdrop"><form className="sheet-modal" onSubmit={create}><header><div><span className="kicker">New ledger</span><h2>Create a spreadsheet</h2></div><button type="button" onClick={onClose}><X size={18} /></button></header><label><span>Spreadsheet title</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Quarterly signal tracker" required autoFocus /></label>{error && <div className="sheets-error"><CircleAlert size={15} />{error}</div>}<footer><span>A Sheet1 tab and frozen header row will be created.</span><button disabled={loading || !title.trim()}>{loading ? <LoaderCircle size={16} /> : <Plus size={16} />}{loading ? "Creating…" : "Create sheet"}</button></footer></form></div>;
}

function AppendRow({ columnCount, onClose, onAppend }: { columnCount: number; onClose: () => void; onAppend: (row: string[]) => Promise<void> }) {
  const [row, setRow] = useState<string[]>(Array.from({ length: Math.min(columnCount, 10) }, () => ""));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function append(event: FormEvent) { event.preventDefault(); setLoading(true); setError(""); try { await onAppend(row); } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not append row."); setLoading(false); } }
  return <div className="sheet-modal-backdrop"><form className="sheet-modal sheet-modal--row" onSubmit={append}><header><div><span className="kicker">Append operation</span><h2>Add the next row</h2></div><button type="button" onClick={onClose}><X size={18} /></button></header><div className="append-fields">{row.map((cell, index) => <label key={index}><span>{columnName(index)}</span><input value={cell} onChange={(event) => setRow((current) => current.map((item, cellIndex) => cellIndex === index ? event.target.value : item))} /></label>)}</div>{error && <div className="sheets-error"><CircleAlert size={15} />{error}</div>}<footer><span>Values use Google Sheets formula parsing.</span><button disabled={loading || !row.some(Boolean)}>{loading ? <LoaderCircle size={16} /> : <Rows3 size={16} />}{loading ? "Appending…" : "Append row"}</button></footer></form></div>;
}
