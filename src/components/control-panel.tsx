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
  const [timezone, setTimezone] = useState(schedulerConfig.timezone);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<RunHistoryEntry | null>(null);
  const [logContent, setLogContent] = useState<string>("");

  const recentFailures = useMemo(
    () => runHistory.filter((entry) => entry.status === "failed"),
    [runHistory]
  );

  useEffect(() => {
    void loadOpenClawTabs();
  }, []);

  async function loadOpenClawTabs(): Promise<void> {
    try {
      const response = await fetch("/api/control/openclaw-tabs");
      const data = (await response.json().catch(() => null)) as
        | { tabs?: OpenClawTabOption[]; error?: string }
        | null;

      if (!response.ok) {
        setStatusMessage(data?.error || "Failed to load OpenClaw tabs");
        return;
      }

      setOpenclawTabs(data?.tabs ?? []);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Failed to load OpenClaw tabs");
    }
  }

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
      const response = await fetch("/api/control/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task, openclawTargetTabIndex })
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
    <section className="panel">
      <div className="sectionHeader">
        <div>
          <div className="sectionLabel">Run Control</div>
          <h2 className="sectionTitle">Trigger runs, configure daily schedule, inspect failures</h2>
        </div>
        <div className="chip chipAccent">{enabled ? `${schedulerConfig.times.length} daily slot${schedulerConfig.times.length === 1 ? "" : "s"}` : "disabled"}</div>
      </div>

      <div className="controlGrid">
        <div className="controlCard">
          <div className="sectionLabel">Manual Trigger</div>
          <label className="formRow">
            <span>OpenClaw Tab Picker</span>
            <select
              value={openclawTabIndex}
              onChange={(event) => setOpenclawTabIndex(event.target.value)}
              className="selectInput"
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
          <div className="buttonRow" style={{ marginBottom: 10 }}>
            <button
              className="actionButton secondaryButton"
              onClick={() => startTransition(() => void loadOpenClawTabs())}
              disabled={isPending}
            >
              Refresh Tabs
            </button>
          </div>
          <label className="formRow">
            <span>OpenClaw Tab Index (0-based)</span>
            <input
              type="text"
              value={openclawTabIndex}
              onChange={(event) => setOpenclawTabIndex(event.target.value)}
              placeholder="0"
            />
          </label>
          <div className="buttonRow">
            <button
              className="actionButton"
              onClick={() => startTransition(() => void triggerRun("crawl_openclaw"))}
              disabled={isPending}
            >
              Run Crawl
            </button>
            <button
              className="actionButton secondaryButton"
              onClick={() => startTransition(() => void triggerRun("capture_openclaw_current"))}
              disabled={isPending}
            >
              Capture Current Page
            </button>
            <button
              className="actionButton secondaryButton"
              onClick={() => startTransition(() => void triggerRun("analyze_missing"))}
              disabled={isPending}
            >
              Analyze All Missing
            </button>
            <button
              className="actionButton secondaryButton"
              onClick={() => startTransition(() => void triggerRun("crawl_timeline"))}
              disabled={isPending}
            >
              Run Playwright Crawl
            </button>
            <button
              className="actionButton secondaryButton"
              onClick={() => startTransition(() => void triggerRun("rebuild_media_assets"))}
              disabled={isPending}
            >
              Rebuild pHashes
            </button>
          </div>
          <p className="helperText">
            OpenClaw actions use the exact 0-based array index from `openclaw browser --browser-profile chrome tabs --json`, so `0` is the first tab and `1` is the second. `Run Crawl` refreshes and scrolls that tab. `Capture Current Page` dumps the current attached page HTML and extracts visible tweets without refreshing, navigating, or scrolling. `Rebuild pHashes` recomputes media asset fingerprints, asset grouping, and pHash match views across all saved usages.
          </p>
        </div>

        <div className="controlCard">
          <div className="sectionLabel">Schedule</div>
          <label className="formRow">
            <span>Enabled</span>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
            />
          </label>
          <label className="formRow">
            <span>Daily Times</span>
            <input
              type="text"
              value={timesValue}
              onChange={(event) => setTimesValue(event.target.value)}
              placeholder="09:00, 13:00, 17:00"
            />
          </label>
          <label className="formRow">
            <span>Timezone</span>
            <input
              type="text"
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
            />
          </label>
          <div className="helperText">
            Comma-separated local times like `09:00, 13:00, 17:00`. Run `npm run scheduler` to activate polling.
          </div>
          <button
            className="actionButton"
            onClick={() => startTransition(() => void saveSchedule())}
            disabled={isPending}
          >
            Save Schedule
          </button>
        </div>
      </div>

      <div className="statusRow">
        <span className="chip">last evaluated {formatDate(schedulerConfig.lastEvaluatedAt)}</span>
        <span className="chip">last triggered {formatDate(schedulerConfig.lastTriggeredAt)}</span>
        {statusMessage ? <span className="chip chipAccent">{statusMessage}</span> : null}
      </div>

      <div className="split" style={{ marginTop: 18 }}>
        <div className="panelInset">
          <div className="sectionLabel">Run History</div>
          <div className="historyList">
            {runHistory.length === 0 ? (
              <div className="placeholder">No recorded runs yet.</div>
            ) : (
              runHistory.map((entry) => (
                <button
                  key={entry.runControlId}
                  className="historyItem"
                  onClick={() => startTransition(() => void loadLog(entry))}
                >
                  <div className="historyTitleRow">
                    <strong className="mono">{entry.task}</strong>
                    <span className={`chip ${entry.status === "failed" ? "chipDanger" : ""}`}>
                      {entry.status}
                    </span>
                  </div>
                  <div className="helperText">
                    {entry.trigger} · {formatDate(entry.startedAt)}
                  </div>
                  {entry.errorMessage ? <div className="errorText">{entry.errorMessage}</div> : null}
                </button>
              ))
            )}
          </div>
        </div>

        <div className="panelInset">
          <div className="sectionLabel">Selected Log</div>
          {selectedLog ? (
            <>
              <div className="historyTitleRow" style={{ marginBottom: 10 }}>
                <strong className="mono">{selectedLog.runControlId}</strong>
                <span className="chip">{selectedLog.logPath}</span>
              </div>
              <pre className="logViewer">{logContent || "log is empty"}</pre>
            </>
          ) : (
            <div className="placeholder">Select a run to inspect stdout/stderr and errors.</div>
          )}
        </div>
      </div>

      {recentFailures.length > 0 ? (
        <div style={{ marginTop: 16 }}>
          <div className="sectionLabel">Recent Failures</div>
          <div className="chipRow" style={{ marginTop: 8 }}>
            {recentFailures.slice(0, 5).map((entry) => (
              <span key={entry.runControlId} className="chip chipDanger">
                {entry.task} · {formatDate(entry.startedAt)}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
