import { v4 as uuidv4 } from 'uuid';

import { ApiError } from '../lib/errors';
import { AnswerValue, LogicRuleValue, QuestionValue } from '../types/survey';
import { ResponseModel } from '../models/Response';
import { SurveyModel } from '../models/Survey';

const END = 'END';

const compareRule = (rule: LogicRuleValue, value: unknown): boolean => {
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
};

const validateAnswerValue = (question: QuestionValue, answer: AnswerValue | undefined): void => {
  const value = answer?.value;
  const validation = question.validation || {};

  if ((value === undefined || value === null || value === '') && question.isRequired) {
    throw new ApiError(400, `必答题缺失: ${question.questionId}`);
  }

  if (value === undefined || value === null || value === '') {
    return;
  }

  switch (question.type) {
    case 'single_choice': {
      if (typeof value !== 'string') {
        throw new ApiError(400, `单选题答案类型错误: ${question.questionId}`);
      }
      const optionIds = new Set((question.options || []).map((option) => option.optionId));
      if (!optionIds.has(value)) {
        throw new ApiError(400, `单选题选项非法: ${question.questionId}`);
      }
      break;
    }
    case 'multi_choice': {
      if (!Array.isArray(value)) {
        throw new ApiError(400, `多选题答案类型错误: ${question.questionId}`);
      }
      const optionIds = new Set((question.options || []).map((option) => option.optionId));
      for (const optionId of value) {
        if (typeof optionId !== 'string' || !optionIds.has(optionId)) {
          throw new ApiError(400, `多选题选项非法: ${question.questionId}`);
        }
      }
      if (validation.minSelected !== undefined && value.length < validation.minSelected) {
        throw new ApiError(400, `多选题最少选择 ${validation.minSelected} 项: ${question.questionId}`);
      }
      if (validation.maxSelected !== undefined && value.length > validation.maxSelected) {
        throw new ApiError(400, `多选题最多选择 ${validation.maxSelected} 项: ${question.questionId}`);
      }
      break;
    }
    case 'text': {
      if (typeof value !== 'string') {
        throw new ApiError(400, `文本题答案类型错误: ${question.questionId}`);
      }
      if (validation.minLength !== undefined && value.length < validation.minLength) {
        throw new ApiError(400, `文本题长度不足: ${question.questionId}`);
      }
      if (validation.maxLength !== undefined && value.length > validation.maxLength) {
        throw new ApiError(400, `文本题长度超限: ${question.questionId}`);
      }
      break;
    }
    case 'number': {
      if (typeof value !== 'number' || Number.isNaN(value)) {
        throw new ApiError(400, `数字题答案类型错误: ${question.questionId}`);
      }
      if (validation.isInteger && !Number.isInteger(value)) {
        throw new ApiError(400, `数字题必须为整数: ${question.questionId}`);
      }
      if (validation.min !== undefined && value < validation.min) {
        throw new ApiError(400, `数字题低于最小值: ${question.questionId}`);
      }
      if (validation.max !== undefined && value > validation.max) {
        throw new ApiError(400, `数字题高于最大值: ${question.questionId}`);
      }
      break;
    }
    default:
      throw new ApiError(400, `未知题型: ${question.questionId}`);
  }
};

const resolveNextQuestionId = (question: QuestionValue, answer: AnswerValue | undefined): string => {
  for (const rule of question.logicRules || []) {
    if (compareRule(rule, answer?.value)) {
      return rule.nextQuestionId;
    }
  }

  return question.defaultNextQuestionId || END;
};

export const submitSurveyResponse = async (
  surveyId: string,
  answers: AnswerValue[],
  authenticatedUserId?: string,
) => {
  const survey = await SurveyModel.findById(surveyId).lean();
  if (!survey) {
    throw new ApiError(404, '问卷不存在');
  }

  if (survey.status !== 'published') {
    throw new ApiError(400, '问卷未发布或已关闭');
  }

  if (survey.deadlineAt && new Date(survey.deadlineAt).getTime() < Date.now()) {
    throw new ApiError(400, '问卷已截止');
  }

  if (!survey.allowAnonymous && !authenticatedUserId) {
    throw new ApiError(401, '该问卷要求登录后填写');
  }

  const answerMap = new Map<string, AnswerValue>();
  for (const answer of answers) {
    if (answerMap.has(answer.questionId)) {
      throw new ApiError(400, `重复提交同一题答案: ${answer.questionId}`);
    }
    answerMap.set(answer.questionId, answer);
  }

  const orderedQuestions = [...survey.questions]
    .map((question) => question as unknown as QuestionValue)
    .sort((left, right) => left.order - right.order);
  if (orderedQuestions.length === 0) {
    throw new ApiError(400, '问卷缺少题目定义');
  }

  const questionMap = new Map<string, QuestionValue>(orderedQuestions.map((question) => [question.questionId, question]));
  const visitedQuestionIds: string[] = [];
  const visitedSet = new Set<string>();
  let currentQuestionId: string = orderedQuestions[0].questionId;

  // 中文注释：从入口题开始重演整条作答路径，后端以此作为唯一真实路径。
  while (currentQuestionId !== END) {
    const question = questionMap.get(currentQuestionId);
    if (!question) {
      throw new ApiError(400, `跳转目标不存在: ${currentQuestionId}`);
    }

    if (visitedSet.has(currentQuestionId)) {
      throw new ApiError(400, `检测到死循环跳转: ${currentQuestionId}`);
    }

    visitedSet.add(currentQuestionId);
    visitedQuestionIds.push(currentQuestionId);

    const answer = answerMap.get(currentQuestionId);
    if (answer && answer.type !== question.type) {
      throw new ApiError(400, `题型与答案声明不匹配: ${currentQuestionId}`);
    }

    validateAnswerValue(question, answer);
    currentQuestionId = resolveNextQuestionId(question, answer);
  }

  for (const answer of answers) {
    if (!visitedSet.has(answer.questionId)) {
      throw new ApiError(400, `存在非法跳题或幽灵答案: ${answer.questionId}`);
    }
  }

  const respondentId = authenticatedUserId || `anon-${uuidv4()}`;
  const response = await ResponseModel.create({
    surveyId: survey._id,
    respondentId,
    status: 'submitted',
    submittedAt: new Date(),
    answers: visitedQuestionIds
      .filter((questionId) => answerMap.has(questionId))
      .map((questionId) => answerMap.get(questionId)),
  });

  return {
    responseId: response._id.toString(),
    respondentId,
  };
};
