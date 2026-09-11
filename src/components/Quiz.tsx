"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  api,
  type AiCard,
  type AnswerResult,
  type QuizMode,
  type QuizQuestion,
  formatPartOfSpeech,
} from "@/lib/api";
import { PronunciationText } from "@/components/SpeakButton";

type Phase = "loading" | "active" | "feedback" | "done" | "empty";

const MODE_LABEL: Record<QuizMode, string> = {
  en2zh: "英翻中",
  zh2en: "中翻英",
  spell: "拼字測驗",
  cloze: "AI 填空",
  speech: "口說練習",
};

export function Quiz() {
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
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
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
      .then(async ({ questions }) => {
        if (cancelled) return;
        if (questions.length === 0) {
          setPhase("empty");
        } else {
          setQuestions(questions);
          if (chapter) {
            const progress = await api.chapterProgress(chapter).catch(() => ({ questionIndex: 0 }));
            if (!cancelled) setIndex(Math.min(progress.questionIndex, questions.length - 1));
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
        .aiExample(current.wordId)
        .then(setAiCard)
        .catch(() => setAiCard(null))
        .finally(() => setAiLoading(false));
    }
    // Focus the input for typed modes.
    if (current && (current.mode === "spell" || current.mode === "zh2en")) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [current]);

  const submit = useCallback(
    async (answer: string) => {
      if (!current || submitting) return;
      setSubmitting(true);
      try {
        const res = await api.answer(current.wordId, current.mode, answer);
        setResult(res);
        if (res.correct) setScore((s) => s + 1);
        setPhase("feedback");
      } catch {
        /* ignore — let the user retry */
      } finally {
        setSubmitting(false);
      }
    },
    [current, submitting]
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
      <div className="card mx-auto max-w-md p-8 text-center animate-bounce-in">
        <div className="text-5xl">🎉</div>
        <h2 className="mt-3 text-xl font-extrabold">
          {review ? "沒有待複習的錯題！" : "目前沒有題目"}
        </h2>
        <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
          {review ? "錯題本是空的，太厲害了。" : "請先匯入單字或稍後再試。"}
        </p>
        <Link href="/" className="btn btn-primary mt-5">
          回首頁
        </Link>
      </div>
    );
  }

  if (phase === "done") {
    const pct = Math.round((score / questions.length) * 100);
    return (
      <div className="card mx-auto max-w-md p-8 text-center animate-bounce-in">
        <div className="text-6xl">{pct >= 80 ? "🏆" : pct >= 50 ? "🎉" : "💪"}</div>
        <h2 className="mt-3 text-2xl font-extrabold">完成！</h2>
        <div className="mx-auto mt-4 w-fit rounded-2xl bg-brand-50 px-6 py-3 dark:bg-brand-900/30">
          <div className="text-3xl font-extrabold text-brand-600 dark:text-brand-300">
            {score}
            <span className="text-lg font-bold text-slate-400"> / {questions.length}</span>
          </div>
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
            正確率 {pct}%
          </div>
        </div>
        <div className="mt-6 flex gap-3">
          {nextChapter && (
            <Link href={`/practice?mode=${chapterMode(nextChapter)}&chapter=${nextChapter}`} className="btn btn-primary flex-1">
              下一章節 →
            </Link>
          )}
          <button
            onClick={() => {
              setIndex(0);
              setScore(0);
              setResult(null);
              setPhase("loading");
              api
                .generateQuiz(mode, count, review, chapter, reviewCorrect)
                .then(({ questions }) => {
                  setQuestions(questions);
                  setPhase(questions.length ? "active" : "empty");
                })
                .catch(() => setPhase("empty"));
            }}
            className="btn btn-ghost flex-1"
          >
            再來一組
          </button>
          <Link href="/" className="btn btn-ghost flex-1">
            回首頁
          </Link>
        </div>
      </div>
    );
  }

  if (!current) return null;

  const progress = ((index + (phase === "feedback" ? 1 : 0)) / questions.length) * 100;

  return (
    <div className="mx-auto max-w-xl">
      {/* Progress header */}
      <div className="mb-4 flex items-center justify-between text-sm">
        <Link href="/" className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
          ← 離開
        </Link>
        <span className="font-medium">
          {MODE_LABEL[current.mode]}
          {review && " · 複習"}
        </span>
        <span className="text-slate-500">
          {index + 1} / {questions.length}
        </span>
      </div>
      <div className="progress-track shimmer mb-6">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>

      <div key={index} className="animate-fade-in">
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
  const locked = phase === "feedback";

  // Multiple choice (en2zh / zh2en)
  if (q.mode === "en2zh" || q.mode === "zh2en") {
    const prompt = q.mode === "en2zh" ? q.word : q.meaning;
    const sub = q.mode === "en2zh" ? q.pos : "請選出對應的英文單字";
    return (
      <div>
        <div className="card mb-5 p-8 text-center">
          <div className="flex flex-wrap items-center justify-center gap-3">
            {q.mode === "en2zh" ? <PronunciationText text={q.word} className="text-3xl font-extrabold" /> : <div className="text-3xl font-extrabold break-words">{prompt}</div>}
          </div>
          {q.mode === "en2zh" && q.pos && (
            <div className="mt-1 text-sm font-bold text-slate-400">{formatPartOfSpeech(q.pos, q.meaning)}</div>
          )}
          {q.mode === "zh2en" && (
            <div className="mt-1 text-sm font-bold text-slate-400">{sub}</div>
          )}
        </div>
        <div className="grid gap-3">
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

  // Spell (type the English word from the meaning)
  if (q.mode === "spell") {
    return (
      <TypePrompt
        title={q.meaning}
        subtitle={q.pos ? `${q.pos} · 請拼出英文單字` : "請拼出英文單字"}
        placeholder="輸入英文單字…"
        typed={typed}
        setTyped={setTyped}
        locked={locked}
        submitting={submitting}
        hintCount={hintCount}
        setHintCount={setHintCount}
        hintWord={q.word}
        inputRef={inputRef}
        onSubmit={onSubmit}
      />
    );
  }

  if (q.mode === "speech") {
    return <SpeechPrompt q={q} locked={locked} submitting={submitting} onSubmit={onSubmit} onSwitchMode={onSwitchSpeech} />;
  }

  // Cloze (AI sentence with a blank)
  return (
    <div>
      <div className="card mb-5 border-pink-200 p-6 dark:border-pink-900/40">
        <div className="mb-2 flex items-center gap-2 text-xs font-extrabold text-mode-pink">
          <span>🤖 AI 例句填空</span>
          {aiCard?.source === "mock" && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500 dark:bg-slate-800">
              示範模式
            </span>
          )}
        </div>
        {aiLoading ? (
          <div className="flex items-center gap-2 py-4 text-sm text-slate-400">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-400 border-t-transparent" />
            AI 產生例句中…
          </div>
        ) : (
          <>
            <p className="text-lg leading-relaxed">
              {aiCard?.cloze ?? `Fill in the blank: _____ (${q.meaning})`}
            </p>
            <p className="mt-2 text-sm text-slate-400">
              提示：{q.meaning}
              {q.pos && ` (${q.pos})`}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="btn btn-ghost !py-2 text-xs"
                disabled={locked || hintCount >= Math.min(q.word.length, 3)}
                onClick={() => setHintCount(Math.min(hintCount + 1, Math.min(q.word.length, 3)))}
              >
                💡 顯示提示字母
              </button>
              {hintCount > 0 && (
                <span className="rounded-lg bg-amber-50 px-3 py-2 font-mono text-sm font-bold tracking-widest text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                  {Array.from(q.word).map((char, i) => (char === " " ? " " : i < hintCount ? char : "_"))}
                </span>
              )}
            </div>
            {locked && aiCard?.translation && (
              <p className="mt-3 border-t border-slate-100 pt-3 text-sm text-slate-500 dark:border-slate-800">
                {aiCard.translation}
              </p>
            )}
            {(aiCard?.synonyms?.length || aiCard?.antonyms?.length) ? (
              <div className="mt-3 grid gap-2 border-t border-slate-100 pt-3 text-sm dark:border-slate-800 sm:grid-cols-2">
                {aiCard.synonyms?.length ? <div><span className="font-extrabold text-brand-600 dark:text-brand-300">同義詞：</span>{aiCard.synonyms.join(", ")}</div> : null}
                {aiCard.antonyms?.length ? <div><span className="font-extrabold text-red-600 dark:text-red-300">反義詞：</span>{aiCard.antonyms.join(", ")}</div> : null}
              </div>
            ) : null}
          </>
        )}
      </div>
      <InlineTypeInput
        placeholder="填入缺少的單字…"
        typed={typed}
        setTyped={setTyped}
        locked={locked}
        submitting={submitting || aiLoading}
        inputRef={inputRef}
        onSubmit={onSubmit}
        hintCount={hintCount}
        setHintCount={setHintCount}
        hintWord={q.word}
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
      setSpeechError("這個瀏覽器不支援語音辨識，請改用 Chrome、Edge 或 Android 瀏覽器。");
      return;
    }

    setSpeechError("");
    setTranscriptPreview("");
    setSpeechRate(null);
    setIsListening(true);
    startedAtRef.current = Date.now();
    const recognition = new Recognition();
    recognitionRef.current = recognition;
    recognition.lang = "en-US";
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
    recognition.onerror = () => setSpeechError("沒有辨識到聲音，請允許麥克風權限後再試一次。");
    recognition.onend = () => {
      if (recognitionRef.current === recognition) recognitionRef.current = null;
      setIsListening(false);
    };
    recognition.onerror = () => {
      recognitionRef.current = null;
      setIsListening(false);
      setSpeechError("語音辨識失敗，請確認 iPhone 麥克風權限後再試一次。");
    };
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setIsListening(false);
      setSpeechError("語音辨識目前無法啟動，請重新點擊或改用 Safari/Chrome。");
    }
  }

  return (
    <div className="card p-8 text-center">
      <div className="text-sm font-bold text-slate-400">請先聽發音，再念出這個單字</div>
      <PronunciationText text={q.word} className="mt-3 text-4xl font-extrabold" />
      <div className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">{q.pos} · {q.meaning}</div>
      <div className="mt-6 flex justify-center gap-3">
        <button type="button" className="btn btn-primary" disabled={locked || submitting} onClick={isListening ? stopListening : startListening}>
          {isListening ? "🎙️ 聆聽中…" : "🎤 開始口說"}
        </button>
      </div>
      {onSwitchMode && <button type="button" className="btn btn-ghost mt-3 !py-2 text-xs" onClick={onSwitchMode}>現在不方便講話，改用英翻中</button>}
      <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-left dark:bg-slate-800">
        <div className="text-xs font-extrabold text-slate-400">即時辨識預覽</div>
        <p className="mt-2 min-h-6 text-lg font-bold text-slate-700 dark:text-slate-200">{transcriptPreview || "按下開始口說後，這裡會顯示辨識文字"}</p>
        {speechRate !== null && <p className="mt-2 text-xs font-bold text-slate-500 dark:text-slate-400">語速約 {speechRate.toFixed(1)} 字元／秒・{speechRate >= 3 ? "速度偏快" : speechRate >= 1.2 ? "速度適中" : "可以再加快"}</p>}
      </div>
      {speechError && <p className="mt-4 text-sm font-bold text-red-500">{speechError}</p>}
    </div>
  );
}

function TypePrompt(props: {
  title: string;
  subtitle: string;
  placeholder: string;
  typed: string;
  setTyped: (s: string) => void;
  locked: boolean;
  submitting: boolean;
  hintCount: number;
  setHintCount: (count: number) => void;
  hintWord: string;
  inputRef: React.RefObject<HTMLInputElement>;
  onSubmit: (a: string) => void;
}) {
  return (
    <div>
      <div className="card mb-5 p-8 text-center">
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
  hintWord,
  hintCount = 0,
  setHintCount,
  inputRef,
  onSubmit,
}: {
  placeholder: string;
  typed: string;
  setTyped: (s: string) => void;
  locked: boolean;
  submitting: boolean;
  hintCount?: number;
  setHintCount?: (count: number) => void;
  hintWord?: string;
  inputRef: React.RefObject<HTMLInputElement>;
  onSubmit: (a: string) => void;
}) {
  return (
    <div>
    {setHintCount && <div className="mb-3 flex items-center gap-3">
      <button type="button" className="btn btn-ghost !py-1.5 text-xs" disabled={locked || hintCount >= Math.min(hintWord?.length ?? 0, 3)} onClick={() => setHintCount(Math.min(hintCount + 1, 3))}>💡 顯示提示字母</button>
      {hintCount > 0 && <span className="font-mono text-sm font-bold tracking-widest text-amber-700 dark:text-amber-300">提示：{Array.from(hintWord ?? "").map((char, i) => char === " " ? " " : i < hintCount ? char : "_").join("")}</span>}
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
        className="input flex-1 text-center text-lg"
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
        className="btn btn-primary"
        disabled={locked || submitting || !typed.trim()}
      >
        送出
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
  return (
    <div
      className={`mt-5 rounded-2xl border-2 p-5 animate-fade-in ${
        result.correct
          ? "border-brand-200 bg-brand-50 dark:border-brand-900/50 dark:bg-brand-950/20"
          : "border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/20"
      }`}
    >
      <div className="flex items-center gap-2">
        {result.correct ? (
          <span className="flex items-center gap-2 text-lg font-extrabold text-brand-600 dark:text-brand-400">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-500 text-white">
              ✓
            </span>
            答對了！
          </span>
        ) : (
          <span className="flex items-center gap-2 text-lg font-extrabold text-red-600 dark:text-red-400">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-mode-red text-white">
              ✗
            </span>
            答錯了
          </span>
        )}
        {result.mastered && (
          <span className="ml-auto animate-bounce-in rounded-full bg-mode-gold px-2.5 py-1 text-xs font-extrabold text-white">
            ⭐ 已精熟
          </span>
        )}
      </div>
      <div className="mt-3 text-sm font-medium">
        <div>
          <span className="font-extrabold">{result.word}</span> — {result.meaning}
        </div>
        {!result.correct && (
          <div className="mt-1 text-slate-500 dark:text-slate-400">
            正解：<span className="font-extrabold text-brand-600 dark:text-brand-300">{result.expected}</span>
          </div>
        )}
      </div>
      <div className="mt-4 flex gap-3">
        {!result.correct && <button onClick={onRetry} className="btn btn-ghost flex-1">再試一次</button>}
      <button onClick={onNext} className="btn btn-primary mt-4 flex-1">
        下一題 →
      </button></div>
    </div>
  );
}
