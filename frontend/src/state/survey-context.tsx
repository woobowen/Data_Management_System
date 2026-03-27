import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';

import { fetchSurveyDefinition, submitSurveyResponse } from '../lib/api';
import { replayFromStart, type QuestionType } from './survey-engine';
import {
  getInitialSurveyState,
  selectCurrentQuestion,
  selectSubmitPayload,
  surveyReducer,
  type SurveyState,
} from './survey-reducer';

type SurveyContextValue = {
  state: SurveyState;
  currentQuestion: ReturnType<typeof selectCurrentQuestion>;
  loadSurvey: (surveyId: string) => Promise<void>;
  updateRawInput: (questionId: string, value: unknown) => void;
  commitAnswer: (questionId: string, value: unknown, answerType: QuestionType) => void;
  retrieveHistory: (questionId: string) => void;
  nextPage: () => void;
  markArchiveComplete: (questionId: string) => void;
  markTrashComplete: (questionId: string) => void;
  markRetrieveComplete: (questionId: string) => void;
  freezeArchiveItem: (questionId: string) => void;
  startComposition: () => void;
  endComposition: (questionId: string, value: unknown, answerType: QuestionType) => void;
  startErasing: (questionId: string) => void;
  stopErasing: (questionId: string) => void;
  submit: () => Promise<void>;
};

const SurveyContext = createContext<SurveyContextValue | null>(null);

export function SurveyProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(surveyReducer, undefined, getInitialSurveyState);
  const previousPathRef = useRef<string[]>([]);

  const loadSurvey = useCallback(async (surveyId: string) => {
    const survey = await fetchSurveyDefinition(surveyId);
    dispatch({ type: 'SURVEY_LOADED', survey });
  }, []);

  const updateRawInput = useCallback((questionId: string, value: unknown) => {
    dispatch({ type: 'RAW_INPUT_CHANGED', questionId, value });
  }, []);

  const commitAnswer = useCallback((questionId: string, value: unknown, answerType: QuestionType) => {
    startTransition(() => {
      dispatch({ type: 'COMMIT_ANSWER', questionId, value, answerType });
    });
  }, []);

  const retrieveHistory = useCallback((questionId: string) => {
    dispatch({ type: 'REQUEST_RETRIEVE_HISTORY', questionId });
  }, []);

  const nextPage = useCallback(() => {
    dispatch({ type: 'GO_NEXT' });
  }, []);

  const markArchiveComplete = useCallback((questionId: string) => {
    dispatch({ type: 'ANIMATION_ARCHIVE_COMPLETE', questionId });
  }, []);

  const markTrashComplete = useCallback((questionId: string) => {
    dispatch({ type: 'ANIMATION_TRASH_COMPLETE', questionId });
  }, []);

  const markRetrieveComplete = useCallback((questionId: string) => {
    dispatch({ type: 'ANIMATION_RETRIEVE_COMPLETE', questionId });
  }, []);

  const freezeArchiveItem = useCallback((questionId: string) => {
    dispatch({ type: 'FREEZE_ARCHIVE_ITEM', questionId });
  }, []);

  const startComposition = useCallback(() => {
    dispatch({ type: 'IME_COMPOSITION_STARTED' });
  }, []);

  const endComposition = useCallback(
    (questionId: string, value: unknown, answerType: QuestionType) => {
      dispatch({ type: 'IME_COMPOSITION_ENDED', questionId, value });
      startTransition(() => {
        dispatch({ type: 'COMMIT_ANSWER', questionId, value, answerType });
      });
    },
    [],
  );

  const startErasing = useCallback((questionId: string) => {
    dispatch({ type: 'START_ERASING', questionId });
  }, []);

  const stopErasing = useCallback((questionId: string) => {
    dispatch({ type: 'STOP_ERASING', questionId });
  }, []);

  const submit = useCallback(async () => {
    if (!state.engine.survey) {
      return;
    }

    dispatch({ type: 'PRUNE_GHOST_ANSWERS' });
    dispatch({ type: 'SUBMIT_STARTED' });
    try {
      const replay = replayFromStart(state.engine.answerMap, state.engine.survey);
      const payload = selectSubmitPayload(state);
      await submitSurveyResponse(state.engine.survey.surveyId, payload.length ? payload : []);
      if (replay.hasLoop) {
        throw new Error('问卷路径存在循环，已中断提交。');
      }
      dispatch({ type: 'SUBMIT_SUCCEEDED' });
    } catch (error) {
      const message = error instanceof Error ? error.message : '提交失败';
      dispatch({ type: 'SUBMIT_FAILED', message });
    }
  }, [state]);

  useEffect(() => {
    const previousPath = previousPathRef.current;
    const nextPath = state.engine.canonicalPath;
    const previousSet = new Set(previousPath);
    const nextSet = new Set(nextPath);
    const trashIds = previousPath.filter((questionId) => !nextSet.has(questionId));

    if (trashIds.length > 0) {
      dispatch({ type: 'QUEUE_TRASH_ITEMS', questionIds: trashIds });
    }

    previousPathRef.current = [...nextPath];

    if (state.engine.currentQuestionId && previousSet.has(state.engine.currentQuestionId) && !nextSet.has(state.engine.currentQuestionId)) {
      const fallbackQuestionId = nextPath[nextPath.length - 1] ?? null;
      if (fallbackQuestionId) {
        dispatch({ type: 'REQUEST_RETRIEVE_HISTORY', questionId: fallbackQuestionId });
      }
    }
  }, [state.engine.canonicalPath, state.engine.currentQuestionId]);

  const currentQuestion = useMemo(() => selectCurrentQuestion(state), [state]);

  const value = useMemo<SurveyContextValue>(
    () => ({
      state,
      currentQuestion,
      loadSurvey,
      updateRawInput,
      commitAnswer,
      retrieveHistory,
      nextPage,
      markArchiveComplete,
      markTrashComplete,
      markRetrieveComplete,
      freezeArchiveItem,
      startComposition,
      endComposition,
      startErasing,
      stopErasing,
      submit,
    }),
    [
      state,
      currentQuestion,
      loadSurvey,
      updateRawInput,
      commitAnswer,
      retrieveHistory,
      nextPage,
      markArchiveComplete,
      markTrashComplete,
      markRetrieveComplete,
      freezeArchiveItem,
      startComposition,
      endComposition,
      startErasing,
      stopErasing,
      submit,
    ],
  );

  return <SurveyContext.Provider value={value}>{children}</SurveyContext.Provider>;
}

export function useSurvey() {
  const context = useContext(SurveyContext);
  if (!context) {
    throw new Error('useSurvey must be used within SurveyProvider');
  }
  return context;
}
