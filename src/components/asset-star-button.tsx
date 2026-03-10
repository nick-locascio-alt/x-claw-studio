"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function AssetStarButton(props: {
  assetId: string;
  starred: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  return (
    <>
      <button
        type="button"
        className={`${props.className ?? "actionLink"} ${props.starred ? "starButtonActive" : ""}`}
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            setErrorMessage(null);
            const response = await fetch("/api/media-assets/star", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ assetId: props.assetId, starred: !props.starred })
            });

            if (!response.ok) {
              const body = (await response.json().catch(() => null)) as { error?: string } | null;
              setErrorMessage(body?.error || "Failed to update star");
              return;
            }

            router.refresh();
          })
        }
      >
        {props.starred ? "Unstar asset" : "Star asset"}
      </button>
      {errorMessage ? <div className="errorText">{errorMessage}</div> : null}
    </>
  );
}
