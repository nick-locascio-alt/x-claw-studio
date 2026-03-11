"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buildLocalMediaUrl } from "@/src/lib/media-display";

interface MediaPreviewProps {
  alt: string;
  imageUrl: string | null;
  videoFilePath?: string | null;
  showVideoByDefault?: boolean;
}

export function MediaPreview({ alt, imageUrl, videoFilePath, showVideoByDefault = false }: MediaPreviewProps) {
  const [isPlaying, setIsPlaying] = useState(showVideoByDefault && Boolean(videoFilePath));
  const videoUrl = useMemo(() => buildLocalMediaUrl(videoFilePath), [videoFilePath]);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!videoFilePath) {
      setIsPlaying(false);
      return;
    }

    if (showVideoByDefault) {
      setIsPlaying(true);
    }
  }, [showVideoByDefault, videoFilePath]);

  useEffect(() => {
    if (!isPlaying || !videoUrl || !videoRef.current) {
      return;
    }

    const videoElement = videoRef.current;
    if (!videoUrl.includes(".m3u8")) {
      videoElement.src = videoUrl;
      return;
    }

    let isCancelled = false;
    let hls: import("hls.js").default | null = null;

    void import("hls.js").then(({ default: Hls }) => {
      if (isCancelled) {
        return;
      }

      if (Hls.isSupported()) {
        hls = new Hls();
        hls.loadSource(videoUrl);
        hls.attachMedia(videoElement);
        return;
      }

      if (videoElement.canPlayType("application/vnd.apple.mpegurl")) {
        videoElement.src = videoUrl;
      }
    });

    return () => {
      isCancelled = true;
      hls?.destroy();
    };
  }, [isPlaying, videoUrl]);

  if (videoUrl && isPlaying) {
    return (
      <video
        ref={videoRef}
        poster={imageUrl ?? undefined}
        controls
        autoPlay
        playsInline
        preload="metadata"
        className="h-full w-full object-cover"
      />
    );
  }

  if (videoUrl) {
    return (
      <button
        type="button"
        className="group relative block h-full w-full cursor-pointer bg-transparent p-0"
        onClick={() => setIsPlaying(true)}
        aria-label={`Play video: ${alt}`}
      >
        {imageUrl ? (
          <img src={imageUrl} alt={alt} className="h-full w-full object-cover transition-transform duration-200 ease-linear group-hover:scale-[1.02]" />
        ) : (
          <div className="grid h-full w-full place-items-center bg-black/90 font-[family:var(--font-mono)] text-sm uppercase tracking-[0.26em] text-cyan">
            video ready
          </div>
        )}
        <span className="absolute bottom-3 right-3 border border-cyan bg-black/75 px-3 py-2 font-[family:var(--font-mono)] text-[11px] uppercase tracking-[0.26em] text-cyan shadow-[0_0_16px_rgba(0,255,255,0.18)] transition-colors duration-200 ease-linear group-hover:bg-cyan group-hover:text-black">
          Play video
        </span>
      </button>
    );
  }

  if (imageUrl) {
    return <img src={imageUrl} alt={alt} className="h-full w-full object-cover" />;
  }

  return (
    <div className="grid h-full w-full place-items-center bg-black/90 font-[family:var(--font-mono)] text-sm uppercase tracking-[0.26em] text-magenta">
      no preview
    </div>
  );
}
