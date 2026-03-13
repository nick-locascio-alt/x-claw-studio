"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { RunHistoryEntry, RunTask, SchedulerConfig } from "@/src/lib/types";

interface ControlPanelProps {
  schedulerConfig: SchedulerConfig;
  runHistory: RunHistoryEntry[];
}

interface OpenClawTabOption {
  targetId: string;
  title?: string;
  url?: string;
}

interface OpenClawHealthState {
  ok: boolean;
  error: string | null;
}

const MANUAL_ACTIONS: Array<{
  task: RunTask;
  title: string;
  description: string;
  tone?: "primary" | "secondary";
}> = [
  {
    task: "crawl_openclaw",
    title: "Run Crawl",
    description: "Refresh and scroll the selected OpenClaw tab to capture new timeline posts.",
    tone: "primary"
  },
  {
    task: "capture_openclaw_current",
    title: "Capture Current Page",
    description: "Start from the attached page's current scroll position, then keep scrolling through what is already loaded."
  },
  {
    task: "capture_openclaw_current_tweet",
    title: "Capture Tweet + 10 Replies",
    description: "Jump to the top of the current tweet page, grab the main tweet plus roughly the first 10 replies, then stop."
  },
  {
    task: "capture_openclaw_current_tweet_and_compose_replies",
    title: "Capture + Draft All Replies",
    description: "Run the focused tweet capture, then generate reply drafts for every reply goal and save them to draft history."
  },
  {
    task: "analyze_missing",
    title: "Analyze Missing",
    description: "Backfill Gemini analysis for usages that do not have saved output yet."
  },
  {
    task: "analyze_topics",
    title: "Analyze Topics",
    description: "Run Gemini topic extraction in a bounded batch and rebuild the topic index cache."
  },
  {
    task: "crawl_timeline",
    title: "Run Playwright Crawl",
    description: "Use the fallback crawler when the OpenClaw route is not enough."
  },
  {
    task: "rebuild_media_assets",
    title: "Rebuild Media Matches",
    description: "Recompute grouping, fingerprints, and duplicate or similarity views."
  },
  {
    task: "backfill_media_native_types",
    title: "Backfill Media Types",
    description: "Scan saved raw media, create native image or video siblings for `.bin` files, and repoint manifests to the preferred typed file."
  }
];

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "unknown";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function toTimeInput(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function ControlPanel({ schedulerConfig, runHistory }: ControlPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [enabled, setEnabled] = useState(schedulerConfig.enabled);
  const [timesValue, setTimesValue] = useState(
    (schedulerConfig.times?.length ? schedulerConfig.times : [toTimeInput(schedulerConfig.hour, schedulerConfig.minute)]).join(", ")
  );
  const [openclawTabIndex, setOpenclawTabIndex] = useState("0");
  const [openclawTabs, setOpenclawTabs] = useState<OpenClawTabOption[]>([]);
  const [openclawHealth, setOpenclawHealth] = useState<OpenClawHealthState | null>(null);
  const [openclawKeepScrollPosition, setOpenclawKeepScrollPosition] = useState(false);
  const [openclawStartUrl, setOpenclawStartUrl] = useState("");
  const [timezone, setTimezone] = useState(schedulerConfig.timezone);
  const [topicBatchLimit, setTopicBatchLimit] = useState("100");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<RunHistoryEntry | null>(null);
  const [logContent, setLogContent] = useState("");

  const recentFailures = useMemo(() => runHistory.filter((entry) => entry.status === "failed"), [runHistory]);

  async function fetchOpenClawTabs(): Promise<{ tabs: OpenClawTabOption[]; error: string | null }> {
    const response = await fetch("/api/control/openclaw-tabs");
    const data = (await response.json().catch(() => null)) as
      | { tabs?: OpenClawTabOption[]; error?: string }
      | null;

    if (!response.ok) {
      return { tabs: [], error: data?.error || "Failed to load OpenClaw tabs" };
    }

    return { tabs: data?.tabs ?? [], error: null };
  }

  async function loadOpenClawTabs(): Promise<void> {
    try {
      const result = await fetchOpenClawTabs();
      if (result.error) {
        setStatusMessage(result.error);
        return;
      }

      setOpenclawTabs(result.tabs);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Failed to load OpenClaw tabs");
    }
  }

  async function loadOpenClawHealth(tabIndexValue = openclawTabIndex): Promise<void> {
    try {
      const parsedTabIndex = Number(tabIndexValue);
      const tabIndex = Number.isInteger(parsedTabIndex) && parsedTabIndex >= 0 ? parsedTabIndex : 0;
      const response = await fetch(`/api/control/openclaw-health?tabIndex=${tabIndex}`);
      const data = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string | null }
        | null;

      setOpenclawHealth({
        ok: response.ok && data?.ok === true,
        error: data?.error ?? null
      });
    } catch (error) {
      setOpenclawHealth({
        ok: false,
        error: error instanceof Error ? error.message : "Failed to check OpenClaw health"
      });
    }
  }

  useEffect(() => {
    let cancelled = false;

    fetchOpenClawTabs()
      .then((result) => {
        if (cancelled) {
          return;
        }

        if (result.error) {
          setStatusMessage(result.error);
          return;
        }

        setOpenclawTabs(result.tabs);
        const initialTabIndex = "0";
        void (async () => {
          try {
            const parsedTabIndex = Number(initialTabIndex);
            const tabIndex = Number.isInteger(parsedTabIndex) && parsedTabIndex >= 0 ? parsedTabIndex : 0;
            const response = await fetch(`/api/control/openclaw-health?tabIndex=${tabIndex}`);
            const data = (await response.json().catch(() => null)) as
              | { ok?: boolean; error?: string | null }
              | null;

            if (!cancelled) {
              setOpenclawHealth({
                ok: response.ok && data?.ok === true,
                error: data?.error ?? null
              });
            }
          } catch (error) {
            if (!cancelled) {
              setOpenclawHealth({
                ok: false,
                error: error instanceof Error ? error.message : "Failed to check OpenClaw health"
              });
            }
          }
        })();
      })
      .catch((error) => {
        if (!cancelled) {
          setStatusMessage(error instanceof Error ? error.message : "Failed to load OpenClaw tabs");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function saveSchedule(): Promise<void> {
    try {
      const times = timesValue
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      const response = await fetch("/api/control/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, times, timezone })
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setStatusMessage(data?.error || "Failed to save schedule");
        return;
      }

      setStatusMessage("Schedule saved.");
      router.refresh();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Failed to save schedule");
    }
  }

  async function triggerRun(task: RunTask): Promise<void> {
    try {
      const parsedTabIndex = Number(openclawTabIndex);
      const openclawTargetTabIndex =
        Number.isInteger(parsedTabIndex) && parsedTabIndex >= 0 ? parsedTabIndex : 0;
      const useOpenClawOptions =
        task === "crawl_openclaw" ||
        task === "capture_openclaw_current" ||
        task === "capture_openclaw_current_tweet" ||
        task === "capture_openclaw_current_tweet_and_compose_replies";
      const parsedTopicBatchLimit = Number(topicBatchLimit);
      const normalizedTopicBatchLimit =
        Number.isInteger(parsedTopicBatchLimit) && parsedTopicBatchLimit > 0 ? parsedTopicBatchLimit : 100;
      const response = await fetch("/api/control/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task,
          openclawTargetTabIndex,
          openclawKeepScrollPosition: useOpenClawOptions ? openclawKeepScrollPosition : false,
          openclawStartUrl: useOpenClawOptions && openclawStartUrl.trim() ? openclawStartUrl.trim() : null,
          topicBatchLimit: task === "analyze_topics" ? normalizedTopicBatchLimit : null
        })
      });
      const data = (await response.json().catch(() => null)) as
        | RunHistoryEntry
        | { error?: string }
        | null;

      if (!response.ok) {
        const message =
          data && "error" in data && data.error ? data.error : `Failed to trigger ${task}`;
        setStatusMessage(message);
        return;
      }

      const entry = data as RunHistoryEntry;
      setStatusMessage(`Triggered ${task}: ${entry.runControlId}`);
      router.refresh();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : `Failed to trigger ${task}`);
    }
  }

  async function loadLog(entry: RunHistoryEntry): Promise<void> {
    try {
      const params = new URLSearchParams({ path: entry.logPath });
      const response = await fetch(`/api/control/log?${params.toString()}`);
      const data = (await response.json().catch(() => null)) as
        | { content: string; error?: string }
        | null;

      if (!response.ok || !data?.content) {
        setStatusMessage(data?.error || "Failed to load log");
        return;
      }

      setSelectedLog(entry);
      setLogContent(data.content);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Failed to load log");
    }
  }

  return (
    <section id="run-control" className="relative z-10 mb-8 terminal-panel">
      <div className="panel-body">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="section-kicker">Run Control</div>
            <h2 className="section-title mt-3">Keep capture operations and scheduler state in one place</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
              Pick a tab, launch the task you need, then inspect history and failures without leaving the page.
            </p>
          </div>
          <div className={`tt-chip ${enabled ? "tt-chip-accent" : ""}`}>
            {enabled
              ? `${schedulerConfig.times.length} daily slot${schedulerConfig.times.length === 1 ? "" : "s"}`
              : "disabled"}
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <div className="terminal-window">
            <div className="window-bar">
              <div className="section-kicker">Manual Trigger</div>
              <div className="window-dots">
                <span className="window-dot bg-orange" />
                <span className="window-dot bg-accent" />
                <span className="window-dot bg-cyan" />
              </div>
            </div>
            <div className="panel-body space-y-4">
              <label className="tt-field">
                <span className="tt-field-label">OpenClaw Tab Picker</span>
                <select
                  value={openclawTabIndex}
                  onChange={(event) => {
                    const value = event.target.value;
                    setOpenclawTabIndex(value);
                    void loadOpenClawHealth(value);
                  }}
                  className="tt-select"
                >
                  {openclawTabs.length === 0 ? (
                    <option value={openclawTabIndex}>No tabs loaded</option>
                  ) : (
                    openclawTabs.map((tab, index) => (
                      <option key={tab.targetId} value={String(index)}>
                        [{index}] {tab.title ?? "untitled"} {tab.url ? `- ${tab.url}` : ""}
                      </option>
                    ))
                  )}
                </select>
              </label>

              <div className="flex flex-wrap gap-3">
                <button
                  className="tt-button tt-button-secondary"
                  onClick={() =>
                    startTransition(async () => {
                      await loadOpenClawTabs();
                      await loadOpenClawHealth(openclawTabIndex);
                    })
                  }
                  disabled={isPending}
                >
                  <span>Refresh Tabs</span>
                </button>
              </div>

              <label className="tt-field">
                <span className="tt-field-label">OpenClaw Tab Index (0-based)</span>
                <input
                  type="text"
                  value={openclawTabIndex}
                  onChange={(event) => {
                    const value = event.target.value;
                    setOpenclawTabIndex(value);
                    void loadOpenClawHealth(value);
                  }}
                  placeholder="0"
                  className="tt-input"
                />
              </label>

              <div className={`tt-subpanel ${openclawHealth?.ok ? "tt-chip-accent" : ""}`}>
                <p className="tt-copy">
                  OpenClaw health: {openclawHealth == null ? "checking" : openclawHealth.ok ? "ready" : "broken"}
                </p>
                {openclawHealth?.error ? <p className="mt-2 text-sm leading-6 text-rose-300">{openclawHealth.error}</p> : null}
              </div>

              <label className="tt-field">
                <span className="tt-field-label">OpenClaw Start Position</span>
                <div className="tt-subpanel-soft flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={openclawKeepScrollPosition}
                    onChange={(event) => setOpenclawKeepScrollPosition(event.target.checked)}
                    className="tt-checkbox"
                  />
                  <span className="font-[family:var(--font-label)] text-xs uppercase tracking-[0.22em] text-slate-200">
                    Keep current scroll position for manual OpenClaw runs
                  </span>
                </div>
              </label>

              <label className="tt-field">
                <span className="tt-field-label">OpenClaw Tweet URL (optional)</span>
                <input
                  type="text"
                  value={openclawStartUrl}
                  onChange={(event) => setOpenclawStartUrl(event.target.value)}
                  placeholder="https://x.com/user/status/1234567890"
                  className="tt-input"
                />
              </label>

              <div className="surface-divider pt-4">
                <div className="mb-3 flex items-end justify-between gap-3">
                  <div>
                    <div className="tt-data-label">Tasks</div>
                    <p className="mt-2 text-sm leading-6 text-slate-300">Primary crawl first, maintenance actions after.</p>
                  </div>
                  {isPending ? <span className="tt-chip tt-chip-accent">working</span> : null}
                </div>
                <div className="mb-4 grid gap-3 md:grid-cols-[minmax(0,220px)_1fr]">
                  <label className="tt-field">
                    <span className="tt-field-label">Topic Batch Size</span>
                    <select
                      value={topicBatchLimit}
                      onChange={(event) => setTopicBatchLimit(event.target.value)}
                      className="tt-select"
                    >
                      <option value="25">25 tweets</option>
                      <option value="50">50 tweets</option>
                      <option value="100">100 tweets</option>
                      <option value="200">200 tweets</option>
                    </select>
                  </label>
                  <div className="tt-subpanel-soft">
                    <p className="text-sm leading-6 text-slate-300">
                      Used by <strong className="text-slate-100">Analyze Topics</strong>. The run stays single-threaded and uses the repo&apos;s delay setting to avoid Gemini rate-limit spikes.
                    </p>
                  </div>
                </div>
                <div className="control-action-grid">
                  {MANUAL_ACTIONS.map((action) => (
                    <article key={action.task} className="action-tile">
                      <div>
                        <h3 className="text-base font-semibold text-slate-100">{action.title}</h3>
                        <p className="mt-2 text-sm leading-6 text-slate-300">{action.description}</p>
                      </div>
                      <button
                        className={action.tone === "primary" ? "tt-button" : "tt-button tt-button-secondary"}
                        onClick={() => startTransition(() => void triggerRun(action.task))}
                        disabled={isPending}
                      >
                        <span>{action.title}</span>
                      </button>
                    </article>
                  ))}
                </div>
              </div>

              <div className="tt-subpanel">
                <p className="tt-copy">
                OpenClaw actions use the exact 0-based array index from `openclaw browser --browser-profile chrome tabs --json`. `Run Crawl` refreshes and scrolls that tab by default. `Capture Current Page` stays on the current page and starts from the tab&apos;s current scroll position. `Capture Tweet + 10 Replies` resets to the top of the tweet page and stops once it has the main tweet plus the early reply window. `Capture + Draft All Replies` runs that tighter capture and then saves one draft for each reply goal. `Keep current scroll position` only affects manual `Run Crawl` runs. If you provide a tweet status URL, the manual OpenClaw run navigates there first and auto-stars only that top tweet&apos;s media after capture.
                </p>
              </div>
            </div>
          </div>

          <div className="terminal-window">
            <div className="window-bar">
              <div className="section-kicker">Scheduler</div>
              <div className="tt-chip">{schedulerConfig.timezone}</div>
            </div>
            <div className="panel-body space-y-4">
              <label className="tt-field">
                <span className="tt-field-label">Enabled</span>
                <div className="tt-subpanel-soft flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(event) => setEnabled(event.target.checked)}
                    className="tt-checkbox"
                  />
                  <span className="font-[family:var(--font-label)] text-xs uppercase tracking-[0.22em] text-slate-200">
                    Enable polling schedule
                  </span>
                </div>
              </label>
              <label className="tt-field">
                <span className="tt-field-label">Daily Times</span>
                <input
                  type="text"
                  value={timesValue}
                  onChange={(event) => setTimesValue(event.target.value)}
                  placeholder="09:00, 13:00, 17:00"
                  className="tt-input"
                />
              </label>
              <label className="tt-field">
                <span className="tt-field-label">Timezone</span>
                <input
                  type="text"
                  value={timezone}
                  onChange={(event) => setTimezone(event.target.value)}
                  className="tt-input"
                />
              </label>
              <div className="tt-subpanel">
                <p className="tt-copy">
                Comma-separated local times like `09:00, 13:00, 17:00`. Run `npm run scheduler` to activate polling. If polling misses a slot, the scheduler now catches up on the next evaluation instead of waiting for the next day.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button className="tt-button" onClick={() => startTransition(() => void saveSchedule())} disabled={isPending}>
                  <span>Save Schedule</span>
                </button>
                <span className="tt-chip">{schedulerConfig.timezone}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="tt-chip">last evaluated {formatDate(schedulerConfig.lastEvaluatedAt)}</span>
          <span className="tt-chip">last processed slot {formatDate(schedulerConfig.lastProcessedSlotAt)}</span>
          <span className="tt-chip">last triggered {formatDate(schedulerConfig.lastTriggeredAt)}</span>
          {schedulerConfig.lastSkipReason ? (
            <span className="tt-chip tt-chip-danger" title={schedulerConfig.lastSkipReason}>
              skipped {formatDate(schedulerConfig.lastSkippedAt)}
            </span>
          ) : null}
          {statusMessage ? <span className="tt-chip tt-chip-accent">{statusMessage}</span> : null}
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="terminal-window">
            <div className="window-bar">
              <div className="section-kicker">Run History</div>
              <div className="tt-chip">{runHistory.length} events</div>
            </div>
            <div className="panel-body tt-scroll-panel">
              <div className="grid gap-3">
                {runHistory.length === 0 ? (
                  <div className="tt-placeholder">No recorded runs yet.</div>
                ) : (
                  runHistory.map((entry) => (
                    <button
                      key={entry.runControlId}
                      className="tt-subpanel cursor-pointer text-left transition-all duration-150 ease-linear hover:-translate-y-0.5 hover:border-accent/70 hover:shadow-[0_0_4px_#00ff88,0_0_12px_rgba(0,255,136,0.16)]"
                      onClick={() => startTransition(() => void loadLog(entry))}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <strong className="font-[family:var(--font-label)] text-xs uppercase tracking-[0.24em] text-accent">
                            {entry.task}
                          </strong>
                          <div className="mt-2 text-sm text-slate-200">{entry.trigger}</div>
                        </div>
                        <span className={`tt-chip ${entry.status === "failed" ? "tt-chip-danger" : ""}`}>
                          {entry.status}
                        </span>
                      </div>
                      <div className="mt-2 text-sm text-slate-300">{formatDate(entry.startedAt)}</div>
                      {entry.errorMessage ? <div className="mt-3 text-sm text-red-300">{entry.errorMessage}</div> : null}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="terminal-window">
            <div className="window-bar">
              <div className="section-kicker">Selected Log</div>
              {selectedLog ? <div className="tt-chip">{selectedLog.runControlId}</div> : null}
            </div>
            <div className="panel-body tt-scroll-panel">
              {selectedLog ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <span className="tt-chip">{selectedLog.logPath}</span>
                    <span className={`tt-chip ${selectedLog.status === "failed" ? "tt-chip-danger" : ""}`}>
                      {selectedLog.status}
                    </span>
                  </div>
                  <pre className="tt-log">{logContent || "log is empty"}</pre>
                </div>
              ) : (
                <div className="tt-placeholder">Select a run to inspect stdout, stderr, and errors.</div>
              )}
            </div>
          </div>
        </div>

        {recentFailures.length > 0 ? (
          <div className="mt-6">
            <div className="section-kicker">Recent Failures</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {recentFailures.slice(0, 5).map((entry) => (
                <span key={entry.runControlId} className="tt-chip tt-chip-danger">
                  {entry.task} · {formatDate(entry.startedAt)}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
