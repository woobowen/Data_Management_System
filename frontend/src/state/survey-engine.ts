export type QuestionType = 'single_choice' | 'multi_choice' | 'text' | 'number';
export type RuleCondition = 'eq' | 'gt' | 'lt' | 'includes';

export type OptionValue = {
  optionId: string;
  text: string;
};

export type LogicRuleValue = {
  condition: RuleCondition;
  targetValue: unknown;
  nextQuestionId: string;
};

export type QuestionValidation = {
  minSelected?: number;
  maxSelected?: number;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  isInteger?: boolean;
};

export type QuestionValue = {
  questionId: string;
  type: QuestionType;
  title: string;
  isRequired: boolean;
  order: number;
  options?: OptionValue[];
  validation?: QuestionValidation;
  logicRules?: LogicRuleValue[];
  defaultNextQuestionId?: string;
};

export type SurveyDefinition = {
  surveyId: string;
  title: string;
  description?: string;
  status?: 'draft' | 'published' | 'closed';
  allowAnonymous?: boolean;
  deadlineAt?: string | null;
  questions: QuestionValue[];
};

export type AnswerValue = {
  questionId: string;
  type: QuestionType;
  value?: unknown;
};

export type AnswerMap = Record<string, AnswerValue | undefined>;

export type ReplayResult = {
  canonicalPath: string[];
  canonicalSet: Set<string>;
  currentReachableQuestionId: string | null;
  unreachableAnswerIds: string[];
  hasLoop: boolean;
};

const END = 'END';

export function getOrderedQuestions(survey: SurveyDefinition): QuestionValue[] {
  return [...survey.questions].sort((left, right) => left.order - right.order);
}

export function getQuestionMap(survey: SurveyDefinition): Map<string, QuestionValue> {
  return new Map(getOrderedQuestions(survey).map((question) => [question.questionId, question]));
}

export function compareRule(rule: LogicRuleValue, value: unknown): boolean {
  switch (rule.condition) {
    case 'eq':
      return value === rule.targetValue;
    case 'gt':
      return typeof value === 'number' && typeof rule.targetValue === 'number' && value > rule.targetValue;
    case 'lt':
      return typeof value === 'number' && typeof rule.targetValue === 'number' && value < rule.targetValue;
    case 'includes':
      if (Array.isArray(value)) {
        return value.includes(rule.targetValue);
      }
      if (typeof value === 'string' && typeof rule.targetValue === 'string') {
        return value.includes(rule.targetValue);
      }
      return false;
    default:
      return false;
  }
}

export function resolveNextQuestionId(question: QuestionValue, answer?: AnswerValue): string {
  for (const rule of question.logicRules || []) {
    if (compareRule(rule, answer?.value)) {
      return rule.nextQuestionId;
    }
  }

  return question.defaultNextQuestionId || END;
}

function isBlankValue(value: unknown) {
  return value === undefined || value === null || value === '';
}

export function replayFromStart(answerMap: AnswerMap, survey: SurveyDefinition): ReplayResult {
  const orderedQuestions = getOrderedQuestions(survey);

  if (orderedQuestions.length === 0) {
    return {
      canonicalPath: [],
      canonicalSet: new Set(),
      currentReachableQuestionId: null,
      unreachableAnswerIds: [],
      hasLoop: false,
    };
  }

  const questionMap = getQuestionMap(survey);
  const canonicalPath: string[] = [];
  const visitedSet = new Set<string>();
  let currentQuestionId = orderedQuestions[0]?.questionId ?? null;
  let currentReachableQuestionId: string | null = currentQuestionId;
  let lockedReachableQuestionId: string | null = null;
  let hasLoop = false;

  while (currentQuestionId && currentQuestionId !== END) {
    const question = questionMap.get(currentQuestionId);
    if (!question) {
      break;
    }

    if (visitedSet.has(currentQuestionId)) {
      hasLoop = true;
      break;
    }

    visitedSet.add(currentQuestionId);
    canonicalPath.push(currentQuestionId);

    const answer = lockedReachableQuestionId ? undefined : answerMap[currentQuestionId];
    if (!answer || isBlankValue(answer.value)) {
      if (!lockedReachableQuestionId) {
        lockedReachableQuestionId = currentQuestionId;
        currentReachableQuestionId = currentQuestionId;
      }

      if ((question.logicRules?.length ?? 0) > 0) {
        break;
      }

      currentQuestionId = question.defaultNextQuestionId || END;
      continue;
    }

    currentQuestionId = resolveNextQuestionId(question, answer);
    if (!lockedReachableQuestionId) {
      currentReachableQuestionId = currentQuestionId === END ? null : currentQuestionId;
    }
  }

  const canonicalSet = new Set(canonicalPath);
  const unreachableAnswerIds = Object.keys(answerMap).filter((questionId) => {
    const answer = answerMap[questionId];
    return !!answer && !canonicalSet.has(questionId);
  });

  return {
    canonicalPath,
    canonicalSet,
    currentReachableQuestionId,
    unreachableAnswerIds,
    hasLoop,
  };
}

export function buildSubmitPayload(answerMap: AnswerMap, replay: ReplayResult): AnswerValue[] {
  return replay.canonicalPath
    .map((questionId) => answerMap[questionId])
    .filter((answer): answer is AnswerValue => !!answer && !isBlankValue(answer.value));
}
