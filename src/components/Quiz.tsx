"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  api,
  ApiError,
  type AiCard,
  type AnswerResult,
  type QuizQuestion,
} from "@/lib/api";
import { formatPartOfSpeech } from "@/lib/i18n";
import { useApp } from "@/lib/store";
import { PronunciationText } from "@/components/SpeakButton";

type Phase = "loading" | "active" | "feedback" | "done" | "empty";

export function Quiz() {
  const { t, errorText } = useApp();
  const params = useSearchParams();
  const router = useRouter();
  const mode = params.get("mode") ?? "random";
  const review = params.get("review") === "1";
  const reviewCorrect = params.get("reviewCorrect") === "1";
  const chapter = params.get("chapter") ?? "";
  const daily = params.get("daily") === "1";
  // Each learning-path lesson is a complete 20-word chapter.
  const count = chapter ? 20 : daily ? 15 : 10;
  const nextChapter = (() => {
    const match = /^(\d+)-(\d+)$/.exec(chapter);
    if (!match) return "";
    const unit = Number(match[1]);
    const lesson = Number(match[2]);
    return lesson >= 10 ? `${unit + 1}-1` : `${unit}-${lesson + 1}`;
  })();
  const chapterMode = (key: string) => {
    const match = /^(\d+)-(\d+)$/.exec(key);
    const lessonIndex = match ? (Number(match[1]) - 1) * 10 + Number(match[2]) : 1;
    return lessonIndex <= 10 ? "en2zh" : lessonIndex <= 20 ? "zh2en" : lessonIndex <= 30 ? "spell" : "cloze";
  };

  const [phase, setPhase] = useState<Phase>("loading");
  const [quizId, setQuizId] = useState("");
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [error, setError] = useState("");
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [typed, setTyped] = useState("");
  const [aiCard, setAiCard] = useState<AiCard | null>(null);
  const [hintCount, setHintCount] = useState(0);
  const [aiLoading, setAiLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const current = questions[index];

  // Load the question set.
  useEffect(() => {
    let cancelled = false;
    setPhase("loading");
    api
      .generateQuiz(mode, count, review, chapter, reviewCorrect)
      .then(async ({ quizId, questions }) => {
        if (cancelled) return;
        if (questions.length === 0) {
          setPhase("empty");
        } else {
          setQuizId(quizId);
          setQuestions(questions);
          setError("");
          if (chapter) {
            const progress = await api.chapterProgress(chapter).catch(() => ({ questionIndex: 0 }));
            // A finished chapter (index past the last question) restarts at 0.
            const resumeAt =
              progress.questionIndex >= questions.length ? 0 : progress.questionIndex;
            if (!cancelled) setIndex(Math.max(resumeAt, 0));
          } else {
            setIndex(0);
          }
          setPhase("active");
        }
      })
      .catch(() => !cancelled && setPhase("empty"));
    return () => {
      cancelled = true;
    };
  }, [mode, review, reviewCorrect, count, chapter]);

  // For cloze questions, fetch the AI sentence when the question changes.
  useEffect(() => {
    setAiCard(null);
    setTyped("");
    setHintCount(0);
    setResult(null);
    if (current?.mode === "cloze") {
      setAiLoading(true);
      api
        .aiExample(quizId, current.position)
        .then(setAiCard)
        .catch(() => setAiCard(null))
        .finally(() => setAiLoading(false));
    }
    // Focus the input for typed modes.
    if (current && (current.mode === "spell" || current.mode === "zh2en")) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
    // quizId changes together with questions, so `current` covers it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  const submit = useCallback(
    async (answer: string) => {
      if (!current || submitting) return;
      setSubmitting(true);
      setError("");
      try {
        // The server records only the first answer to each item; a retry is
        // graded without being counted again.
        const res = await api.answer(quizId, current.position, answer);
        setResult(res);
        if (res.recorded && res.correct) setScore((s) => s + 1);
        setPhase("feedback");
      } catch (err) {
        setError(errorText(err));
        if (err instanceof ApiError && err.code === "QUIZ_EXPIRED") setPhase("done");
      } finally {
        setSubmitting(false);
      }
    },
    [current, submitting, quizId, errorText]
  );

  const next = useCallback(() => {
    if (index + 1 >= questions.length) {
      if (chapter) void api.saveChapterProgress(chapter, 0, true);
      setPhase("done");
    } else {
      if (chapter) void api.saveChapterProgress(chapter, index + 1);
      setIndex((i) => i + 1);
      setPhase("active");
    }
  }, [index, questions.length, chapter]);

  // Keyboard: Enter advances on the feedback screen.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (phase === "feedback" && e.key === "Enter") next();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, next]);

  if (phase === "loading") {
    return (
      <div className="flex justify-center py-24">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  if (phase === "empty") {
    return (
      <div className="card mx-auto max-w-md p-6 text-center animate-bounce-in sm:p-8">
        <div className="text-5xl">{reviewCorrect ? "📚" : "🎉"}</div>
        <h2 className="mt-3 text-2xl font-extrabold">
          {reviewCorrect ? t("quiz.emptyCorrectTitle") : review ? t("quiz.emptyReviewTitle") : t("quiz.emptyTitle")}
        </h2>
        <p className="mt-2 text-base font-medium text-slate-500 dark:text-slate-400">
          {reviewCorrect ? t("quiz.emptyCorrectBody") : review ? t("quiz.emptyReviewBody") : t("quiz.emptyBody")}
        </p>
        {review || reviewCorrect ? (
          <div className="mt-6 grid gap-3">
            <Link href="/practice?mode=random" className="btn btn-primary w-full !py-4 text-base">
              {t("quiz.startPractice")}
            </Link>
            <Link href="/notebook" className="btn btn-ghost w-full !py-4 text-base">
              {t("quiz.backReview")}
            </Link>
          </div>
        ) : (
          <Link href="/" className="btn btn-primary mt-6 w-full !py-4 text-base">
            {t("common.backHome")}
          </Link>
        )}
      </div>
    );
  }

  if (phase === "done") {
    const pct = Math.round((score / questions.length) * 100);
    return (
      <div className="card mx-auto max-w-md p-6 text-center animate-bounce-in sm:p-8">
        <div className="text-6xl">{pct >= 80 ? "🏆" : pct >= 50 ? "🎉" : "💪"}</div>
        <h2 className="mt-3 text-2xl font-extrabold">{t("quiz.done")}</h2>
        {error && <p className="mt-2 text-sm font-bold text-red-500">{error}</p>}
        <div className="mx-auto mt-4 w-fit rounded-2xl bg-brand-50 px-6 py-3 dark:bg-brand-900/30">
          <div className="text-3xl font-extrabold text-brand-600 dark:text-brand-300">
            {score}
            <span className="text-lg font-bold text-slate-400"> / {questions.length}</span>
          </div>
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
            {t("quiz.accuracy", { pct })}
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-2 sm:gap-3">
          {nextChapter && (
            <Link href={`/practice?mode=${chapterMode(nextChapter)}&chapter=${nextChapter}`} className="btn btn-primary w-full sm:w-auto sm:flex-1">
              {t("quiz.nextChapter")}
            </Link>
          )}
          <button
            onClick={() => {
              setIndex(0);
              setScore(0);
              setResult(null);
              setPhase("loading");
              setError("");
              if (chapter) void api.saveChapterProgress(chapter, 0);
              api
                .generateQuiz(mode, count, review, chapter, reviewCorrect)
                .then(({ quizId, questions }) => {
                  setQuizId(quizId);
                  setQuestions(questions);
                  setPhase(questions.length ? "active" : "empty");
                })
                .catch(() => setPhase("empty"));
            }}
            className="btn btn-ghost flex-1"
          >
            {t("quiz.again")}
          </button>
          <Link href="/" className="btn btn-ghost flex-1">
            {t("common.backHome")}
          </Link>
        </div>
      </div>
    );
  }

  if (!current) return null;

  const progress = ((index + (phase === "feedback" ? 1 : 0)) / questions.length) * 100;

  return (
    <div className="mx-auto flex h-full max-w-xl flex-col">
      {/* Progress header */}
      <div className="mb-2 flex shrink-0 items-center justify-between text-sm sm:mb-4">
        <Link href="/" className="-ml-2 rounded-xl px-2 py-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
          {t("quiz.leave")}
        </Link>
        <span className="font-medium">
          {t(`mode.${current.mode}`)}
          {review && t("quiz.reviewSuffix")}
        </span>
        <span className="text-slate-500">
          {index + 1} / {questions.length}
        </span>
      </div>
      <div className="progress-track shimmer mb-3 shrink-0 sm:mb-6">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>

      <div key={index} className="flex min-h-0 flex-1 flex-col animate-fade-in">
      <QuestionBody
          q={current}
          phase={phase}
          result={result}
          typed={typed}
          setTyped={setTyped}
          aiCard={aiCard}
          aiLoading={aiLoading}
          hintCount={hintCount}
          setHintCount={setHintCount}
          submitting={submitting}
          inputRef={inputRef}
          onSubmit={submit}
          onSwitchSpeech={review ? () => router.replace(`/practice?mode=en2zh&review=1${chapter ? `&chapter=${encodeURIComponent(chapter)}` : ""}`) : undefined}
        />
      </div>

      {error && <p className="mt-4 text-sm font-bold text-red-500">{error}</p>}

      {phase === "feedback" && result && (
        <Feedback result={result} onNext={next} onRetry={() => { setResult(null); setTyped(""); setPhase("active"); }} />
      )}
    </div>
  );
}

function QuestionBody({
  q,
  phase,
  result,
  typed,
  setTyped,
  aiCard,
  aiLoading,
  hintCount,
  setHintCount,
  submitting,
  inputRef,
  onSubmit,
  onSwitchSpeech,
}: {
  q: QuizQuestion;
  phase: Phase;
  result: AnswerResult | null;
  typed: string;
  setTyped: (s: string) => void;
  aiCard: AiCard | null;
  aiLoading: boolean;
  hintCount: number;
  setHintCount: (count: number) => void;
  submitting: boolean;
  inputRef: React.RefObject<HTMLInputElement>;
  onSubmit: (answer: string) => void;
  onSwitchSpeech?: () => void;
}) {
  const { t, locale } = useApp();
  const locked = phase === "feedback";
  const pos = q.pos ? formatPartOfSpeech(q.pos, locale) : "";

  // Multiple choice (en2zh: word -> meaning, zh2en: meaning -> word)
  if (q.mode === "en2zh" || q.mode === "zh2en") {
    return (
      <div className="flex flex-1 flex-col">
        <div className="card mb-3 flex min-h-[7rem] flex-1 flex-col items-center justify-center p-5 text-center sm:mb-5 sm:p-8">
          <div className="flex flex-wrap items-center justify-center gap-3">
            {q.mode === "en2zh" ? <PronunciationText text={q.word ?? ""} className="text-3xl font-extrabold" /> : <div className="text-3xl font-extrabold break-words">{q.meaning}</div>}
          </div>
          {q.mode === "en2zh" && pos && (
            <div className="mt-1 text-sm font-bold text-slate-400">{pos}</div>
          )}
          {q.mode === "zh2en" && (
            <div className="mt-1 text-sm font-bold text-slate-400">{t("quiz.chooseWord")}</div>
          )}
        </div>
        <div className="grid shrink-0 gap-3">
          {q.choices?.map((choice) => {
            const isExpected = locked && choice === result?.expected;
            const isWrongPick =
              locked && choice !== result?.expected && choice === typed;
            return (
              <button
                key={choice}
                disabled={locked || submitting}
                onClick={() => {
                  setTyped(choice);
                  onSubmit(choice);
                }}
                className={`choice ${locked ? "choice-locked" : ""} ${
                  isExpected ? "choice-correct" : isWrongPick ? "choice-wrong" : ""
                }`}
              >
                {choice}
                {isExpected && <span className="float-right">✓</span>}
                {isWrongPick && <span className="float-right">✗</span>}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const hintProps = { hint: q.hint ?? "", mask: q.mask ?? "", hintCount, setHintCount };

  // Spell (type the word from the meaning)
  if (q.mode === "spell") {
    return (
      <TypePrompt
        title={q.meaning ?? ""}
        subtitle={pos ? `${pos} · ${t("quiz.spellPrompt")}` : t("quiz.spellPrompt")}
        placeholder={t("quiz.spellPlaceholder")}
        typed={typed}
        setTyped={setTyped}
        locked={locked}
        submitting={submitting}
        inputRef={inputRef}
        onSubmit={onSubmit}
        {...hintProps}
      />
    );
  }

  if (q.mode === "speech") {
    return <SpeechPrompt q={q} locked={locked} submitting={submitting} onSubmit={onSubmit} onSwitchMode={onSwitchSpeech} />;
  }

  // Cloze (AI sentence with a blank)
  return (
    <div className="flex flex-1 flex-col">
      <div className="card mb-3 flex flex-1 flex-col justify-center border-pink-200 p-4 sm:mb-5 sm:p-6 dark:border-pink-900/40">
        <div className="mb-2 flex items-center gap-2 text-xs font-extrabold text-mode-pink">
          <span>{t("quiz.clozeTitle")}</span>
          {aiCard?.source === "mock" && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500 dark:bg-slate-800">
              {t("quiz.demo")}
            </span>
          )}
        </div>
        {aiLoading ? (
          <div className="flex items-center gap-2 py-4 text-sm text-slate-400">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-400 border-t-transparent" />
            {t("quiz.aiLoading")}
          </div>
        ) : (
          <>
            <p className="text-lg leading-relaxed">
              {aiCard?.cloze ?? `_____ (${q.meaning})`}
            </p>
            <p className="mt-2 text-sm text-slate-400">
              {t("quiz.hint", { text: pos ? `${q.meaning} (${pos})` : q.meaning ?? "" })}
            </p>
            {locked && aiCard?.translation && (
              <p className="mt-3 border-t border-slate-100 pt-3 text-sm text-slate-500 dark:border-slate-800">
                {aiCard.translation}
              </p>
            )}
            {(aiCard?.synonyms?.length || aiCard?.antonyms?.length) ? (
              <div className="mt-3 grid gap-2 border-t border-slate-100 pt-3 text-sm dark:border-slate-800 sm:grid-cols-2">
                {aiCard.synonyms?.length ? <div><span className="font-extrabold text-brand-600 dark:text-brand-300">{t("quiz.synonyms")}</span>{aiCard.synonyms.join(", ")}</div> : null}
                {aiCard.antonyms?.length ? <div><span className="font-extrabold text-red-600 dark:text-red-300">{t("quiz.antonyms")}</span>{aiCard.antonyms.join(", ")}</div> : null}
              </div>
            ) : null}
          </>
        )}
      </div>
      <InlineTypeInput
        placeholder={t("quiz.clozePlaceholder")}
        typed={typed}
        setTyped={setTyped}
        locked={locked}
        submitting={submitting || aiLoading}
        inputRef={inputRef}
        onSubmit={onSubmit}
        {...hintProps}
      />
    </div>
  );
}

interface SpeechRecognitionResultEventLike {
  results: { length: number; [index: number]: { isFinal: boolean; 0: { transcript: string } } };
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function SpeechPrompt({ q, locked, submitting, onSubmit, onSwitchMode }: {
  q: QuizQuestion;
  locked: boolean;
  submitting: boolean;
  onSubmit: (answer: string) => void;
  onSwitchMode?: () => void;
}) {
  const { t, locale, course } = useApp();
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState("");
  const [transcriptPreview, setTranscriptPreview] = useState("");
  const [speechRate, setSpeechRate] = useState<number | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const startedAtRef = useRef(0);

  useEffect(() => {
    return () => {
      const recognition = recognitionRef.current;
      recognitionRef.current = null;
      try { recognition?.abort(); } catch { /* iOS may throw after the page is suspended. */ }
    };
  }, []);

  function stopListening() {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    try { recognition?.stop(); } catch { /* already ended */ }
    setIsListening(false);
  }

  function startListening() {
    if (isListening || locked || submitting) return;
    const speechWindow = window as typeof window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setSpeechError(t("quiz.speechUnsupported"));
      return;
    }

    setSpeechError("");
    setTranscriptPreview("");
    setSpeechRate(null);
    setIsListening(true);
    startedAtRef.current = Date.now();
    const recognition = new Recognition();
    recognitionRef.current = recognition;
    recognition.lang = course?.speechLocale ?? "en-US";
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) transcript += event.results[i][0].transcript;
      transcript = transcript.trim();
      setTranscriptPreview(transcript);
      if (!event.results[event.results.length - 1].isFinal) return;
      const elapsed = Math.max((Date.now() - startedAtRef.current) / 1000, 0.1);
      setSpeechRate(transcript.replace(/\s/g, "").length / elapsed);
      recognitionRef.current = null;
      try { recognition.stop(); } catch { /* already ended */ }
      setIsListening(false);
      onSubmit(transcript);
    };
    recognition.onend = () => {
      if (recognitionRef.current === recognition) recognitionRef.current = null;
      setIsListening(false);
    };
    recognition.onerror = () => {
      recognitionRef.current = null;
      setIsListening(false);
      setSpeechError(t("quiz.speechFailed"));
    };
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setIsListening(false);
      setSpeechError(t("quiz.speechStartFailed"));
    }
  }

  const verdict = speechRate === null ? "" : speechRate >= 3 ? t("quiz.rateFast") : speechRate >= 1.2 ? t("quiz.rateOk") : t("quiz.rateSlow");

  return (
    <div className="card flex flex-1 flex-col justify-center p-5 text-center sm:p-8">
      <div className="text-sm font-bold text-slate-400">{t("quiz.speechPrompt")}</div>
      <PronunciationText text={q.word ?? ""} className="mt-3 text-4xl font-extrabold" />
      <div className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">{q.pos ? `${formatPartOfSpeech(q.pos, locale)} · ` : ""}{q.meaning}</div>
      <div className="mt-4 flex justify-center gap-3 sm:mt-6">
        <button type="button" className="btn btn-primary w-full !py-4 text-base sm:w-auto" disabled={locked || submitting} onClick={isListening ? stopListening : startListening}>
          {isListening ? t("quiz.listening") : t("quiz.startSpeaking")}
        </button>
      </div>
      {onSwitchMode && <button type="button" className="btn btn-ghost mt-3 !py-2 text-xs" onClick={onSwitchMode}>{t("quiz.speechSwitch")}</button>}
      <div className="mt-4 rounded-2xl bg-slate-50 p-3 text-left dark:bg-slate-800 sm:mt-5 sm:p-4">
        <div className="text-xs font-extrabold text-slate-400">{t("quiz.preview")}</div>
        <p className="mt-2 min-h-6 text-lg font-bold text-slate-700 dark:text-slate-200">{transcriptPreview || t("quiz.previewPlaceholder")}</p>
        {speechRate !== null && <p className="mt-2 text-xs font-bold text-slate-500 dark:text-slate-400">{t("quiz.speechRate", { rate: speechRate.toFixed(1), verdict })}</p>}
      </div>
      {speechError && <p className="mt-4 text-sm font-bold text-red-500">{speechError}</p>}
    </div>
  );
}

interface HintProps {
  hint: string; // first letters of the answer, revealed one per click
  mask: string; // "_" per character of the answer, spaces kept
  hintCount: number;
  setHintCount: (count: number) => void;
}

function TypePrompt(props: HintProps & {
  title: string;
  subtitle: string;
  placeholder: string;
  typed: string;
  setTyped: (s: string) => void;
  locked: boolean;
  submitting: boolean;
  inputRef: React.RefObject<HTMLInputElement>;
  onSubmit: (a: string) => void;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="card mb-3 flex min-h-[7rem] flex-1 flex-col items-center justify-center p-5 text-center sm:mb-5 sm:p-8">
        <div className="text-2xl font-extrabold break-words">{props.title}</div>
        <div className="mt-1 text-sm font-bold text-slate-400">{props.subtitle}</div>
      </div>
      <InlineTypeInput {...props} />
    </div>
  );
}

function InlineTypeInput({
  placeholder,
  typed,
  setTyped,
  locked,
  submitting,
  hint,
  mask,
  hintCount,
  setHintCount,
  inputRef,
  onSubmit,
}: HintProps & {
  placeholder: string;
  typed: string;
  setTyped: (s: string) => void;
  locked: boolean;
  submitting: boolean;
  inputRef: React.RefObject<HTMLInputElement>;
  onSubmit: (a: string) => void;
}) {
  const { t } = useApp();
  const hintChars = Array.from(hint);
  const revealed = Array.from(mask).map((char, i) => (char === " " ? " " : i < hintCount ? hintChars[i] ?? "_" : "_")).join("");
  return (
    <div>
    {hintChars.length > 0 && <div className="mb-3 flex items-center gap-3">
      <button type="button" className="btn btn-ghost !py-1.5 text-xs" disabled={locked || hintCount >= hintChars.length} onClick={() => setHintCount(Math.min(hintCount + 1, hintChars.length))}>{t("quiz.showHint")}</button>
      {hintCount > 0 && <span className="font-mono text-sm font-bold tracking-widest text-amber-700 dark:text-amber-300">{t("quiz.hint", { text: revealed })}</span>}
    </div>}
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!locked && typed.trim()) onSubmit(typed.trim());
      }}
      className="flex gap-2"
    >
      <input
        ref={inputRef}
        className="input flex-1 !py-4 text-center text-lg"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        placeholder={placeholder}
        disabled={locked}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
      />
      <button
        type="submit"
        className="btn btn-primary !px-6 text-base"
        disabled={locked || submitting || !typed.trim()}
      >
        {t("quiz.submit")}
      </button>
    </form></div>
  );
}

function Feedback({
  result,
  onNext,
  onRetry,
}: {
  result: AnswerResult;
  onNext: () => void;
  onRetry: () => void;
}) {
  const { t } = useApp();
  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-30 rounded-t-3xl border-t-2 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(0,0,0,0.08)] animate-fade-in [&>*]:mx-auto [&>*]:max-w-lg md:static md:mt-5 md:rounded-2xl md:border-2 md:p-5 md:shadow-none md:[&>*]:max-w-none ${
        result.correct
          ? "border-brand-200 bg-brand-50 dark:border-brand-900/50 dark:bg-slate-900 md:dark:bg-brand-950/20"
          : "border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-slate-900 md:dark:bg-red-950/20"
      }`}
    >
      <div className="flex items-center gap-2">
        {result.correct ? (
          <span className="flex items-center gap-2 text-lg font-extrabold text-brand-600 dark:text-brand-400">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-500 text-white">
              ✓
            </span>
            {t("quiz.correct")}
          </span>
        ) : (
          <span className="flex items-center gap-2 text-lg font-extrabold text-red-600 dark:text-red-400">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-mode-red text-white">
              ✗
            </span>
            {t("quiz.wrong")}
          </span>
        )}
        {result.mastered && (
          <span className="ml-auto animate-bounce-in rounded-full bg-mode-gold px-2.5 py-1 text-xs font-extrabold text-white">
            {t("quiz.mastered")}
          </span>
        )}
      </div>
      <div className="mt-3 text-sm font-medium">
        <div>
          <span className="font-extrabold">{result.word}</span> — {result.meaning}
        </div>
        {!result.correct && (
          <div className="mt-1 text-slate-500 dark:text-slate-400">
            {t("quiz.answer")}<span className="font-extrabold text-brand-600 dark:text-brand-300">{result.expected}</span>
          </div>
        )}
      </div>
      <div className="mt-3 flex gap-3 md:mt-4">
        {!result.correct && <button onClick={onRetry} className="btn btn-ghost flex-1 !py-4 text-base">{t("quiz.retry")}</button>}
        <button onClick={onNext} className="btn btn-primary flex-1 !py-4 text-base">
          {t("quiz.next")}
        </button>
      </div>
    </div>
  );
}
