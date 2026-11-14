"use client";

import { useEffect, useRef, useState } from "react";
import { MicIcon, SquareIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";

/**
 * 60-second voice note. Audio is recorded and played back in the browser only; it is
 * never uploaded. Where the browser supports speech recognition, a live transcript
 * fills the text box, and only that (editable) text is used as evidence.
 */

const LIMIT = 60;

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult:
    | ((e: {
        resultIndex: number;
        results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
      }) => void)
    | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

const getRecognition = (): (new () => Recognition) | undefined => {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition) as (new () => Recognition) | undefined;
};

export function VoiceNote({ value, onChange }: { value: string; onChange: (text: string) => void }) {
  const [state, setState] = useState<"idle" | "recording" | "done">("idle");
  const [seconds, setSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canTranscribe] = useState(() => !!getRecognition());
  const recorder = useRef<MediaRecorder | null>(null);
  const recognition = useRef<Recognition | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const base = useRef("");

  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
      recorder.current?.stream.getTracks().forEach((t) => t.stop());
      recognition.current?.stop();
    },
    [],
  );
  useEffect(() => () => void (audioUrl && URL.revokeObjectURL(audioUrl)), [audioUrl]);

  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    recorder.current?.stop();
    recognition.current?.stop();
    setState("done");
  };

  const start = async () => {
    setError(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Microphone access was blocked. You can type what you'd say instead.");
      return;
    }
    const chunks: Blob[] = [];
    const rec = new MediaRecorder(stream);
    rec.ondataavailable = (e) => chunks.push(e.data);
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      setAudioUrl(URL.createObjectURL(new Blob(chunks, { type: rec.mimeType })));
    };
    rec.start();
    recorder.current = rec;

    const SR = getRecognition();
    if (SR) {
      const r = new SR();
      r.lang = navigator.language || "en-GB";
      r.continuous = true;
      r.interimResults = true;
      base.current = value ? `${value.trim()} ` : "";
      let finalText = "";
      r.onresult = (e) => {
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const res = e.results[i];
          if (res.isFinal) finalText += `${res[0].transcript} `;
          else interim += res[0].transcript;
        }
        onChange(`${base.current}${finalText}${interim}`.trim());
      };
      r.onerror = () => undefined;
      r.start();
      recognition.current = r;
    }

    setSeconds(0);
    setState("recording");
    timer.current = setInterval(() => {
      setSeconds((s) => {
        if (s + 1 >= LIMIT) stop();
        return s + 1;
      });
    }, 1000);
  };

  const discard = () => {
    setAudioUrl(null);
    setState("idle");
    setSeconds(0);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {state === "recording" ? (
          <Button size="sm" variant="destructive" onClick={stop}>
            <SquareIcon data-icon="inline-start" /> Stop
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={start}>
            <MicIcon data-icon="inline-start" /> {state === "done" ? "Record again" : "Record (60 s)"}
          </Button>
        )}
        {state === "recording" && (
          <div className="flex min-w-40 flex-1 items-center gap-2">
            <span className="size-2 animate-pulse rounded-full bg-destructive" aria-hidden />
            <Progress value={(seconds / LIMIT) * 100} className="flex-1" />
            <span className="text-xs text-muted-foreground tabular-nums">{LIMIT - seconds}s</span>
          </div>
        )}
        {audioUrl && state === "done" && (
          <>
            <audio src={audioUrl} controls className="h-8 max-w-full" />
            <Button size="icon-sm" variant="ghost" onClick={discard} aria-label="Delete recording">
              <Trash2Icon />
            </Button>
          </>
        )}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        placeholder={
          canTranscribe
            ? "Your transcript appears here while you speak. Fix anything it got wrong."
            : "Type what you said (this browser can't transcribe)."
        }
        aria-label="Voice note transcript"
      />
      <p className="text-xs text-muted-foreground">
        The recording stays on your device and is never uploaded. Only the transcript above is used, and you
        can edit it.
      </p>
    </div>
  );
}
