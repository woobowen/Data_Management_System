import { buildSubmitPayload, replayFromStart, type AnswerMap, type AnswerValue, type SurveyDefinition } from './survey-engine';

export type VisualPaperStatus =
  | 'active'
  | 'archived'
  | 'retrieving'
  | 'entering'
  | 'exiting-to-archive'
  | 'exiting-to-trash'
  | 'frozen';

export type ArchiveVisualItem = {
  questionId: string;
  visualKey: string;
  status: VisualPaperStatus;
  stackIndex: number;
  rotation: number;
};

export type InputMeta = {
  isComposing: boolean;
  rawInputState: Record<string, unknown>;
  erasingQuestionIds: string[];
};

export type EngineState = {
  survey: SurveyDefinition | null;
  answerMap: AnswerMap;
  canonicalPath: string[];
  unreachableAnswerIds: string[];
  currentQuestionId: string | null;
};

export type OrchestratorState = {
  archiveVisualItems: ArchiveVisualItem[];
  activePaperId: string | null;
  retrievalTargetId: string | null;
  pendingTrashIds: string[];
  navLocked: boolean;
};

export type SurveyState = {
  engine: EngineState;
  orchestrator: OrchestratorState;
  input: InputMeta;
  isSubmitting: boolean;
  submitError: string | null;
};

export type SurveyEvent =
  | { type: 'SURVEY_LOADED'; survey: SurveyDefinition }
  | { type: 'RAW_INPUT_CHANGED'; questionId: string; value: unknown }
  | { type: 'IME_COMPOSITION_STARTED' }
  | { type: 'IME_COMPOSITION_ENDED'; questionId: string; value: unknown }
  | { type: 'COMMIT_ANSWER'; questionId: string; value: unknown; answerType: AnswerValue['type'] }
  | { type: 'GO_NEXT' }
  | { type: 'REQUEST_RETRIEVE_HISTORY'; questionId: string }
  | { type: 'QUEUE_TRASH_ITEMS'; questionIds: string[] }
  | { type: 'ANIMATION_ARCHIVE_COMPLETE'; questionId: string }
  | { type: 'ANIMATION_TRASH_COMPLETE'; questionId: string }
  | { type: 'ANIMATION_RETRIEVE_COMPLETE'; questionId: string }
  | { type: 'FREEZE_ARCHIVE_ITEM'; questionId: string }
  | { type: 'START_ERASING'; questionId: string }
  | { type: 'STOP_ERASING'; questionId: string }
  | { type: 'PRUNE_GHOST_ANSWERS' }
  | { type: 'SUBMIT_STARTED' }
  | { type: 'SUBMIT_SUCCEEDED' }
  | { type: 'SUBMIT_FAILED'; message: string };

const initialState: SurveyState = {
  engine: {
    survey: null,
    answerMap: {},
    canonicalPath: [],
    unreachableAnswerIds: [],
    currentQuestionId: null,
  },
  orchestrator: {
    archiveVisualItems: [],
    activePaperId: null,
    retrievalTargetId: null,
    pendingTrashIds: [],
    navLocked: false,
  },
  input: {
    isComposing: false,
    rawInputState: {},
    erasingQuestionIds: [],
  },
  isSubmitting: false,
  submitError: null,
};

function rotationForIndex(index: number) {
  const sequence = [-2.2, 1.3, -1.1, 2.1, -0.7, 1.9];
  return sequence[index % sequence.length];
}

function toVisualItems(canonicalPath: string[], currentQuestionId: string | null): ArchiveVisualItem[] {
  return canonicalPath
    .filter((questionId) => questionId !== currentQuestionId)
    .map((questionId, index) => ({
      questionId,
      visualKey: `${questionId}-${index}`,
      status: 'archived' as const,
      stackIndex: index,
      rotation: rotationForIndex(index),
    }));
}

export function getInitialSurveyState(): SurveyState {
  return initialState;
}

export function surveyReducer(state: SurveyState, event: SurveyEvent): SurveyState {
  switch (event.type) {
    case 'SURVEY_LOADED': {
      const replay = replayFromStart({}, event.survey);
      const currentQuestionId = replay.currentReachableQuestionId ?? replay.canonicalPath[0] ?? null;
      return {
        ...state,
        engine: {
          survey: event.survey,
          answerMap: {},
          canonicalPath: replay.canonicalPath,
          unreachableAnswerIds: [],
          currentQuestionId,
        },
        orchestrator: {
          archiveVisualItems: toVisualItems(replay.canonicalPath, currentQuestionId),
          activePaperId: currentQuestionId,
          retrievalTargetId: null,
          pendingTrashIds: [],
          navLocked: false,
        },
        input: {
          ...state.input,
          rawInputState: {},
        },
      };
    }
    case 'RAW_INPUT_CHANGED': {
      return {
        ...state,
        input: {
          ...state.input,
          rawInputState: {
            ...state.input.rawInputState,
            [event.questionId]: event.value,
          },
        },
      };
    }
    case 'IME_COMPOSITION_STARTED':
      return {
        ...state,
        input: {
          ...state.input,
          isComposing: true,
        },
      };
    case 'IME_COMPOSITION_ENDED':
      return {
        ...state,
        input: {
          ...state.input,
          isComposing: false,
          rawInputState: {
            ...state.input.rawInputState,
            [event.questionId]: event.value,
          },
        },
      };
    case 'COMMIT_ANSWER': {
      if (!state.engine.survey) {
        return state;
      }

      const previousValue = state.engine.answerMap[event.questionId]?.value;
      const nextAnswerMap: AnswerMap = {
        ...state.engine.answerMap,
        [event.questionId]: {
          questionId: event.questionId,
          type: event.answerType,
          value: event.value,
        },
      };
      const replay = replayFromStart(nextAnswerMap, state.engine.survey);
      const nextCurrentQuestionId = replay.currentReachableQuestionId;
      const nextArchiveVisualItems = toVisualItems(replay.canonicalPath, nextCurrentQuestionId);

      return {
        ...state,
        engine: {
          ...state.engine,
          answerMap: nextAnswerMap,
          canonicalPath: replay.canonicalPath,
          unreachableAnswerIds: replay.unreachableAnswerIds,
          currentQuestionId: nextCurrentQuestionId,
        },
        orchestrator: {
          ...state.orchestrator,
          activePaperId: nextCurrentQuestionId,
          archiveVisualItems: nextArchiveVisualItems,
        },
        input: {
          ...state.input,
          erasingQuestionIds:
            previousValue !== undefined &&
            typeof previousValue === 'string' &&
            typeof event.value === 'string' &&
            event.value.length < previousValue.length
              ? [...new Set([...state.input.erasingQuestionIds, event.questionId])]
              : state.input.erasingQuestionIds,
        },
        submitError: null,
      };
    }
    case 'GO_NEXT': {
      return {
        ...state,
        orchestrator: {
          ...state.orchestrator,
          navLocked: true,
        },
      };
    }
    case 'REQUEST_RETRIEVE_HISTORY':
      return {
        ...state,
        engine: {
          ...state.engine,
          currentQuestionId: event.questionId,
        },
        orchestrator: {
          ...state.orchestrator,
          retrievalTargetId: event.questionId,
          activePaperId: event.questionId,
          navLocked: true,
          archiveVisualItems: state.orchestrator.archiveVisualItems.map((item) =>
            item.questionId === event.questionId ? { ...item, status: 'retrieving' } : item,
          ),
        },
      };
    case 'QUEUE_TRASH_ITEMS':
      return {
        ...state,
        orchestrator: {
          ...state.orchestrator,
          pendingTrashIds: [...new Set([...state.orchestrator.pendingTrashIds, ...event.questionIds])],
          archiveVisualItems: state.orchestrator.archiveVisualItems.map((item) =>
            event.questionIds.includes(item.questionId) ? { ...item, status: 'exiting-to-trash' } : item,
          ),
        },
      };
    case 'ANIMATION_ARCHIVE_COMPLETE':
      return {
        ...state,
        orchestrator: {
          ...state.orchestrator,
          navLocked: false,
          archiveVisualItems: state.orchestrator.archiveVisualItems.map((item) =>
            item.questionId === event.questionId ? { ...item, status: 'archived' } : item,
          ),
        },
      };
    case 'ANIMATION_TRASH_COMPLETE':
      return {
        ...state,
        orchestrator: {
          ...state.orchestrator,
          archiveVisualItems: state.orchestrator.archiveVisualItems.filter((item) => item.questionId !== event.questionId),
          pendingTrashIds: state.orchestrator.pendingTrashIds.filter((questionId) => questionId !== event.questionId),
        },
      };
    case 'ANIMATION_RETRIEVE_COMPLETE':
      return {
        ...state,
        orchestrator: {
          ...state.orchestrator,
          navLocked: false,
          retrievalTargetId: null,
          archiveVisualItems: state.orchestrator.archiveVisualItems.map((item) =>
            item.questionId === event.questionId ? { ...item, status: 'archived' } : item,
          ),
        },
      };
    case 'FREEZE_ARCHIVE_ITEM':
      return {
        ...state,
        orchestrator: {
          ...state.orchestrator,
          archiveVisualItems: state.orchestrator.archiveVisualItems.map((item) =>
            item.questionId === event.questionId ? { ...item, status: 'frozen' } : item,
          ),
        },
      };
    case 'START_ERASING':
      return {
        ...state,
        input: {
          ...state.input,
          erasingQuestionIds: [...new Set([...state.input.erasingQuestionIds, event.questionId])],
        },
      };
    case 'STOP_ERASING':
      return {
        ...state,
        input: {
          ...state.input,
          erasingQuestionIds: state.input.erasingQuestionIds.filter((questionId) => questionId !== event.questionId),
        },
      };
    case 'PRUNE_GHOST_ANSWERS': {
      const allowedIds = new Set(state.engine.canonicalPath);
      const nextAnswerMap = Object.fromEntries(
        Object.entries(state.engine.answerMap).filter(([questionId, answer]) => !!answer && allowedIds.has(questionId)),
      ) as AnswerMap;
      return {
        ...state,
        engine: {
          ...state.engine,
          answerMap: nextAnswerMap,
          unreachableAnswerIds: [],
        },
      };
    }
    case 'SUBMIT_STARTED':
      return {
        ...state,
        isSubmitting: true,
        submitError: null,
      };
    case 'SUBMIT_SUCCEEDED':
      return {
        ...state,
        isSubmitting: false,
      };
    case 'SUBMIT_FAILED':
      return {
        ...state,
        isSubmitting: false,
        submitError: event.message,
      };
    default:
      return state;
  }
}

export function selectQuestionById(state: SurveyState, questionId: string | null) {
  if (!state.engine.survey || !questionId) {
    return null;
  }
  return state.engine.survey.questions.find((question) => question.questionId === questionId) ?? null;
}

export function selectCurrentQuestion(state: SurveyState) {
  return selectQuestionById(state, state.engine.currentQuestionId);
}

export function selectProgressLabel(state: SurveyState) {
  const currentId = state.engine.currentQuestionId;
  const index = currentId ? state.engine.canonicalPath.indexOf(currentId) + 1 : state.engine.canonicalPath.length;
  const total = state.engine.canonicalPath.length;
  return `Page ${Math.max(index, 1)} of ${Math.max(total, 1)}`;
}

export function selectSubmitPayload(state: SurveyState) {
  if (!state.engine.survey) {
    return [];
  }
  const replay = replayFromStart(state.engine.answerMap, state.engine.survey);
  return buildSubmitPayload(state.engine.answerMap, replay);
}
