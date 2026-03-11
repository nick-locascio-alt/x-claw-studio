"use client";

import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";

export function AssetStarButton(props: {
  assetId: string;
  starred: boolean;
  className?: string;
  starredLabel?: string;
  unstarredLabel?: string;
  iconOnly?: boolean;
  wrapperClassName?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [starred, setStarred] = useOptimistic(props.starred, (_currentState, nextState: boolean) => nextState);

  const iconOnly = props.iconOnly ?? true;
  const baseClassName = props.className ?? (starred ? "tt-icon-button tt-icon-button-secondary" : "tt-icon-button");
  const label = starred ? (props.starredLabel ?? "Unstar asset") : (props.unstarredLabel ?? "Star asset");

  return (
    <div className={props.wrapperClassName ?? "flex flex-wrap items-center gap-3"}>
      <button
        type="button"
        className={baseClassName}
        aria-label={label}
        title={label}
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            setErrorMessage(null);
            const nextStarred = !starred;
            setStarred(nextStarred);
            const response = await fetch("/api/media-assets/star", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ assetId: props.assetId, starred: nextStarred })
            });

            if (!response.ok) {
              const body = (await response.json().catch(() => null)) as { error?: string } | null;
              setStarred(starred);
              setErrorMessage(body?.error || "Failed to update star");
              return;
            }

            router.refresh();
          })
        }
      >
        {iconOnly ? (
          <>
            <span aria-hidden="true">{starred ? "★" : "☆"}</span>
            <span className="sr-only">{label}</span>
          </>
        ) : (
          <span>{label}</span>
        )}
      </button>
      {errorMessage ? <div className="tt-chip tt-chip-danger">{errorMessage}</div> : null}
    </div>
  );
}
