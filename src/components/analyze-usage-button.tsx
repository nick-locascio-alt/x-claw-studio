"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function AnalyzeUsageButton(props: {
  tweetId: string | null;
  mediaIndex: number;
  className?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  if (!props.tweetId) {
    return <span className="tt-chip">tweet id missing</span>;
  }

  async function analyze(): Promise<void> {
    setMessage(null);
    const response = await fetch("/api/analysis/tweet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tweetId: props.tweetId, mediaIndex: props.mediaIndex })
    });
    const body = await response.json();

    if (!response.ok) {
      setMessage(body.error || "Analysis failed");
      return;
    }

    setMessage("Analysis saved and indexed. Opening detail view...");
    router.refresh();
    if (body.usageId) {
      router.push(`/usage/${body.usageId}`);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        className={props.className ?? "tt-button"}
        onClick={() => startTransition(() => void analyze())}
        disabled={isPending}
      >
        <span>{isPending ? "Analyzing..." : "Start analysis"}</span>
      </button>
      {message ? <span className="tt-chip tt-chip-accent">{message}</span> : null}
    </div>
  );
}
