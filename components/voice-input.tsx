"use client";

import { useEffect, useRef, useState } from "react";
import { LoaderCircleIcon, MicIcon, SquareIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Mic button for a chat input: records up to 60 seconds, sends the audio to
 * /api/intake/transcribe (Gemini) and hands back the transcript. The caller puts it in the
 * text box so the user can check and edit it before sending. The audio is never stored.
 */

const LIMIT = 60;

type State = "idle" | "recording" | "transcribing";

export function VoiceInput({
  onTranscript,
  onError,
  disabled,
  className,
}: {
  onTranscript: (text: string) => void;
  onError: (message: string | null) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [state, setState] = useState<State>("idle");
  const [seconds, setSeconds] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelled = useRef(false);

  useEffect(
    () => () => {
      cancelled.current = true;
      if (timer.current) clearInterval(timer.current);
      const rec = recorder.current;
      if (rec && rec.state !== "inactive") rec.stop();
      rec?.stream.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    const rec = recorder.current;
    if (rec && rec.state !== "inactive") rec.stop();
  };

  const transcribe = async (audio: Blob) => {
    setState("transcribing");
    try {
      const body = new FormData();
      body.append("audio", audio, "voice-message");
      const res = await fetch("/api/intake/transcribe", { method: "POST", body });
      const data = (await res.json().catch(() => ({}))) as { transcript?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Couldn't turn the recording into text.");
      if (cancelled.current) return;
      if (data.transcript) onTranscript(data.transcript);
      else onError("I couldn't hear any words. Try again a bit closer to the microphone.");
    } catch (e) {
      if (cancelled.current) return;
      onError(
        e instanceof TypeError
          ? "Couldn't reach the AI. Check your internet connection and try again."
          : e instanceof Error
            ? e.message
            : "Something went wrong. Try again.",
      );
    } finally {
      if (!cancelled.current) setState("idle");
    }
  };

  const start = async () => {
    onError(null);
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      onError("This browser can't record audio. Type your answer instead.");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      onError("Microphone access was blocked. Allow it in the browser, or type your answer.");
      return;
    }
    const chunks: Blob[] = [];
    const rec = new MediaRecorder(stream);
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      recorder.current = null;
      if (cancelled.current) return;
      const audio = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
      if (audio.size) void transcribe(audio);
      else setState("idle");
    };
    rec.start();
    recorder.current = rec;
    setSeconds(0);
    setState("recording");
    timer.current = setInterval(() => {
      setSeconds((s) => {
        if (s + 1 >= LIMIT) stop();
        return s + 1;
      });
    }, 1000);
  };

  const label =
    state === "recording"
      ? `Stop recording (${LIMIT - seconds}s left)`
      : state === "transcribing"
        ? "Turning your voice into text"
        : "Speak your answer";

  return (
    <Button
      type="button"
      size="icon-lg"
      variant={state === "recording" ? "destructive" : "outline"}
      onClick={state === "recording" ? stop : start}
      disabled={state === "transcribing" || (disabled && state === "idle")}
      aria-label={label}
      title={label}
      className={cn("relative", className)}
    >
      {state === "recording" ? (
        <>
          <SquareIcon />
          <span
            className="absolute -top-1.5 -right-1.5 rounded-full bg-background px-1 text-[10px] font-medium text-destructive tabular-nums shadow-sm"
            aria-hidden
          >
            {LIMIT - seconds}
          </span>
        </>
      ) : state === "transcribing" ? (
        <LoaderCircleIcon className="animate-spin" />
      ) : (
        <MicIcon />
      )}
    </Button>
  );
}
