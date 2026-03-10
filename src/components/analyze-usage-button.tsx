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
    return <span className="chip">tweet id missing</span>;
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
    <>
      <button
        className={props.className ?? "actionButton"}
        onClick={() => startTransition(() => void analyze())}
        disabled={isPending}
      >
        {isPending ? "Analyzing..." : "Start analysis"}
      </button>
      {message ? <span className="chip chipAccent">{message}</span> : null}
    </>
  );
}
