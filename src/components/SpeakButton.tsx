"use client";

import { useEffect, useRef, useState } from "react";
import { useApp } from "@/lib/store";

const SPEECH_RATES = [0.85, 1, 1.15] as const;

// Speaks text with the browser voice for `lang` (a BCP 47 locale such as ja-JP).
export function speak(text: string, lang: string, rate = 0.85): void {
  if (!("speechSynthesis" in window)) return;
  try {
    const synthesis = window.speechSynthesis;
    synthesis.cancel();
    synthesis.resume();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = rate;
    utterance.onerror = () => synthesis.cancel();
    synthesis.speak(utterance);
  } catch {
    // Some iOS standalone versions throw when speech services are unavailable.
  }
}

export function PronunciationText({ text, className = "" }: { text: string; className?: string }) {
  const { course, t } = useApp();
  const lang = course?.speechLocale ?? "en-US";
  const [speaking, setSpeaking] = useState(false);
  const [rate, setRate] = useState<(typeof SPEECH_RATES)[number]>(0.85);
  const [boundary, setBoundary] = useState({ start: -1, length: 0 });
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => () => {
    try { utteranceRef.current = null; } catch { /* no-op */ }
  }, []);

  function play() {
    if (!("speechSynthesis" in window)) return;
    try {
      const synthesis = window.speechSynthesis;
      synthesis.cancel();
      synthesis.resume();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.rate = rate;
      utteranceRef.current = utterance;
      setBoundary({ start: -1, length: 0 });
      utterance.onstart = () => setSpeaking(true);
      utterance.onboundary = (event) => {
        setBoundary({ start: event.charIndex, length: event.charLength || 1 });
      };
      const finish = () => {
        if (utteranceRef.current === utterance) utteranceRef.current = null;
        setSpeaking(false);
        setBoundary({ start: -1, length: 0 });
      };
      utterance.onend = finish;
      utterance.onerror = finish;
      synthesis.speak(utterance);
    } catch {
      setSpeaking(false);
      utteranceRef.current = null;
    }
  }

  return (
    <div className={`inline-flex max-w-full flex-col items-center gap-2 ${className}`}>
      <button type="button" onClick={play} className="inline-flex max-w-full items-center gap-3" aria-label={t("speak.play", { text })}>
        <span className={`break-words text-left ${speaking ? "border-b-2 border-brand-500" : ""}`}>
          {Array.from(text).map((character, index) => {
            const active = speaking && boundary.start >= 0 && index >= boundary.start && index < boundary.start + boundary.length;
            return <span key={`${character}-${index}`} className={active ? "rounded bg-brand-200 px-0.5 dark:bg-brand-700" : ""}>{character}</span>;
          })}
        </span>
        <span aria-hidden="true" className="shrink-0 text-xl">🔊</span>
      </button>
      <span className="flex items-center gap-1 text-xs font-bold text-slate-400" aria-label={t("speak.speed")}>
        {t("speak.speed")}
        {SPEECH_RATES.map((option) => (
          <button key={option} type="button" onClick={() => setRate(option)} className={`rounded px-1.5 py-0.5 ${rate === option ? "bg-brand-100 text-brand-700 dark:bg-brand-900/50 dark:text-brand-200" : "hover:bg-slate-100 dark:hover:bg-slate-800"}`}>
            {option}x
          </button>
        ))}
      </span>
    </div>
  );
}

export function SpeakButton({ text, compact = false }: { text: string; compact?: boolean }) {
  const { course, t } = useApp();
  return (
    <button
      type="button"
      onClick={() => speak(text, course?.speechLocale ?? "en-US")}
      className={compact ? "shrink-0 rounded-lg px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800" : "btn btn-ghost"}
      aria-label={t("speak.play", { text })}
      title={t("speak.playShort")}
    >
      🔊{compact ? "" : ` ${t("speak.playShort")}`}
    </button>
  );
}
