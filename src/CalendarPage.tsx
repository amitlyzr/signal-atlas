import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, ChevronLeft, ChevronRight, CircleAlert, Clock3, MapPin, Plus, RotateCw, Trash2, X } from "lucide-react";
import { cachedRequest, cacheTime, queryClient, refreshRequest, requestJson } from "./query";

type CalendarEvent = {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
};

type Draft = { summary: string; date: string; startTime: string; endTime: string; location: string; description: string };

const formatter = new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric" });
const timeFormatter = new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" });

function localDate(date: Date) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function initialDraft(date = new Date()): Draft {
  const start = new Date(date);
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 1);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return {
    summary: "",
    date: localDate(start),
    startTime: start.toTimeString().slice(0, 5),
    endTime: end.toTimeString().slice(0, 5),
    location: "",
    description: "",
  };
}

function eventStart(event: CalendarEvent) {
  return new Date(event.start.dateTime || `${event.start.date}T00:00:00`);
}

function CalendarPage() {
  const [anchor, setAnchor] = useState(() => new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [account, setAccount] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => initialDraft());

  const range = useMemo(() => {
    const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1);
    return { start, end };
  }, [anchor]);

  const loadEvents = useCallback(async (force = false) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ from: range.start.toISOString(), to: range.end.toISOString() });
      const key = ["calendar", "events", params.toString()] as const;
      const url = `/api/calendar/events?${params}`;
      const body = force
        ? await refreshRequest<{ events: CalendarEvent[]; account?: string }>(key, url)
        : await cachedRequest<{ events: CalendarEvent[]; account?: string }>(key, url, undefined, cacheTime.workspace);
      setEvents(body.events || []);
      setAccount(body.account || "Google Calendar");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load your calendar.");
    } finally {
      setLoading(false);
    }
  }, [range.end, range.start]);

  useEffect(() => { void loadEvents(); }, [loadEvents]);

  const days = useMemo(() => {
    const result: Date[] = [];
    for (let day = new Date(range.start); day < range.end; day.setDate(day.getDate() + 1)) result.push(new Date(day));
    return result;
  }, [range.end, range.start]);

  const grouped = useMemo(() => {
    const groups = new Map<string, CalendarEvent[]>();
    events.forEach((event) => {
      const key = localDate(eventStart(event));
      groups.set(key, [...(groups.get(key) || []), event]);
    });
    return groups;
  }, [events]);

  async function createEvent(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const start = new Date(`${draft.date}T${draft.startTime}:00`);
      const end = new Date(`${draft.date}T${draft.endTime}:00`);
      if (end <= start) throw new Error("The end time must be after the start time.");
      await requestJson("/api/calendar/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: draft.summary,
          start: start.toISOString(),
          end: end.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          location: draft.location,
          description: draft.description,
        }),
      });
      await queryClient.invalidateQueries({ queryKey: ["calendar", "events"] });
      setComposerOpen(false);
      setDraft(initialDraft());
      await loadEvents(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create the event.");
    } finally {
      setSaving(false);
    }
  }

  async function removeEvent(id: string) {
    if (!window.confirm("Remove this event from Google Calendar?")) return;
    try {
      await requestJson(`/api/calendar/events/${encodeURIComponent(id)}`, { method: "DELETE" });
      setEvents((current) => current.filter((event) => event.id !== id));
      queryClient.setQueriesData<{ events: CalendarEvent[]; account?: string }>({ queryKey: ["calendar", "events"] }, (current) => current ? { ...current, events: current.events.filter((event) => event.id !== id) } : current);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not remove the event.");
    }
  }

  function openForDay(date: Date) {
    setDraft(initialDraft(date));
    setComposerOpen(true);
  }

  const monthTitle = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(anchor);
  const nextEvents = events.filter((event) => eventStart(event) >= new Date()).slice(0, 4);

  return (
    <main className="calendar-main">
      <section className="calendar-hero">
        <div><span className="kicker">Calendar desk</span><h1>Your time,<br /><em>made visible.</em></h1></div>
        <div className="calendar-hero-aside">
          <p>Read your schedule, make a new event, or clear what no longer belongs.</p>
          <button className="primary-action" onClick={() => setComposerOpen(true)}><Plus size={17} /><span>New event</span></button>
        </div>
      </section>

      {error && <div className="calendar-notice"><CircleAlert size={19} /><div><strong>{error}</strong><span>{error.includes("not connected") ? "Connect Google Calendar under Agent Tools, then refresh this page." : "The Calendar connector is present, but its provider did not complete this request."}</span></div><button onClick={() => loadEvents(true)}><RotateCw size={15} /> Retry</button></div>}

      <section className="calendar-workspace">
        <aside className="calendar-brief">
          <div className="month-controls"><button onClick={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1))} aria-label="Previous month"><ChevronLeft /></button><strong>{monthTitle}</strong><button onClick={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1))} aria-label="Next month"><ChevronRight /></button></div>
          <div className="brief-stat"><strong>{events.length.toString().padStart(2, "0")}</strong><span>events this month</span></div>
          <div className="account-label"><span className="live-dot" /><div><small>Connected calendar</small><strong>{account || "Awaiting connection"}</strong></div></div>
          <div className="next-up"><span className="kicker">Next up</span>{nextEvents.length ? nextEvents.map((event) => <a href={event.htmlLink} target="_blank" rel="noreferrer" key={event.id}><time>{timeFormatter.format(eventStart(event))}</time><strong>{event.summary || "Untitled event"}</strong></a>) : <p>{loading ? "Reading your calendar…" : "No upcoming events in view."}</p>}</div>
        </aside>

        <div className="month-sheet">
          <div className="weekday-row">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <span key={day}>{day}</span>)}</div>
          <div className="calendar-grid" style={{ "--leading-days": (range.start.getDay() + 6) % 7 } as React.CSSProperties}>
            {days.map((day, index) => {
              const key = localDate(day);
              const dayEvents = grouped.get(key) || [];
              const isToday = key === localDate(new Date());
              return <button className={`day-cell ${isToday ? "day-cell--today" : ""}`} key={key} style={index === 0 ? { gridColumnStart: `calc(var(--leading-days) + 1)` } : undefined} onDoubleClick={() => openForDay(day)} onClick={() => dayEvents.length === 0 && openForDay(day)}>
                <span className="day-number">{day.getDate()}</span>
                <div>{dayEvents.slice(0, 3).map((event) => <span className="event-chip" key={event.id}><i />{event.summary || "Untitled"}</span>)}{dayEvents.length > 3 && <small>+{dayEvents.length - 3} more</small>}</div>
              </button>;
            })}
          </div>
        </div>
      </section>

      <AnimatePresence>
        {composerOpen && <motion.div className="composer-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={() => setComposerOpen(false)}>
          <motion.form className="event-composer" initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 40, opacity: 0 }} onSubmit={createEvent} onMouseDown={(event) => event.stopPropagation()}>
            <header><div><span className="kicker">New calendar entry</span><h2>Make room for it.</h2></div><button type="button" onClick={() => setComposerOpen(false)} aria-label="Close"><X /></button></header>
            <label><span>Event title</span><input required autoFocus value={draft.summary} onChange={(event) => setDraft({ ...draft, summary: event.target.value })} placeholder="What is happening?" /></label>
            <div className="form-row"><label><span>Date</span><input type="date" required value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} /></label><label><span>Starts</span><input type="time" required value={draft.startTime} onChange={(event) => setDraft({ ...draft, startTime: event.target.value })} /></label><label><span>Ends</span><input type="time" required value={draft.endTime} onChange={(event) => setDraft({ ...draft, endTime: event.target.value })} /></label></div>
            <label><span>Location</span><div className="input-icon"><MapPin size={16} /><input value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value })} placeholder="Optional" /></div></label>
            <label><span>Notes</span><textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="Context, links, or preparation notes" /></label>
            <footer><span><Clock3 size={14} /> Times use {Intl.DateTimeFormat().resolvedOptions().timeZone}</span><button className="primary-action" disabled={saving}>{saving ? "Saving…" : "Create event"}</button></footer>
          </motion.form>
        </motion.div>}
      </AnimatePresence>
    </main>
  );
}

export default CalendarPage;
