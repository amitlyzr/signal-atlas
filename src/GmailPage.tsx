import { FormEvent, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Archive, ArrowUpRight, CircleAlert, FileText, Inbox, LoaderCircle, Mail, PenLine, RefreshCw, Reply, Search, Send, Star, X } from "lucide-react";

type Message = {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  snippet: string;
  labels: string[];
  unread: boolean;
  starred: boolean;
  important: boolean;
  body?: string;
};

type Mailbox = "INBOX" | "STARRED" | "SENT" | "DRAFT" | "ALL";

const mailboxes: { id: Mailbox; label: string; icon: typeof Inbox }[] = [
  { id: "INBOX", label: "Inbox", icon: Inbox },
  { id: "STARRED", label: "Starred", icon: Star },
  { id: "SENT", label: "Sent", icon: Send },
  { id: "DRAFT", label: "Drafts", icon: FileText },
  { id: "ALL", label: "All mail", icon: Archive },
];

function senderName(value: string) {
  const named = value.match(/^\s*"?([^"<]+)"?\s*</)?.[1]?.trim();
  return named || value.split("@")[0].replace(/[._-]+/g, " ");
}

function senderEmail(value: string) {
  return value.match(/<([^>]+)>/)?.[1] || value;
}

function initials(value: string) {
  return senderName(value).split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "M";
}

function messageDate(value: string, long = false) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  if (!long && sameDay) return new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(date);
  return new Intl.DateTimeFormat("en", long ? { weekday: "short", day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit" } : { day: "numeric", month: "short" }).format(date);
}

export default function GmailPage() {
  const [mailbox, setMailbox] = useState<Mailbox>("INBOX");
  const [messages, setMessages] = useState<Message[]>([]);
  const [selected, setSelected] = useState<Message | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState("");
  const [compose, setCompose] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch(`/api/gmail/messages?mailbox=${mailbox}&q=${encodeURIComponent(query)}`, { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Could not load Gmail.");
        setMessages(body.messages || []);
        setSelected(null);
      })
      .catch((cause) => {
        if (cause?.name !== "AbortError") setError(cause instanceof Error ? cause.message : "Could not load Gmail.");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [mailbox, refreshKey]);

  const unreadCount = useMemo(() => messages.filter((message) => message.unread).length, [messages]);

  async function runSearch(event: FormEvent) {
    event.preventDefault();
    setRefreshKey((key) => key + 1);
  }

  async function openMessage(message: Message) {
    setOpening(true);
    setError("");
    try {
      const response = await fetch(`/api/gmail/messages/${message.id}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not open this message.");
      setSelected(body.message);
      if (message.unread) {
        setMessages((current) => current.map((item) => item.id === message.id ? { ...item, unread: false } : item));
        fetch(`/api/gmail/messages/${message.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ read: true }) }).catch(() => {});
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not open this message.");
    } finally {
      setOpening(false);
    }
  }

  async function toggleStar(message: Message) {
    const next = !message.starred;
    setMessages((current) => current.map((item) => item.id === message.id ? { ...item, starred: next } : item));
    if (selected?.id === message.id) setSelected({ ...selected, starred: next });
    try {
      const response = await fetch(`/api/gmail/messages/${message.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ starred: next }) });
      if (!response.ok) throw new Error("Could not update star.");
    } catch {
      setMessages((current) => current.map((item) => item.id === message.id ? { ...item, starred: !next } : item));
    }
  }

  function switchMailbox(next: Mailbox) {
    setMailbox(next);
    setQuery("");
  }

  return (
    <main className="gmail-main" id="top">
      <section className="gmail-heading">
        <div><span className="kicker">Connected correspondence</span><h1>Your mail,<br /><em>with room to think.</em></h1></div>
        <div className="gmail-heading-meta"><p>A focused reading desk for your live Gmail account—search, read, star, and send without the noise.</p><div><span className="gmail-status-dot" /> Gmail connected</div></div>
      </section>

      <section className="gmail-desk">
        <aside className="gmail-rail">
          <button className="gmail-compose-button" onClick={() => setCompose(true)}><PenLine size={17} /><span>Compose</span><ArrowUpRight size={16} /></button>
          <nav aria-label="Mailboxes">
            {mailboxes.map((item) => {
              const Icon = item.icon;
              return <button className={mailbox === item.id ? "active" : ""} onClick={() => switchMailbox(item.id)} key={item.id}><Icon size={16} /><span>{item.label}</span>{item.id === "INBOX" && unreadCount > 0 && <strong>{unreadCount}</strong>}</button>;
            })}
          </nav>
          <div className="gmail-rail-note"><Mail size={16} /><span>Live from your connected Google account</span></div>
        </aside>

        <div className="gmail-list-pane">
          <header>
            <div><span className="kicker">Mailbox / {mailbox.toLowerCase()}</span><h2>{mailboxes.find((item) => item.id === mailbox)?.label}</h2></div>
            <button className="gmail-refresh" onClick={() => setRefreshKey((key) => key + 1)} aria-label="Refresh inbox"><RefreshCw size={16} className={loading ? "gmail-spinning" : ""} /></button>
          </header>
          <form className="gmail-search" onSubmit={runSearch}><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search mail…" aria-label="Search mail" />{query && <button type="button" onClick={() => { setQuery(""); setRefreshKey((key) => key + 1); }} aria-label="Clear search"><X size={15} /></button>}</form>

          {error && <div className="gmail-error"><CircleAlert size={16} />{error}</div>}
          {loading ? <div className="gmail-loading"><LoaderCircle size={20} />Fetching correspondence…</div> : messages.length ? (
            <div className="gmail-message-list">
              {messages.map((message, index) => (
                <motion.article className={`${message.unread ? "unread" : ""} ${selected?.id === message.id ? "selected" : ""}`} key={message.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * .025, .2) }}>
                  <button className="gmail-message-open" onClick={() => openMessage(message)}>
                    <span className="gmail-avatar">{initials(message.from)}</span>
                    <span className="gmail-message-copy"><span><strong>{senderName(message.from)}</strong><time>{messageDate(message.date)}</time></span><b>{message.subject}</b><small>{message.snippet || "No preview available"}</small></span>
                    {message.unread && <i aria-label="Unread" />}
                  </button>
                  <button className={`gmail-star ${message.starred ? "active" : ""}`} onClick={() => toggleStar(message)} aria-label={message.starred ? "Remove star" : "Add star"}><Star size={15} fill={message.starred ? "currentColor" : "none"} /></button>
                </motion.article>
              ))}
            </div>
          ) : <div className="gmail-empty"><Mail size={24} /><h3>No correspondence here</h3><p>Try another mailbox or a broader search.</p></div>}
        </div>

        <aside className={`gmail-reader ${selected ? "gmail-reader--open" : ""}`}>
          {opening ? <div className="gmail-loading"><LoaderCircle size={20} />Opening message…</div> : selected ? <MessageReader message={selected} onClose={() => setSelected(null)} onReply={() => setCompose(true)} onStar={() => toggleStar(selected)} /> : <div className="gmail-reader-empty"><div><Mail size={28} /></div><span className="kicker">Reading pane</span><h2>Select a message<br />to open the letter.</h2><p>Your mail stays uncluttered until you’re ready to read.</p></div>}
        </aside>
      </section>

      <AnimatePresence>{compose && <ComposeSheet initialRecipient={selected ? senderEmail(selected.from) : ""} initialSubject={selected ? `Re: ${selected.subject}` : ""} onClose={() => setCompose(false)} onSent={() => { setCompose(false); if (mailbox === "SENT") setRefreshKey((key) => key + 1); }} />}</AnimatePresence>
    </main>
  );
}

function MessageReader({ message, onClose, onReply, onStar }: { message: Message; onClose: () => void; onReply: () => void; onStar: () => void }) {
  return <div className="gmail-reader-content"><header><button className="gmail-reader-close" onClick={onClose} aria-label="Close message"><X size={17} /></button><button className={message.starred ? "active" : ""} onClick={onStar} aria-label="Toggle star"><Star size={16} fill={message.starred ? "currentColor" : "none"} /></button></header><div className="gmail-reader-subject"><span className="kicker">Received correspondence</span><h2>{message.subject}</h2></div><div className="gmail-reader-sender"><span className="gmail-avatar gmail-avatar--large">{initials(message.from)}</span><div><strong>{senderName(message.from)}</strong><span>{senderEmail(message.from)}</span><small>to {message.to || "me"}</small></div><time>{messageDate(message.date, true)}</time></div><div className="gmail-reader-body">{message.body || message.snippet || "This message has no readable text body."}</div><footer><button onClick={onReply}><Reply size={16} />Reply</button><span>Thread / {message.threadId.slice(-8)}</span></footer></div>;
}

function ComposeSheet({ initialRecipient, initialSubject, onClose, onSent }: { initialRecipient: string; initialSubject: string; onClose: () => void; onSent: () => void }) {
  const [recipient, setRecipient] = useState(initialRecipient);
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function send(event: FormEvent) {
    event.preventDefault();
    if (sending) return;
    setSending(true);
    setError("");
    try {
      const response = await fetch("/api/gmail/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recipient, subject, body }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not send email.");
      onSent();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not send email.");
    } finally {
      setSending(false);
    }
  }

  return <motion.div className="gmail-compose-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><motion.form className="gmail-compose" onSubmit={send} initial={{ x: 35 }} animate={{ x: 0 }} exit={{ x: 35 }}><header><div><span className="kicker">New correspondence</span><h2>Write a message</h2></div><button type="button" onClick={onClose} aria-label="Close composer"><X size={18} /></button></header><label><span>To</span><input type="email" value={recipient} onChange={(event) => setRecipient(event.target.value)} placeholder="recipient@example.com" required autoFocus /></label><label><span>Subject</span><input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="What is this about?" /></label><label className="gmail-compose-body"><span>Message</span><textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="Write with intention…" required /></label>{error && <div className="gmail-error"><CircleAlert size={15} />{error}</div>}<footer><span>Sent through your connected Gmail account</span><button type="submit" disabled={sending || !recipient.includes("@") || !body.trim()}>{sending ? <LoaderCircle size={17} /> : <Send size={16} />}<b>{sending ? "Sending…" : "Send message"}</b></button></footer></motion.form></motion.div>;
}
