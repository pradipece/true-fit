"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GoogleGenAI, Modality, type LiveServerMessage, type Session } from "@google/genai";
import type { NeedDraft } from "@/lib/intake";
import { UPDATE_CARD_TOOL } from "@/lib/intake-live";

/**
 * Live voice conversation with Gemini (Live API) straight from the browser.
 *
 * A short-lived, single-use token comes from /api/intake/live (the API key stays on the
 * server, and the prompt and tool are locked into the token). Microphone audio streams to
 * Gemini as 16 kHz PCM; Gemini answers with 24 kHz audio, which is played as it arrives, plus
 * transcripts of both sides. Card changes arrive as `update_need_card` tool calls; the caller
 * applies them and returns aggregate counts. Nothing is recorded or stored.
 */

export type LiveState = "idle" | "connecting" | "live" | "error";

type Callbacks = {
  /** A piece of transcript. `role` says who is speaking. */
  onTranscript: (role: "user" | "assistant", text: string) => void;
  /** The current turn ended (model finished or was interrupted). */
  onTurnEnd: () => void;
  /** Gemini sent a card. Apply it and return what Gemini may see (counts only). */
  onCard: (args: unknown) => Record<string, unknown>;
};

const IN_RATE = 16_000;
const OUT_RATE = 24_000;

// Downsamples the mic to 16 kHz mono PCM16 in ~100 ms chunks, off the main thread.
const WORKLET = `
class PcmCapture extends AudioWorkletProcessor {
  constructor() { super(); this.ratio = sampleRate / ${IN_RATE}; this.pos = 0; this.buf = []; }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    for (; this.pos < ch.length; this.pos += this.ratio) this.buf.push(ch[Math.floor(this.pos)]);
    this.pos -= ch.length;
    if (this.buf.length >= ${IN_RATE / 10}) {
      const out = new Int16Array(this.buf.length);
      let peak = 0;
      for (let i = 0; i < this.buf.length; i++) {
        const s = Math.max(-1, Math.min(1, this.buf[i]));
        peak = Math.max(peak, Math.abs(s));
        out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
      this.port.postMessage({ pcm: out.buffer, peak }, [out.buffer]);
      this.buf = [];
    }
    return true;
  }
}
registerProcessor("pcm-capture", PcmCapture);
`;

const toBase64 = (buf: ArrayBuffer) => {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};

const fromBase64Pcm = (b64: string) => {
  const bin = atob(b64);
  const pcm = new Int16Array(bin.length >> 1);
  for (let i = 0; i < pcm.length; i++)
    pcm[i] = ((bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8)) << 16) >> 16;
  const f = new Float32Array(pcm.length);
  for (let i = 0; i < pcm.length; i++) f[i] = pcm[i] / 0x8000;
  return f;
};

export function useLiveIntake(callbacks: Callbacks) {
  const [state, setState] = useState<LiveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [level, setLevel] = useState(0);
  const [muted, setMuted] = useState(false);

  const cb = useRef(callbacks);
  useEffect(() => {
    cb.current = callbacks;
  });
  const session = useRef<Session | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const micCtx = useRef<AudioContext | null>(null);
  const outCtx = useRef<AudioContext | null>(null);
  const playing = useRef(new Set<AudioBufferSourceNode>());
  const nextAt = useRef(0);
  const mutedRef = useRef(false);
  const stopping = useRef(false);

  const stopPlayback = () => {
    for (const s of playing.current) s.stop();
    playing.current.clear();
    nextAt.current = 0;
    setSpeaking(false);
  };

  const teardown = useCallback(() => {
    stopping.current = true;
    session.current?.close();
    session.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    void micCtx.current?.close();
    micCtx.current = null;
    stopPlayback();
    void outCtx.current?.close();
    outCtx.current = null;
    setLevel(0);
  }, []);

  useEffect(() => teardown, [teardown]);

  const play = (b64: string) => {
    const ctx = outCtx.current;
    if (!ctx) return;
    const data = fromBase64Pcm(b64);
    const buffer = ctx.createBuffer(1, data.length, OUT_RATE);
    buffer.copyToChannel(data, 0);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    const at = Math.max(ctx.currentTime + 0.02, nextAt.current);
    src.start(at);
    nextAt.current = at + buffer.duration;
    playing.current.add(src);
    setSpeaking(true);
    src.onended = () => {
      playing.current.delete(src);
      if (!playing.current.size) setSpeaking(false);
    };
  };

  const onMessage = (msg: LiveServerMessage) => {
    const sc = msg.serverContent;
    if (sc) {
      if (sc.interrupted) stopPlayback();
      for (const part of sc.modelTurn?.parts ?? []) if (part.inlineData?.data) play(part.inlineData.data);
      if (sc.inputTranscription?.text) cb.current.onTranscript("user", sc.inputTranscription.text);
      if (sc.outputTranscription?.text) cb.current.onTranscript("assistant", sc.outputTranscription.text);
      if (sc.turnComplete || sc.interrupted) cb.current.onTurnEnd();
    }
    const calls = msg.toolCall?.functionCalls ?? [];
    if (calls.length)
      session.current?.sendToolResponse({
        functionResponses: calls.map((c) => ({
          id: c.id,
          name: c.name,
          response:
            c.name === UPDATE_CARD_TOOL ? cb.current.onCard(c.args) : { ok: false, error: "Unknown tool" },
        })),
      });
    if (msg.goAway) setError("The live session is about to end. Start it again to keep talking.");
  };

  const start = async (draft: NeedDraft) => {
    if (state === "connecting" || state === "live") return;
    setError(null);
    setState("connecting");
    stopping.current = false;
    try {
      // Ask for the microphone first, so a refusal doesn't waste a token.
      stream.current = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch {
      setState("error");
      setError("Microphone access was blocked. Allow it in the browser, or type instead.");
      return;
    }
    try {
      const res = await fetch("/api/intake/live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft }),
      });
      const data = (await res.json().catch(() => ({}))) as { token?: string; model?: string; error?: string };
      if (!res.ok || !data.token || !data.model)
        throw new Error(data.error ?? "Couldn't start a live conversation.");

      outCtx.current = new AudioContext({ sampleRate: OUT_RATE });
      const ai = new GoogleGenAI({ apiKey: data.token, httpOptions: { apiVersion: "v1alpha" } });
      session.current = await ai.live.connect({
        model: data.model,
        config: { responseModalities: [Modality.AUDIO] },
        callbacks: {
          onmessage: onMessage,
          onerror: () => setError("The live connection had a problem. Start it again to keep talking."),
          onclose: (e) => {
            if (stopping.current) return;
            teardown();
            setState(e.code === 1000 ? "idle" : "error");
            if (e.code !== 1000) setError(e.reason || "The live conversation ended unexpectedly.");
          },
        },
      });

      // Stream the microphone.
      const ctx = new AudioContext();
      micCtx.current = ctx;
      const url = URL.createObjectURL(new Blob([WORKLET], { type: "text/javascript" }));
      await ctx.audioWorklet.addModule(url);
      URL.revokeObjectURL(url);
      const node = new AudioWorkletNode(ctx, "pcm-capture");
      node.port.onmessage = (e: MessageEvent<{ pcm: ArrayBuffer; peak: number }>) => {
        setLevel(mutedRef.current ? 0 : e.data.peak);
        if (mutedRef.current) return;
        session.current?.sendRealtimeInput({
          audio: { data: toBase64(e.data.pcm), mimeType: `audio/pcm;rate=${IN_RATE}` },
        });
      };
      ctx.createMediaStreamSource(stream.current).connect(node);
      // Kick off the greeting so the user isn't met with silence.
      session.current.sendClientContent({ turns: "Hello", turnComplete: true });
      setState("live");
    } catch (e) {
      teardown();
      setState("error");
      setError(
        e instanceof TypeError
          ? "Couldn't reach the AI. Check your internet connection and try again."
          : e instanceof Error
            ? e.message
            : "Couldn't start a live conversation.",
      );
    }
  };

  const stop = () => {
    teardown();
    setState("idle");
    cb.current.onTurnEnd();
  };

  const toggleMute = () => {
    mutedRef.current = !mutedRef.current;
    setMuted(mutedRef.current);
    if (mutedRef.current) session.current?.sendRealtimeInput({ audioStreamEnd: true });
  };

  return { state, error, speaking, level, muted, start, stop, toggleMute };
}
