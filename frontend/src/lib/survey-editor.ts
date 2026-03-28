import type { SurveyPayload, SurveyQuestionInput, SurveySummary } from './api';

export const createEmptyQuestion = (order: number): SurveyQuestionInput => ({
  questionId: `q${Date.now()}${order}`,
  type: 'single_choice',
  title: '',
  isRequired: false,
  order,
  options: [
    { optionId: `opt${order}a`, text: '' },
    { optionId: `opt${order}b`, text: '' },
  ],
  validation: {},
  logicRules: [],
  defaultNextQuestionId: 'END',
});

export const createEmptySurveyPayload = (): SurveyPayload => ({
  title: '',
  description: '',
  allowAnonymous: false,
  deadlineAt: null,
  questions: [createEmptyQuestion(1)],
});

export const surveyToPayload = (survey: SurveySummary): SurveyPayload => ({
  title: survey.title,
  description: survey.description ?? '',
  allowAnonymous: survey.allowAnonymous,
  deadlineAt: survey.deadlineAt ? new Date(survey.deadlineAt).toISOString() : null,
  questions: [...survey.questions]
    .sort((a, b) => a.order - b.order)
    .map((question, index) => ({
      ...question,
      order: index + 1,
      options: question.options ?? [],
      validation: question.validation ?? {},
      logicRules: question.logicRules ?? [],
      defaultNextQuestionId: question.defaultNextQuestionId ?? 'END',
    })),
});
