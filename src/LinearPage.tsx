import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, CalendarClock, CircleAlert, ExternalLink, FolderKanban, GripVertical, Plus, RefreshCw, Signal, X } from "lucide-react";

type Status = { id: string; name: string; type: string };
type Team = { id: string; name: string; key?: string };
type Issue = { id: string; title: string; description?: string; priority?: number | { value?: number; name?: string }; url?: string; dueDate?: string; status?: string | { id?: string; name?: string; type?: string }; statusType?: string; labels?: Array<string | { name?: string }>; project?: string | { id?: string; name?: string } };
type Project = { id: string; name: string; summary?: string; url?: string; status?: string | { name?: string; type?: string }; targetDate?: string; priority?: number };
type Board = { user?: { displayName?: string; name?: string }; team?: Team; teams: Team[]; statuses: Status[]; issues: Issue[]; projects: Project[] };

const priorityLabel: Record<number, string> = { 0: "No priority", 1: "Urgent", 2: "High", 3: "Medium", 4: "Low" };
const statusOrder: Record<string, number> = { backlog: 0, unstarted: 1, started: 2, completed: 3, canceled: 4, duplicate: 5 };

function statusName(issue: Issue) {
  return typeof issue.status === "string" ? issue.status : issue.status?.name || issue.statusType || "Unsorted";
}

function projectName(issue: Issue) {
  return typeof issue.project === "string" ? issue.project : issue.project?.name || "";
}

function issuePriority(issue: Issue) {
  return typeof issue.priority === "number" ? issue.priority : issue.priority?.value || 0;
}

function cleanDescription(description = "") {
  const beforeEmbed = description.split("<linear-")[0];
  return (beforeEmbed || description).replace(/https?:\/\/\S+/g, " ").replace(/[#*_`<>\[\]()]/g, " ").replace(/\s+/g, " ").trim();
}

function LinearPage() {
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [composer, setComposer] = useState<"task" | "project" | null>(null);
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);

  const loadBoard = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/linear/board");
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Linear board could not be loaded.");
      setBoard(body);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Linear board could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadBoard(); }, [loadBoard]);

  const statuses = useMemo(() => [...(board?.statuses || [])].sort((a, b) => (statusOrder[a.type] ?? 9) - (statusOrder[b.type] ?? 9)), [board]);

  async function moveIssue(issueId: string, state: string) {
    setDragging(null);
    const current = board;
    if (!current) return;
    const previous = current.issues;
    setBoard({ ...current, issues: current.issues.map((issue) => issue.id === issueId ? { ...issue, status: state } : issue) });
    const response = await fetch(`/api/linear/issues/${encodeURIComponent(issueId)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ state }) });
    if (!response.ok) {
      setBoard({ ...current, issues: previous });
      setError((await response.json()).error || "Could not move the task.");
    } else {
      await loadBoard();
    }
  }

  const issueCount = board?.issues.length || 0;
  const activeCount = board?.issues.filter((issue) => !["completed", "canceled", "duplicate"].includes(issue.statusType || "")).length || 0;

  return (
    <main className="linear-main">
      <section className="linear-heading">
        <div><span className="kicker">Linear workbench</span><h1>Work, in<br /><em>motion.</em></h1></div>
        <div className="linear-heading-meta"><p>Tasks and projects side by side, connected directly to your Linear workspace.</p><div><button onClick={() => setComposer("project")}><FolderKanban size={16} />New project</button><button className="primary-action" onClick={() => setComposer("task")}><Plus size={16} />New task</button></div></div>
      </section>

      <section className="linear-toolbar">
        <div className="workspace-identity"><span className="live-dot" /><div><small>Active workspace</small><strong>{board?.team?.name || "Connecting to Linear"}</strong></div></div>
        <div className="linear-stats"><span><strong>{issueCount.toString().padStart(2, "0")}</strong>issues</span><span><strong>{activeCount.toString().padStart(2, "0")}</strong>active</span><span><strong>{(board?.projects.length || 0).toString().padStart(2, "0")}</strong>projects</span></div>
        <button className="refresh-board" onClick={loadBoard} disabled={loading}><RefreshCw size={15} className={loading ? "spinning" : ""} />Refresh</button>
      </section>

      {error && <div className="linear-error"><CircleAlert size={18} /><span>{error}</span></div>}

      <section className="linear-workspace">
        <aside className="project-rail">
          <div className="rail-title"><span>Projects</span><small>{board?.projects.length || 0}</small></div>
          {board?.projects.length ? board.projects.map((project) => <a className="project-card" href={project.url} target="_blank" rel="noreferrer" key={project.id}><div className="project-icon"><FolderKanban size={17} /></div><div><span>{typeof project.status === "string" ? project.status : project.status?.name || "Project"}</span><h3>{project.name}</h3><p>{project.summary || "No summary yet."}</p>{project.targetDate && <small><CalendarClock size={12} />Due {project.targetDate}</small>}</div><ExternalLink size={13} /></a>) : <div className="rail-empty"><FolderKanban size={21} /><strong>No projects yet</strong><p>Create the first container for this team’s work.</p><button onClick={() => setComposer("project")}><Plus size={13} />Create project</button></div>}
        </aside>

        <div className="kanban-shell">
          {loading && !board ? <div className="board-loading"><Signal size={21} /><span>Reading your Linear workspace…</span></div> : (
            <div className="kanban-board">
              {statuses.map((status) => {
                const issues = board?.issues.filter((issue) => statusName(issue) === status.name || issue.statusType === status.type) || [];
                return <section className="kanban-column" key={status.id} onDragOver={(event) => event.preventDefault()} onDrop={() => dragging && void moveIssue(dragging, status.name)}>
                  <header><div><i data-type={status.type} /><strong>{status.name}</strong></div><span>{issues.length.toString().padStart(2, "0")}</span></header>
                  <div className={`kanban-stack ${dragging ? "kanban-stack--target" : ""}`}>
                    {issues.map((issue) => <article className="issue-card" draggable onDragStart={() => setDragging(issue.id)} onDragEnd={() => setDragging(null)} key={issue.id}>
                      <div className="issue-card-top"><span>{issue.id}</span><GripVertical size={14} /></div>
                      <h3>{issue.title}</h3>
                      {issue.description && <p>{cleanDescription(issue.description)}</p>}
                      <div className="issue-meta"><span data-priority={issuePriority(issue)}>{typeof issue.priority === "object" && issue.priority?.name ? issue.priority.name : priorityLabel[issuePriority(issue)]}</span>{projectName(issue) && <span>{projectName(issue)}</span>}</div>
                      <footer>{issue.dueDate ? <span><CalendarClock size={12} />{issue.dueDate}</span> : <span>No due date</span>}{issue.url && <a href={issue.url} target="_blank" rel="noreferrer" aria-label={`Open ${issue.id} in Linear`}><ArrowUpRight size={14} /></a>}</footer>
                    </article>)}
                    {!issues.length && <button className="empty-column" onClick={() => setComposer("task")}><Plus size={14} /><span>Add a task to {status.name}</span></button>}
                  </div>
                </section>;
              })}
            </div>
          )}
        </div>
      </section>

      <AnimatePresence>
        {composer && <Composer type={composer} board={board} statuses={statuses} saving={saving} onClose={() => setComposer(null)} onSave={async (payload) => {
          setSaving(true);
          setError("");
          try {
            const endpoint = composer === "task" ? "/api/linear/issues" : "/api/linear/projects";
            const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
            const body = await response.json();
            if (!response.ok) throw new Error(body.error || `Could not create the ${composer}.`);
            setComposer(null);
            await loadBoard();
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : `Could not create the ${composer}.`);
          } finally { setSaving(false); }
        }} />}
      </AnimatePresence>
    </main>
  );
}

function Composer({ type, board, statuses, saving, onClose, onSave }: { type: "task" | "project"; board: Board | null; statuses: Status[]; saving: boolean; onClose: () => void; onSave: (payload: Record<string, unknown>) => Promise<void> }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [state, setState] = useState(statuses.find((status) => status.type === "unstarted")?.name || statuses[0]?.name || "Todo");
  const [priority, setPriority] = useState(0);
  const [project, setProject] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    const team = board?.team?.id;
    if (type === "task") void onSave({ title, description, state, priority, project: project || undefined, team });
    else void onSave({ name: title, summary: description, team });
  }

  return <motion.div className="linear-composer-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={onClose}><motion.form className="linear-composer" initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 24, opacity: 0 }} onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
    <header><div><span className="kicker">New {type}</span><h2>{type === "task" ? "What needs moving?" : "Make a home for the work."}</h2></div><button type="button" onClick={onClose}><X /></button></header>
    <label><span>{type === "task" ? "Task title" : "Project name"}</span><input required autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder={type === "task" ? "Write the next concrete outcome" : "Name the initiative"} /></label>
    <label><span>{type === "task" ? "Description" : "Summary"}</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Add useful context" /></label>
    {type === "task" && <div className="linear-form-grid"><label><span>Status</span><select value={state} onChange={(event) => setState(event.target.value)}>{statuses.map((status) => <option value={status.name} key={status.id}>{status.name}</option>)}</select></label><label><span>Priority</span><select value={priority} onChange={(event) => setPriority(Number(event.target.value))}>{Object.entries(priorityLabel).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label><span>Project</span><select value={project} onChange={(event) => setProject(event.target.value)}><option value="">No project</option>{board?.projects.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label></div>}
    <footer><span>Creates directly in {board?.team?.name || "Linear"}</span><button className="primary-action" disabled={saving}>{saving ? "Saving…" : `Create ${type}`}</button></footer>
  </motion.form></motion.div>;
}

export default LinearPage;
