"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "../lib/utils";

export type VideoPlayerProps = {
  src: string;
  poster?: string;
  title?: string;
  /** Caption shown below the player on the left (e.g. "// MP4 · cdn.shopify.com") */
  meta?: string;
  /** Right-side label below the player (e.g. "shared via username") */
  attribution?: string;
  className?: string;
  autoPlay?: boolean;
  loop?: boolean;
};

export function VideoPlayer({
  src,
  poster,
  title,
  meta,
  attribution,
  className,
  autoPlay = false,
  loop = false,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(autoPlay);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Wire video events ──────────────────────────────────────────
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onTime = () => setCurrentTime(v.currentTime);
    const onMeta = () => setDuration(v.duration);
    const onVolume = () => {
      setMuted(v.muted);
      setVolume(v.volume);
    };
    const onProgress = () => {
      if (v.buffered.length > 0) {
        setBuffered(v.buffered.end(v.buffered.length - 1));
      }
    };

    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("loadedmetadata", onMeta);
    v.addEventListener("volumechange", onVolume);
    v.addEventListener("progress", onProgress);

    return () => {
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("loadedmetadata", onMeta);
      v.removeEventListener("volumechange", onVolume);
      v.removeEventListener("progress", onProgress);
    };
  }, []);

  // ─── Fullscreen tracking ────────────────────────────────────────
  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // ─── Auto-hide controls ─────────────────────────────────────────
  const flashControls = () => {
    setShowControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (playing) {
      hideTimer.current = setTimeout(() => setShowControls(false), 2500);
    }
  };

  useEffect(() => () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  // ─── Actions ────────────────────────────────────────────────────
  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play();
    else v.pause();
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const v = videoRef.current;
    if (!v || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    v.currentTime = Math.max(0, Math.min(duration, duration * ratio));
  };

  const setVolumeRaw = (val: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = Math.max(0, Math.min(1, val));
    if (v.volume > 0 && v.muted) v.muted = false;
  };

  const toggleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      el.requestFullscreen();
    }
  };

  // ─── Keyboard shortcuts ─────────────────────────────────────────
  const onKeyDown = (e: React.KeyboardEvent) => {
    const v = videoRef.current;
    if (!v) return;
    if (e.key === " " || e.key === "k") {
      e.preventDefault();
      togglePlay();
    } else if (e.key === "m") {
      e.preventDefault();
      toggleMute();
    } else if (e.key === "f") {
      e.preventDefault();
      toggleFullscreen();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      v.currentTime = Math.max(0, v.currentTime - 5);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      v.currentTime = Math.min(duration, v.currentTime + 5);
    }
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0;

  return (
    <div className={cn("space-y-2", className)}>
      {title ? (
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
          {title}
        </p>
      ) : null}

      <div
        ref={containerRef}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onMouseMove={flashControls}
        onMouseLeave={() => playing && setShowControls(false)}
        className="group relative overflow-hidden rounded-lg border border-border bg-black focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          autoPlay={autoPlay}
          muted={autoPlay}
          loop={loop}
          playsInline
          onClick={togglePlay}
          className="block w-full cursor-pointer object-contain"
        />

        {/* Center play button overlay when paused */}
        {!playing ? (
          <button
            type="button"
            onClick={togglePlay}
            aria-label="Play"
            className="absolute inset-0 flex items-center justify-center bg-black/30 transition-opacity hover:bg-black/40"
          >
            <span className="flex size-16 items-center justify-center rounded-full border-2 border-white/80 bg-black/50 text-2xl text-white shadow-lg backdrop-blur-sm">
              ▶
            </span>
          </button>
        ) : null}

        {/* Bottom controls bar */}
        <div
          className={cn(
            "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-4 pb-3 pt-8 transition-opacity duration-200",
            showControls || !playing ? "opacity-100" : "opacity-0",
          )}
        >
          {/* Progress bar */}
          <div
            onClick={seek}
            className="group/bar relative mb-2 h-1.5 cursor-pointer rounded-full bg-white/20"
          >
            {/* Buffered */}
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-white/30"
              style={{ width: `${bufferedPct}%` }}
            />
            {/* Played */}
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-primary"
              style={{ width: `${progress}%` }}
            />
            {/* Scrubber dot */}
            <div
              className="absolute top-1/2 size-3 -translate-y-1/2 rounded-full bg-primary opacity-0 transition-opacity group-hover/bar:opacity-100"
              style={{ left: `calc(${progress}% - 6px)` }}
            />
          </div>

          <div className="flex items-center justify-between gap-3 text-white">
            <div className="flex items-center gap-3">
              {/* Play/Pause */}
              <button
                type="button"
                onClick={togglePlay}
                aria-label={playing ? "Pause" : "Play"}
                className="text-lg leading-none transition-opacity hover:opacity-80"
              >
                {playing ? "❚❚" : "▶"}
              </button>

              {/* Volume */}
              <div className="group/vol flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleMute}
                  aria-label={muted ? "Unmute" : "Mute"}
                  className="text-sm transition-opacity hover:opacity-80"
                >
                  {muted || volume === 0 ? "🔇" : volume < 0.5 ? "🔉" : "🔊"}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={muted ? 0 : volume}
                  onChange={(e) => setVolumeRaw(parseFloat(e.target.value))}
                  className="h-1 w-0 origin-left scale-x-0 cursor-pointer appearance-none rounded-full bg-white/30 transition-[width,transform] duration-200 group-hover/vol:w-20 group-hover/vol:scale-x-100 [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                />
              </div>

              {/* Time */}
              <span className="font-mono text-[0.6875rem] tabular-nums text-white/80">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Fullscreen */}
              <button
                type="button"
                onClick={toggleFullscreen}
                aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                className="text-sm transition-opacity hover:opacity-80"
              >
                {isFullscreen ? "⛶" : "⛶"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer meta */}
      {meta || attribution ? (
        <div className="flex items-center justify-between gap-3">
          {meta ? (
            <p className="font-mono text-[0.6875rem] text-muted-foreground">
              {meta}
            </p>
          ) : <span />}
          {attribution ? (
            <p className="font-mono text-[0.6875rem] text-muted-foreground">
              shared via{" "}
              <span className="text-[oklch(0.80_0.14_160)]">{attribution}</span>
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
