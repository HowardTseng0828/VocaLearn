"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  api,
  type AiCard,
  type AnswerResult,
  type QuizMode,
  type QuizQuestion,
} from "@/lib/api";

type Phase = "loading" | "active" | "feedback" | "done" | "empty";

const MODE_LABEL: Record<QuizMode, string> = {
  en2zh: "英翻中",
  zh2en: "中翻英",
  spell: "拼字測驗",
  cloze: "AI 填空",
};

export function Quiz() {
  const params = useSearchParams();
  const mode = params.get("mode") ?? "random";
  const review = params.get("review") === "1";
  const daily = params.get("daily") === "1";
  const count = daily ? 15 : 10;

  const [phase, setPhase] = useState<Phase>("loading");
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [typed, setTyped] = useState("");
  const [aiCard, setAiCard] = useState<AiCard | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const current = questions[index];

  // Load the question set.
  useEffect(() => {
    let cancelled = false;
    setPhase("loading");
    api
      .generateQuiz(mode, count, review)
      .then(({ questions }) => {
        if (cancelled) return;
        if (questions.length === 0) {
          setPhase("empty");
        } else {
          setQuestions(questions);
          setPhase("active");
        }
      })
      .catch(() => !cancelled && setPhase("empty"));
    return () => {
      cancelled = true;
    };
  }, [mode, review, count]);

  // For cloze questions, fetch the AI sentence when the question changes.
  useEffect(() => {
    setAiCard(null);
    setTyped("");
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
      setPhase("done");
    } else {
      setIndex((i) => i + 1);
      setPhase("active");
    }
  }, [index, questions.length]);

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
          <button
            onClick={() => {
              setIndex(0);
              setScore(0);
              setResult(null);
              setPhase("loading");
              api
                .generateQuiz(mode, count, review)
                .then(({ questions }) => {
                  setQuestions(questions);
                  setPhase(questions.length ? "active" : "empty");
                })
                .catch(() => setPhase("empty"));
            }}
            className="btn btn-primary flex-1"
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
          submitting={submitting}
          inputRef={inputRef}
          onSubmit={submit}
        />
      </div>

      {phase === "feedback" && result && (
        <Feedback result={result} onNext={next} />
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
  submitting,
  inputRef,
  onSubmit,
}: {
  q: QuizQuestion;
  phase: Phase;
  result: AnswerResult | null;
  typed: string;
  setTyped: (s: string) => void;
  aiCard: AiCard | null;
  aiLoading: boolean;
  submitting: boolean;
  inputRef: React.RefObject<HTMLInputElement>;
  onSubmit: (answer: string) => void;
}) {
  const locked = phase === "feedback";

  // Multiple choice (en2zh / zh2en)
  if (q.mode === "en2zh" || q.mode === "zh2en") {
    const prompt = q.mode === "en2zh" ? q.word : q.meaning;
    const sub = q.mode === "en2zh" ? q.pos : "請選出對應的英文單字";
    return (
      <div>
        <div className="card mb-5 p-8 text-center">
          <div className="text-3xl font-extrabold break-words">{prompt}</div>
          {q.mode === "en2zh" && q.pos && (
            <div className="mt-1 text-sm font-bold text-slate-400">{q.pos}</div>
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
        inputRef={inputRef}
        onSubmit={onSubmit}
      />
    );
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
            {locked && aiCard?.translation && (
              <p className="mt-3 border-t border-slate-100 pt-3 text-sm text-slate-500 dark:border-slate-800">
                {aiCard.translation}
              </p>
            )}
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
      />
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
  inputRef,
  onSubmit,
}: {
  placeholder: string;
  typed: string;
  setTyped: (s: string) => void;
  locked: boolean;
  submitting: boolean;
  inputRef: React.RefObject<HTMLInputElement>;
  onSubmit: (a: string) => void;
}) {
  return (
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
    </form>
  );
}

function Feedback({
  result,
  onNext,
}: {
  result: AnswerResult;
  onNext: () => void;
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
      <button onClick={onNext} className="btn btn-primary mt-4 w-full">
        下一題 →
      </button>
    </div>
  );
}
