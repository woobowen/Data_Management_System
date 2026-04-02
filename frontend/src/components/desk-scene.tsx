import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';

import { ApiClientError } from '../lib/api';
import { useAuth } from '../contexts/auth-context';
import { useSurvey } from '../state/survey-context';
import type { QuestionValue } from '../state/survey-engine';
import { QuestionFields } from './question-fields';

const COMPLETION_CARD_ID = '__completion__';

type FlipPhase = 'idle' | 'forward-out' | 'forward-in' | 'backward-out' | 'backward-in';

function getQuestionById(questions: QuestionValue[], questionId: string | null) {
  if (!questionId) {
    return null;
  }
  return questions.find((question) => question.questionId === questionId) ?? null;
}

function CompletionSheet({ onReopen }: { onReopen: () => void }) {
  return (
    <div className="flex min-h-[620px] flex-col justify-between">
      <div className="space-y-5">
        <motion.p
          initial={{ opacity: 0, filter: 'blur(4px)', y: 8 }}
          animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
          transition={{ duration: 0.55 }}
          className="font-body text-xs uppercase tracking-[0.34em] text-ink/38"
        >
          已完成卷页
        </motion.p>
        <motion.h2
          initial={{ opacity: 0, filter: 'blur(4px)', y: 8 }}
          animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
          transition={{ duration: 0.7, delay: 0.06 }}
          className="font-hand text-[3.6rem] leading-none ink-text"
        >
          笔录已经写毕
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, filter: 'blur(4px)', y: 8 }}
          animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
          transition={{ duration: 0.75, delay: 0.12 }}
          className="max-w-2xl font-hand text-[1.95rem] leading-[1.65] text-ink/80"
        >
          所有可达页都已按既定路径写入。如需补写旧页，可从下方轻轻翻回，重新校正文辞与答案。
        </motion.p>
      </div>

      <div className="space-y-6">
        <div className="rounded-[2rem] bg-[#f5f2ec] px-6 py-5 shadow-emboss-soft">
          <p className="font-body text-xs uppercase tracking-[0.24em] text-ink/38">卷宗状态</p>
          <p className="mt-2 font-hand text-[2.1rem] ink-text">待主理人审阅</p>
        </div>
        <button
          type="button"
          onClick={onReopen}
          className="font-hand text-[1.9rem] text-ink/72 transition hover:text-ink"
        >
          翻回上一页
        </button>
      </div>
    </div>
  );
}

export function DeskScene() {
  const {
    state,
    loadSurvey,
    updateRawInput,
    commitAnswer,
    retrieveHistory,
    nextPage,
    markArchiveComplete,
    markRetrieveComplete,
    startComposition,
    endComposition,
    startErasing,
    stopErasing,
    submit,
  } = useSurvey();

  const [displayedQuestionId, setDisplayedQuestionId] = useState<string | null>(null);
  const [flipPhase, setFlipPhase] = useState<FlipPhase>('idle');
  const [targetQuestionId, setTargetQuestionId] = useState<string | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const { surveyId = '' } = useParams();
  const location = useLocation();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (!surveyId) {
      setBootError('缺少 surveyId。请通过地址栏传入 `?surveyId=...` 后再打开此页。');
      return;
    }

    let cancelled = false;
    void loadSurvey(surveyId).catch((error) => {
      if (cancelled) {
        return;
      }
      const message = error instanceof ApiClientError ? error.message : '问卷加载失败';
      setBootError(message);
    });

    return () => {
      cancelled = true;
    };
  }, [loadSurvey, surveyId]);

  useEffect(() => {
    if (!displayedQuestionId && state.engine.currentQuestionId) {
      setDisplayedQuestionId(state.engine.currentQuestionId);
    }
    if (!displayedQuestionId && !state.engine.currentQuestionId && state.engine.canonicalPath[0]) {
      setDisplayedQuestionId(state.engine.canonicalPath[0]);
    }
  }, [displayedQuestionId, state.engine.currentQuestionId, state.engine.canonicalPath]);

  const renderedQuestion = useMemo(() => {
    if (!state.engine.survey) {
      return null;
    }
    return getQuestionById(state.engine.survey.questions, displayedQuestionId);
  }, [displayedQuestionId, state.engine.survey]);

  if (bootError) {
    return (
      <div className="living-bg flex min-h-screen items-center justify-center px-6">
        <div className="paper-sheet paper-noise max-w-2xl rounded-md px-8 py-7">
          <p className="font-body text-xs uppercase tracking-[0.34em] text-[#9e4334]">加载失败</p>
          <p className="mt-4 font-hand text-[2.2rem] leading-[1.45] text-[#9e4334]">{bootError}</p>
        </div>
      </div>
    );
  }

  if (!state.engine.survey || (!renderedQuestion && displayedQuestionId !== COMPLETION_CARD_ID)) {
    return (
      <div className="living-bg flex min-h-screen items-center justify-center px-6">
        <div className="paper-sheet paper-noise rounded-md px-8 py-7 font-hand text-[2.3rem] ink-text">
          正在摊开活页羊皮卷……
        </div>
      </div>
    );
  }

  if (!state.engine.survey.allowAnonymous && !isAuthenticated) {
    return (
      <div className="living-bg flex min-h-screen items-center justify-center px-6">
        <div className="paper-sheet paper-noise max-w-2xl rounded-md px-8 py-7">
          <p className="font-body text-xs uppercase tracking-[0.34em] text-ink/38">登录后填写</p>
          <p className="mt-4 font-hand text-[2.2rem] leading-[1.45] ink-text">这份问卷要求登录后填写，请先登录再返回当前链接。</p>
          <div className="mt-6">
            <Link
              to="/login"
              state={{ from: location.pathname }}
              className="inline-flex rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              前往登录
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const questions = state.engine.survey.questions;
  const currentQuestionId = displayedQuestionId === COMPLETION_CARD_ID ? null : displayedQuestionId;
  const currentQuestion = getQuestionById(questions, currentQuestionId);
  const currentValue = currentQuestion ? state.engine.answerMap[currentQuestion.questionId]?.value : undefined;
  const currentRawValue = currentQuestion ? state.input.rawInputState[currentQuestion.questionId] : undefined;
  const isErasing = currentQuestion ? state.input.erasingQuestionIds.includes(currentQuestion.questionId) : false;
  const canonicalIndex = currentQuestionId ? state.engine.canonicalPath.indexOf(currentQuestionId) : state.engine.canonicalPath.length;
  const previousQuestionId =
    displayedQuestionId === COMPLETION_CARD_ID
      ? state.engine.canonicalPath[state.engine.canonicalPath.length - 1] ?? null
      : canonicalIndex > 0
        ? state.engine.canonicalPath[canonicalIndex - 1]
        : null;

  const archiveLabel =
    displayedQuestionId === COMPLETION_CARD_ID
      ? '终页'
      : `第 ${Math.max(canonicalIndex + 1, 1)} 页 / 共 ${Math.max(state.engine.canonicalPath.length, 1)} 页`;

  const handleForwardFlip = () => {
    if (flipPhase !== 'idle') {
      return;
    }

    if (state.engine.currentQuestionId && state.engine.currentQuestionId !== displayedQuestionId) {
      nextPage();
      setTargetQuestionId(state.engine.currentQuestionId);
      setFlipPhase('forward-out');
      return;
    }

    if (state.engine.currentQuestionId === null) {
      nextPage();
      setTargetQuestionId(COMPLETION_CARD_ID);
      setFlipPhase('forward-out');
    }
  };

  const handleBackwardFlip = () => {
    if (!previousQuestionId || flipPhase !== 'idle') {
      return;
    }
    setTargetQuestionId(previousQuestionId);
    setFlipPhase('backward-out');
  };

  const handleFlipAnimationComplete = () => {
    if (flipPhase === 'forward-out') {
      if (targetQuestionId === COMPLETION_CARD_ID) {
        void submit();
      }
      if (targetQuestionId && targetQuestionId !== COMPLETION_CARD_ID) {
        markArchiveComplete(displayedQuestionId ?? targetQuestionId);
      }
      setDisplayedQuestionId(targetQuestionId);
      setFlipPhase('idle');
      setTargetQuestionId(null);
      return;
    }

    if (flipPhase === 'backward-out') {
      if (targetQuestionId) {
        retrieveHistory(targetQuestionId);
        markRetrieveComplete(targetQuestionId);
      }
      setDisplayedQuestionId(targetQuestionId);
      setFlipPhase('idle');
      setTargetQuestionId(null);
      return;
    }

    if (flipPhase === 'forward-in') {
      setFlipPhase('idle');
      setTargetQuestionId(null);
      return;
    }

    if (flipPhase === 'backward-in') {
      setFlipPhase('idle');
      setTargetQuestionId(null);
    }
  };

  const paperAnimate =
    flipPhase === 'forward-out'
      ? { rotateY: -165, x: -16, opacity: 0.86, scale: 0.985 }
      : flipPhase === 'forward-in'
        ? { rotateY: [165, 0], x: [40, 0], opacity: [0.78, 1], scale: [0.985, 1] }
        : flipPhase === 'backward-out'
          ? { rotateY: 165, x: 16, opacity: 0.86, scale: 0.985 }
          : flipPhase === 'backward-in'
            ? { rotateY: [-165, 0], x: [-40, 0], opacity: [0.78, 1], scale: [0.985, 1] }
            : { rotateY: 0, x: 0, opacity: 1, scale: 1 };

  return (
    <div className="living-bg min-h-screen overflow-hidden px-4 py-6 text-ink md:px-10 md:py-8">
      <section className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-[1100px] flex-col">
        <header className="mb-8 flex items-start justify-between gap-6">
          <div>
            <p className="font-body text-xs uppercase tracking-[0.36em] text-ink/34">活页羊皮卷</p>
            <h1 className="mt-3 font-hand text-[3.4rem] leading-none ink-text">{state.engine.survey.title}</h1>
            <p className="mt-3 max-w-2xl font-body text-sm leading-7 text-ink/58">{state.engine.survey.description}</p>
          </div>
          <div className="rounded-md bg-[#f5f3ee] px-5 py-4 shadow-emboss-soft">
            <p className="font-body text-[11px] uppercase tracking-[0.26em] text-ink/34">案件编号</p>
            <p className="mt-2 font-hand text-[2rem] ink-text">
              {displayedQuestionId === COMPLETION_CARD_ID ? '封卷' : currentQuestion?.questionId}
            </p>
          </div>
        </header>

        <main className="parchment-stage relative flex flex-1 items-center justify-center">
          <motion.article
            key={displayedQuestionId ?? COMPLETION_CARD_ID}
            initial={false}
            animate={paperAnimate}
            transition={{ duration: 0.88, ease: [0.22, 0.76, 0.2, 1] }}
            onAnimationComplete={handleFlipAnimationComplete}
            style={{ transformOrigin: flipPhase.startsWith('forward') ? 'left center' : 'right center' }}
            className="paper-sheet paper-noise relative min-h-[680px] w-full max-w-[760px] rounded-md px-8 pb-12 pt-10 md:px-12 md:pb-14 md:pt-12"
          >
            <div className="paper-halo absolute inset-[2.6rem] rounded-sm" />
            <div className="relative z-10">
              {displayedQuestionId === COMPLETION_CARD_ID ? (
                <CompletionSheet onReopen={handleBackwardFlip} />
              ) : currentQuestion ? (
                <div className="flex min-h-[600px] flex-col">
                  <div className="mb-8 flex items-start justify-between gap-4">
                    <div className="space-y-4">
                      <motion.p
                        initial={{ opacity: 0, filter: 'blur(4px)', y: 6 }}
                        animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
                        transition={{ duration: 0.55 }}
                        className="font-body text-xs uppercase tracking-[0.28em] text-ink/34"
                      >
                        {archiveLabel}
                      </motion.p>
                      <motion.h2
                        initial={{ opacity: 0, filter: 'blur(4px)', y: 8 }}
                        animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
                        transition={{ duration: 0.78, delay: 0.05 }}
                        className="max-w-2xl font-hand text-[2.95rem] leading-[1.12] ink-text"
                      >
                        {currentQuestion.title}
                      </motion.h2>
                    </div>

                    <motion.div
                      initial={{ opacity: 0, filter: 'blur(4px)', y: 6 }}
                      animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
                      transition={{ duration: 0.65, delay: 0.08 }}
                      className="rounded-md bg-[#f6f4ee] px-5 py-4 shadow-emboss-soft"
                    >
                      <p className="font-body text-[11px] uppercase tracking-[0.22em] text-ink/34">旧档残影</p>
                      <p className="mt-2 font-hand text-[1.85rem] ink-text">{state.engine.unreachableAnswerIds.length} 条</p>
                    </motion.div>
                  </div>

                  <div className="flex-1">
                    <QuestionFields
                      question={currentQuestion}
                      value={currentValue}
                      rawValue={currentRawValue}
                      isErasing={isErasing}
                      disabled={flipPhase !== 'idle'}
                      onImmediateChange={(nextValue) => updateRawInput(currentQuestion.questionId, nextValue)}
                      onCommit={(nextValue) => commitAnswer(currentQuestion.questionId, nextValue, currentQuestion.type)}
                      onCompositionStart={startComposition}
                      onCompositionEnd={(nextValue) => endComposition(currentQuestion.questionId, nextValue, currentQuestion.type)}
                      onErase={() => startErasing(currentQuestion.questionId)}
                      onEraseStop={() => stopErasing(currentQuestion.questionId)}
                    />
                  </div>

                  <div className="mt-10 flex items-end justify-between gap-4">
                    <button
                      type="button"
                      onClick={handleBackwardFlip}
                      disabled={!previousQuestionId || flipPhase !== 'idle'}
                      className="font-hand text-[1.95rem] text-ink/55 transition hover:text-ink disabled:opacity-25"
                    >
                      上一页
                    </button>

                    <button
                      type="button"
                      onClick={handleForwardFlip}
                      disabled={flipPhase !== 'idle'}
                      className="font-hand text-[2.1rem] ink-text transition hover:-translate-y-0.5 hover:scale-[1.015] disabled:opacity-40"
                    >
                      {state.engine.currentQuestionId === null ? '确认印章 / 提交' : '下一页'}
                    </button>
                  </div>

                  {state.submitError ? (
                    <div className="mt-6 rounded-md bg-[#f2ece6] px-5 py-4 font-body text-sm text-[#9e4334] shadow-emboss-soft">
                      {state.submitError}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </motion.article>
        </main>
      </section>
    </div>
  );
}
