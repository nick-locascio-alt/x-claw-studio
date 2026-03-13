"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import type { DesiredReplyMediaWishlistEntry } from "@/src/lib/reply-composer";
import type { MemeTemplateImportProgressEvent } from "@/src/lib/meme-template";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date(value));
}

type ImportLogEvent = MemeTemplateImportProgressEvent & {
  receivedAt: string;
};

export function ReplyMediaWishlist(props: {
  entries: DesiredReplyMediaWishlistEntry[];
}) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<DesiredReplyMediaWishlistEntry["status"] | "all">("pending");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [activeImportKey, setActiveImportKey] = useState<string | null>(null);
  const [importEvents, setImportEvents] = useState<ImportLogEvent[]>([]);
  const [importError, setImportError] = useState<string | null>(null);

  const filteredEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return props.entries.filter((entry) => {
      if (statusFilter !== "all" && entry.status !== statusFilter) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return [entry.label, entry.angles.join(" "), entry.exampleTweetTexts.join(" "), entry.goals.join(" ")]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [props.entries, query, statusFilter]);

  async function setStatus(key: string, status: DesiredReplyMediaWishlistEntry["status"]): Promise<void> {
    setMessage(null);
    const response = await fetch("/api/reply-media-wishlist/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, status })
    });
    const body = await response.json();

    if (!response.ok) {
      setMessage(body.error || "Failed to update wishlist status");
      return;
    }

    setMessage(`Marked ${body.key} as ${body.status}.`);
    router.refresh();
  }

  async function importFromMemingWorld(key: string): Promise<void> {
    setMessage(null);
    setImportError(null);
    setActiveImportKey(key);
    setImportEvents([
      {
        stage: "starting",
        message: "Starting asset lookup",
        detail: key,
        key,
        receivedAt: new Date().toISOString()
      }
    ]);
    const response = await fetch("/api/reply-media-wishlist/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key })
    });

    if (!response.ok) {
      const body = await response.json();
      setMessage(body.error || "Failed to import meme template");
      setImportError(body.error || "Failed to import meme template");
      setActiveImportKey(null);
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      setMessage("Import stream was unavailable");
      setImportError("Import stream was unavailable");
      setActiveImportKey(null);
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";
    let importedTitle: string | null = null;
    let hadStreamError = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
          continue;
        }

        const event = JSON.parse(trimmed) as
          | ({ type: "progress" } & MemeTemplateImportProgressEvent)
          | { type: "result"; result: { key: string; title: string; pageUrl: string } }
          | { type: "error"; error: string };

        if (event.type === "progress") {
          setImportEvents((current) => [...current, { ...event, receivedAt: new Date().toISOString() }]);
          continue;
        }

        if (event.type === "result") {
          importedTitle = event.result.title;
          continue;
        }

        if (event.type === "error") {
          hadStreamError = true;
          setImportError(event.error);
          setMessage(event.error);
        }
      }
    }

    if (!hadStreamError) {
      setMessage(`Imported ${importedTitle ?? key} from meming.world.`);
    }
    setActiveImportKey(null);
    router.refresh();
  }

  const latestImportEvent = importEvents.at(-1) ?? null;

  return (
    <section className="relative z-10 mb-8 terminal-panel">
      <div className="panel-body">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="section-kicker">Reply Wishlist</div>
            <h2 className="section-title mt-3">Desired assets to go source</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
              Reply composition saves missing asset ideas here so you can build the local corpus deliberately. That can mean memes, real people, concepts, pop-culture scenes, historical moments, reaction images, or just a strong visual vibe. The agent tries meming.world first, then falls back to grounded web search if needed.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="tt-chip tt-chip-accent">
              {props.entries.filter((entry) => entry.status === "pending").length} pending
            </span>
            <span className="tt-chip">{props.entries.length} tracked</span>
          </div>
        </div>

        <div className="mb-5 grid gap-4 md:grid-cols-[0.8fr_0.4fr_auto]">
          <label className="tt-field">
            <span className="tt-field-label">Search</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="tt-input"
              placeholder="mask reveal, tim cook shrug, y2k newsroom, doomed optimism..."
            />
          </label>
          <label className="tt-field">
            <span className="tt-field-label">Status</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as never)} className="tt-select">
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="collected">Collected</option>
              <option value="dismissed">Dismissed</option>
            </select>
          </label>
          <div className="flex items-end">
            {importError ? <div className="tt-chip tt-chip-danger">{importError}</div> : null}
            {!importError && message ? <div className="tt-chip tt-chip-accent">{message}</div> : null}
          </div>
        </div>

        {activeImportKey ? (
          <div className="mb-5 terminal-window">
            <div className="window-bar">
              <div className="section-kicker">Import Running</div>
              <div className="tt-chip tt-chip-accent">{latestImportEvent?.stage ?? "starting"}</div>
            </div>
            <div className="panel-body grid gap-4 md:grid-cols-[0.7fr_1.3fr]">
              <div className="tt-subpanel-soft">
                <div className="tt-data-label">Current Step</div>
                <p className="mt-2 text-sm leading-6 text-slate-200">{latestImportEvent?.message ?? "Preparing import"}</p>
                {latestImportEvent?.detail ? (
                  <p className="mt-3 break-words font-[family:var(--font-mono)] text-xs uppercase tracking-[0.12em] text-cyan">
                    {latestImportEvent.detail}
                  </p>
                ) : null}
              </div>
              <div className="tt-subpanel-soft">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="tt-data-label">Job Log</div>
                  <div className="tt-chip tt-chip-accent">{importEvents.length} events</div>
                </div>
                <div className="max-h-[28rem] overflow-y-auto border border-cyan/20 bg-black/40 p-3 font-[family:var(--font-mono)] text-xs leading-6 text-slate-200">
                  {importEvents.map((event, index) => (
                    <div key={`${event.stage}-${event.receivedAt}-${index}`} className="border-b border-cyan/10 py-1 last:border-b-0">
                      <span className="text-cyan">{formatTime(event.receivedAt)}</span>
                      <span className="mx-2 text-slate-500">|</span>
                      <span className="uppercase tracking-[0.12em] text-slate-400">{event.stage}</span>
                      <span className="mx-2 text-slate-500">|</span>
                      <span>{event.message}</span>
                      {event.detail ? <span className="text-slate-400"> :: {event.detail}</span> : null}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          {filteredEntries.length === 0 ? (
            <article className="neon-card lg:col-span-2">
              <div className="tt-placeholder">No wishlist entries match the current filter.</div>
            </article>
          ) : (
            filteredEntries.map((entry) => (
              <article key={entry.key} className="neon-card">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="section-kicker">Wanted Asset</div>
                    <h3 className="mt-2 font-[family:var(--font-heading)] text-xl font-black uppercase tracking-[0.08em] text-cyan">
                      {entry.label}
                    </h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className={`tt-chip ${entry.status === "pending" ? "tt-chip-accent" : ""}`}>{entry.status}</span>
                    <span className="tt-chip">{entry.occurrenceCount} mentions</span>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="tt-subpanel-soft">
                    <div className="tt-data-label">Angles</div>
                    <div className="mt-2 grid gap-2">
                      {entry.angles.slice(0, 3).map((angle) => (
                        <p key={angle} className="text-sm leading-6 text-slate-200">
                          {angle}
                        </p>
                      ))}
                    </div>
                  </div>
                  <div className="tt-subpanel-soft">
                    <div className="tt-data-label">Goals</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {entry.goals.map((goal) => (
                        <span key={goal} className="tt-chip">
                          {goal}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-4 tt-subpanel-soft">
                  <div className="tt-data-label">Example Tweets</div>
                  <div className="mt-2 grid gap-2">
                    {entry.exampleTweetTexts.slice(0, 2).map((text) => (
                      <p key={text} className="text-sm leading-6 text-slate-200">
                        {text}
                      </p>
                    ))}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {entry.usageIds.slice(0, 3).map((usageId) => (
                    <Link key={usageId} href={`/usage/${usageId}`} className="tt-link">
                      <span>{usageId}</span>
                    </Link>
                  ))}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="tt-button"
                    disabled={isPending || activeImportKey !== null}
                    onClick={() => startTransition(() => void importFromMemingWorld(entry.key))}
                  >
                    <span>{activeImportKey === entry.key ? "Finding asset..." : "Find asset with agent"}</span>
                  </button>
                  <button
                    type="button"
                    className="tt-link"
                    disabled={isPending || activeImportKey !== null}
                    onClick={() => startTransition(() => void setStatus(entry.key, "collected"))}
                  >
                    <span>Mark collected</span>
                  </button>
                  <button
                    type="button"
                    className="tt-link"
                    disabled={isPending || activeImportKey !== null}
                    onClick={() => startTransition(() => void setStatus(entry.key, "pending"))}
                  >
                    <span>Set pending</span>
                  </button>
                  <button
                    type="button"
                    className="tt-link"
                    disabled={isPending || activeImportKey !== null}
                    onClick={() => startTransition(() => void setStatus(entry.key, "dismissed"))}
                  >
                    <span>Dismiss</span>
                  </button>
                </div>

                <div className="mt-4 flex flex-wrap gap-4 text-xs uppercase tracking-[0.12em] text-muted">
                  <span>first seen {formatDate(entry.firstSeenAt)}</span>
                  <span>last seen {formatDate(entry.lastSeenAt)}</span>
                </div>
              </article>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
