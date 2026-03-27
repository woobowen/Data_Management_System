import { Types } from 'mongoose';
import { z } from 'zod';

import { ApiError } from '../lib/errors';
import { surveyPayloadSchema } from '../lib/schemas';
import { SurveyModel } from '../models/Survey';
import { QuestionValue } from '../types/survey';

type SurveyPayload = z.infer<typeof surveyPayloadSchema>;

const END = 'END';

const validateQuestionValidation = (question: SurveyPayload['questions'][number]): void => {
  const validation = question.validation || {};

  if (question.type === 'single_choice' || question.type === 'multi_choice') {
    if (!question.options || question.options.length === 0) {
      throw new ApiError(400, `选择题必须提供选项: ${question.questionId}`);
    }
    if (
      validation.minSelected !== undefined &&
      validation.maxSelected !== undefined &&
      validation.minSelected > validation.maxSelected
    ) {
      throw new ApiError(400, `选择数量区间非法: ${question.questionId}`);
    }
  }

  if (
    question.type === 'text' &&
    validation.minLength !== undefined &&
    validation.maxLength !== undefined &&
    validation.minLength > validation.maxLength
  ) {
    throw new ApiError(400, `文本长度区间非法: ${question.questionId}`);
  }

  if (
    question.type === 'number' &&
    validation.min !== undefined &&
    validation.max !== undefined &&
    validation.min > validation.max
  ) {
    throw new ApiError(400, `数字区间非法: ${question.questionId}`);
  }
};

const detectCycle = (questions: SurveyPayload['questions']): void => {
  const adjacency = new Map<string, string[]>();

  for (const question of questions) {
    const nextTargets = new Set<string>();
    for (const rule of question.logicRules || []) {
      if (rule.nextQuestionId !== END) {
        nextTargets.add(rule.nextQuestionId);
      }
    }
    if (question.defaultNextQuestionId && question.defaultNextQuestionId !== END) {
      nextTargets.add(question.defaultNextQuestionId);
    }
    adjacency.set(question.questionId, [...nextTargets]);
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();

  const dfs = (questionId: string): void => {
    if (visiting.has(questionId)) {
      throw new ApiError(400, `问卷跳转图存在循环: ${questionId}`);
    }
    if (visited.has(questionId)) {
      return;
    }

    visiting.add(questionId);
    for (const nextQuestionId of adjacency.get(questionId) || []) {
      dfs(nextQuestionId);
    }
    visiting.delete(questionId);
    visited.add(questionId);
  };

  if (questions[0]) {
    dfs(questions[0].questionId);
  }
};

const ensureReachableQuestions = (questions: SurveyPayload['questions']): void => {
  if (questions.length === 0) {
    return;
  }

  const reachable = new Set<string>();
  const stack = [questions[0].questionId];
  const questionMap = new Map(questions.map((question) => [question.questionId, question]));

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || reachable.has(current)) {
      continue;
    }

    reachable.add(current);
    const question = questionMap.get(current);
    if (!question) {
      continue;
    }

    for (const rule of question.logicRules || []) {
      if (rule.nextQuestionId !== END) {
        stack.push(rule.nextQuestionId);
      }
    }

    if (question.defaultNextQuestionId && question.defaultNextQuestionId !== END) {
      stack.push(question.defaultNextQuestionId);
    }
  }

  for (const question of questions) {
    if (!reachable.has(question.questionId)) {
      throw new ApiError(400, `存在不可达题目: ${question.questionId}`);
    }
  }
};

const validateSurveyDefinition = (payload: SurveyPayload): void => {
  const questionIds = new Set<string>();
  const questionOrders = new Set<number>();

  for (const question of payload.questions) {
    if (questionIds.has(question.questionId)) {
      throw new ApiError(400, `题目 ID 重复: ${question.questionId}`);
    }
    questionIds.add(question.questionId);

    if (questionOrders.has(question.order)) {
      throw new ApiError(400, `题目顺序重复: ${question.order}`);
    }
    questionOrders.add(question.order);

    validateQuestionValidation(question);

    if (question.options) {
      const optionIds = new Set<string>();
      for (const option of question.options) {
        if (optionIds.has(option.optionId)) {
          throw new ApiError(400, `选项 ID 重复: ${option.optionId}`);
        }
        optionIds.add(option.optionId);
      }
    }
  }

  for (const question of payload.questions) {
    for (const rule of question.logicRules || []) {
      if (rule.nextQuestionId !== END && !questionIds.has(rule.nextQuestionId)) {
        throw new ApiError(400, `跳转目标不存在: ${rule.nextQuestionId}`);
      }
      if (rule.nextQuestionId === question.questionId) {
        throw new ApiError(400, `题目不能跳回自己: ${question.questionId}`);
      }
    }

    if (
      question.defaultNextQuestionId &&
      question.defaultNextQuestionId !== END &&
      !questionIds.has(question.defaultNextQuestionId)
    ) {
      throw new ApiError(400, `默认跳转目标不存在: ${question.defaultNextQuestionId}`);
    }

    if (question.defaultNextQuestionId === question.questionId) {
      throw new ApiError(400, `题目默认跳转不能回到自己: ${question.questionId}`);
    }
  }

  detectCycle(payload.questions);
  ensureReachableQuestions(payload.questions);
};

const normalizeQuestion = (question: QuestionValue): z.infer<typeof surveyPayloadSchema>['questions'][number] => ({
  questionId: question.questionId,
  type: question.type,
  title: question.title,
  isRequired: question.isRequired,
  order: question.order,
  options: (question.options || []).map((option) => ({
    optionId: option.optionId,
    text: option.text,
  })),
  validation: {
    minSelected: question.validation?.minSelected ?? undefined,
    maxSelected: question.validation?.maxSelected ?? undefined,
    minLength: question.validation?.minLength ?? undefined,
    maxLength: question.validation?.maxLength ?? undefined,
    min: question.validation?.min ?? undefined,
    max: question.validation?.max ?? undefined,
    isInteger: question.validation?.isInteger ?? undefined,
  },
  logicRules: (question.logicRules || []).map((rule) => ({
    condition: rule.condition,
    targetValue: rule.targetValue,
    nextQuestionId: rule.nextQuestionId,
  })),
  defaultNextQuestionId: question.defaultNextQuestionId || END,
});

const serializeRenderableSurvey = (survey: {
  _id: Types.ObjectId;
  title: string;
  description: string;
  status: string;
  allowAnonymous: boolean;
  deadlineAt: Date | null;
  questions: QuestionValue[];
}) => ({
  surveyId: survey._id.toString(),
  title: survey.title,
  description: survey.description,
  status: survey.status,
  allowAnonymous: survey.allowAnonymous,
  deadlineAt: survey.deadlineAt,
  questions: survey.questions
    .slice()
    .sort((left, right) => left.order - right.order)
    .map((question) => ({
      questionId: question.questionId,
      type: question.type,
      title: question.title,
      isRequired: question.isRequired,
      order: question.order,
      options: question.options || [],
      validation: question.validation || {},
      logicRules: question.logicRules || [],
      defaultNextQuestionId: question.defaultNextQuestionId || END,
    })),
});

export const createSurvey = async (ownerId: string, payload: SurveyPayload) => {
  validateSurveyDefinition(payload);

  return SurveyModel.create({
    ownerId: new Types.ObjectId(ownerId),
    title: payload.title,
    description: payload.description,
    status: 'draft',
    allowAnonymous: payload.allowAnonymous,
    deadlineAt: payload.deadlineAt ? new Date(payload.deadlineAt) : null,
    questions: payload.questions,
  });
};

export const listOwnerSurveys = async (ownerId: string) => {
  return SurveyModel.find({ ownerId }).sort({ updatedAt: -1 });
};

export const getOwnerSurveyById = async (ownerId: string, surveyId: string) => {
  const survey = await SurveyModel.findOne({ _id: surveyId, ownerId });
  if (!survey) {
    throw new ApiError(404, '问卷不存在');
  }
  return survey;
};

export const updateSurvey = async (ownerId: string, surveyId: string, payload: SurveyPayload) => {
  validateSurveyDefinition(payload);

  const survey = await getOwnerSurveyById(ownerId, surveyId);
  if (survey.status !== 'draft') {
    throw new ApiError(400, '仅草稿态问卷允许结构性修改');
  }

  survey.title = payload.title;
  survey.description = payload.description;
  survey.allowAnonymous = payload.allowAnonymous;
  survey.deadlineAt = payload.deadlineAt ? new Date(payload.deadlineAt) : null;
  survey.set('questions', payload.questions);

  await survey.save();
  return survey;
};

export const publishSurvey = async (ownerId: string, surveyId: string) => {
  const survey = await getOwnerSurveyById(ownerId, surveyId);
  if (survey.status !== 'draft') {
    throw new ApiError(400, '只有草稿态问卷可以发布');
  }

  if (survey.questions.length === 0) {
    throw new ApiError(400, '问卷至少需要一道题目才能发布');
  }

  validateSurveyDefinition({
    title: survey.title,
    description: survey.description,
    allowAnonymous: survey.allowAnonymous,
    deadlineAt: survey.deadlineAt ? survey.deadlineAt.toISOString() : null,
    questions: survey.questions.map((question) => normalizeQuestion(question as unknown as QuestionValue)),
  });

  survey.status = 'published';
  await survey.save();
  return survey;
};

export const getRenderableSurvey = async (surveyId: string) => {
  const survey = await SurveyModel.findById(surveyId).lean();
  if (!survey) {
    throw new ApiError(404, '问卷不存在');
  }

  if (survey.status !== 'published') {
    throw new ApiError(400, '问卷当前不可填写');
  }

  if (survey.deadlineAt && new Date(survey.deadlineAt).getTime() < Date.now()) {
    throw new ApiError(400, '问卷已截止');
  }

  return serializeRenderableSurvey({
    _id: survey._id,
    title: survey.title,
    description: survey.description,
    status: survey.status,
    allowAnonymous: survey.allowAnonymous,
    deadlineAt: survey.deadlineAt ?? null,
    questions: survey.questions.map((question) => question as unknown as QuestionValue),
  });
};
