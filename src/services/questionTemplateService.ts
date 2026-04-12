import { Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

import { ApiError } from '../lib/errors';
import { questionTemplatePayloadSchema } from '../lib/schemas';
import { QuestionTemplateModel } from '../models/QuestionTemplate';
import { ResponseModel } from '../models/Response';
import { SurveyModel } from '../models/Survey';
import { UserModel } from '../models/User';
import { QuestionType } from '../types/survey';

type QuestionTemplatePayload = z.infer<typeof questionTemplatePayloadSchema>;

type TemplateUsageMatchMode = 'template_id' | 'legacy_title_type';

export type QuestionTemplateUsageItem = {
  surveyId: string;
  surveyTitle: string;
  surveyStatus: 'draft' | 'published' | 'closed';
  questionId: string;
  questionTitle: string;
  questionTemplateId: string | null;
  questionTemplateVersion: number | null;
  matchMode: TemplateUsageMatchMode;
};

export type QuestionTemplateCrossSurveyStatistics = {
  templateId: string;
  rootTemplateId: string;
  templateType: QuestionType;
  usageCount: number;
  surveyCount: number;
  responseCount: number;
  answerTypeCounts: Record<QuestionType, number>;
  optionCounts: Array<{ optionId: string; count: number }>;
  average: number | null;
  textValues: string[];
  usages: Array<QuestionTemplateUsageItem & { responseCount: number }>;
};

const buildValidationByType = (payload: QuestionTemplatePayload) => {
  if (payload.type === 'multi_choice') {
    return {
      minSelected: payload.validation.minSelected,
      maxSelected: payload.validation.maxSelected,
    };
  }

  if (payload.type === 'text') {
    return {
      minLength: payload.validation.minLength,
      maxLength: payload.validation.maxLength,
    };
  }

  if (payload.type === 'number') {
    return {
      min: payload.validation.min,
      max: payload.validation.max,
      isInteger: payload.validation.isInteger,
    };
  }

  return {};
};

const parseTemplateObjectId = (templateId: string) => {
  if (!Types.ObjectId.isValid(templateId)) {
    throw new ApiError(400, '题库题目 ID 非法');
  }
  return new Types.ObjectId(templateId);
};

const validateTemplatePayload = (payload: QuestionTemplatePayload) => {
  const identifier = payload.title;
  const isChoiceQuestion = payload.type === 'single_choice' || payload.type === 'multi_choice';

  if (isChoiceQuestion && payload.options.length === 0) {
    throw new ApiError(400, `选择题必须提供选项: ${identifier}`);
  }

  if (payload.type === 'multi_choice') {
    if (
      payload.validation.minSelected !== undefined &&
      payload.validation.maxSelected !== undefined &&
      payload.validation.minSelected > payload.validation.maxSelected
    ) {
      throw new ApiError(400, `选择数量区间非法: ${identifier}`);
    }
  }

  if (
    payload.type === 'text' &&
    payload.validation.minLength !== undefined &&
    payload.validation.maxLength !== undefined &&
    payload.validation.minLength > payload.validation.maxLength
  ) {
    throw new ApiError(400, `文本长度区间非法: ${identifier}`);
  }

  if (
    payload.type === 'number' &&
    payload.validation.min !== undefined &&
    payload.validation.max !== undefined &&
    payload.validation.min > payload.validation.max
  ) {
    throw new ApiError(400, `数字区间非法: ${identifier}`);
  }

  const optionIds = new Set<string>();
  for (const option of payload.options) {
    if (optionIds.has(option.optionId)) {
      throw new ApiError(400, `选项 ID 重复: ${option.optionId}`);
    }
    optionIds.add(option.optionId);
  }
};

const normalizeTemplatePayload = (payload: QuestionTemplatePayload) => {
  const isChoiceQuestion = payload.type === 'single_choice' || payload.type === 'multi_choice';
  return {
    title: payload.title.trim(),
    description: payload.description.trim(),
    type: payload.type,
    isRequired: payload.isRequired,
    options: isChoiceQuestion
      ? payload.options.map((option) => ({ optionId: option.optionId, text: option.text }))
      : [],
    validation: buildValidationByType(payload),
  };
};

const normalizeVersionRemark = (versionRemark: string, fallback: string) => {
  const normalized = versionRemark.trim();
  return normalized.length > 0 ? normalized : fallback;
};

const createNextTemplateVersion = async (params: {
  ownerId: Types.ObjectId;
  rootTemplateId: string;
  sourceTemplateId: Types.ObjectId;
  sharedWithUserIds: Types.ObjectId[];
  versionRemark: string;
  content: {
    title: string;
    description: string;
    type: 'single_choice' | 'multi_choice' | 'text' | 'number';
    isRequired: boolean;
    options: { optionId: string; text: string }[];
    validation: Record<string, unknown>;
  };
}) => {
  const latestTemplate = await QuestionTemplateModel.findOne({ rootTemplateId: params.rootTemplateId })
    .sort({ version: -1 })
    .lean();
  const nextVersion = Math.max(latestTemplate?.version ?? 0, 0) + 1;

  return QuestionTemplateModel.create({
    ownerId: params.ownerId,
    rootTemplateId: params.rootTemplateId,
    version: nextVersion,
    previousTemplateId: params.sourceTemplateId,
    sharedWithUserIds: params.sharedWithUserIds,
    versionRemark: params.versionRemark,
    ...params.content,
  });
};

const getOwnedTemplateById = async (ownerId: string, templateId: string) => {
  const objectId = parseTemplateObjectId(templateId);
  const template = await QuestionTemplateModel.findById(objectId);
  if (!template) {
    throw new ApiError(404, '题库题目不存在');
  }
  if (template.ownerId.toString() !== ownerId) {
    throw new ApiError(403, '仅题目拥有者可执行此操作');
  }
  return template;
};

const collectTemplateUsages = async (ownerId: string, templateId: string) => {
  const template = await getOwnedTemplateById(ownerId, templateId);
  const templatesInRoot = await QuestionTemplateModel.find({
    ownerId: template.ownerId,
    rootTemplateId: template.rootTemplateId,
  })
    .select({ _id: 1, version: 1, title: 1, type: 1 })
    .lean();

  const templateIdSet = new Set(templatesInRoot.map((item) => item._id.toString()));
  const versionMap = new Map(templatesInRoot.map((item) => [item._id.toString(), item.version]));
  const signatureSet = new Set(templatesInRoot.map((item) => `${item.title}::${item.type}`));
  const ownerIdString = template.ownerId.toString();

  const surveys = await SurveyModel.find({
    $or: [
      { questions: { $elemMatch: { questionTemplateId: { $in: [...templateIdSet] } } } },
      { ownerId: template.ownerId, questions: { $elemMatch: { questionTemplateId: null, title: { $in: templatesInRoot.map((item) => item.title) } } } },
    ],
  })
    .select({ title: 1, status: 1, ownerId: 1, questions: 1 })
    .lean();

  const usages: QuestionTemplateUsageItem[] = surveys.flatMap((survey) => {
    const isSurveyOwnerSameAsTemplateOwner = survey.ownerId.toString() === ownerIdString;
    return survey.questions.flatMap((question) => {
      const hasTemplateRef = !!question.questionTemplateId && templateIdSet.has(question.questionTemplateId);
      const matchesLegacySignature =
        !question.questionTemplateId && isSurveyOwnerSameAsTemplateOwner && signatureSet.has(`${question.title}::${question.type}`);

      if (!hasTemplateRef && !matchesLegacySignature) {
        return [];
      }

      return [
        {
          surveyId: survey._id.toString(),
          surveyTitle: survey.title,
          surveyStatus: survey.status,
          questionId: question.questionId,
          questionTitle: question.title,
          questionTemplateId: hasTemplateRef ? question.questionTemplateId! : null,
          questionTemplateVersion: hasTemplateRef
            ? versionMap.get(question.questionTemplateId!) ?? question.questionTemplateVersion ?? null
            : null,
          matchMode: hasTemplateRef ? 'template_id' : 'legacy_title_type',
        },
      ];
    });
  });

  return {
    template,
    usages,
  };
};

const usageKey = (surveyId: string, questionId: string) => `${surveyId}::${questionId}`;

export const createQuestionTemplate = async (ownerId: string, payload: QuestionTemplatePayload) => {
  validateTemplatePayload(payload);
  const normalized = normalizeTemplatePayload(payload);
  return QuestionTemplateModel.create({
    ownerId: new Types.ObjectId(ownerId),
    rootTemplateId: uuidv4(),
    version: 1,
    previousTemplateId: null,
    versionRemark: normalizeVersionRemark(payload.versionRemark, '初始版本'),
    ...normalized,
  });
};

export const listQuestionTemplates = async (ownerId: string) => {
  const ownerObjectId = new Types.ObjectId(ownerId);
  return QuestionTemplateModel.aggregate([
    { $sort: { rootTemplateId: 1, version: -1, updatedAt: -1 } },
    { $group: { _id: '$rootTemplateId', latest: { $first: '$$ROOT' } } },
    { $replaceRoot: { newRoot: '$latest' } },
    {
      $match: {
        $or: [{ ownerId: ownerObjectId }, { sharedWithUserIds: ownerObjectId }],
      },
    },
    { $sort: { updatedAt: -1 } },
  ]);
};

export const getQuestionTemplateById = async (userId: string, templateId: string) => {
  const userObjectId = new Types.ObjectId(userId);
  const objectId = parseTemplateObjectId(templateId);

  const template = await QuestionTemplateModel.findOne({
    _id: objectId,
    $or: [{ ownerId: userObjectId }, { sharedWithUserIds: userObjectId }],
  });
  if (!template) {
    throw new ApiError(404, '题库题目不存在');
  }
  return template;
};

export const updateQuestionTemplate = async (ownerId: string, templateId: string, payload: QuestionTemplatePayload) => {
  validateTemplatePayload(payload);
  const template = await getOwnedTemplateById(ownerId, templateId);

  const normalized = normalizeTemplatePayload(payload);
  return createNextTemplateVersion({
    ownerId: template.ownerId,
    rootTemplateId: template.rootTemplateId,
    sourceTemplateId: template._id,
    sharedWithUserIds: template.sharedWithUserIds.map((item) => new Types.ObjectId(item)),
    versionRemark: normalizeVersionRemark(payload.versionRemark, '更新题目内容'),
    content: normalized,
  });
};

export const deleteQuestionTemplate = async (ownerId: string, templateId: string) => {
  const template = await getOwnedTemplateById(ownerId, templateId);
  await QuestionTemplateModel.deleteMany({
    ownerId: template.ownerId,
    rootTemplateId: template.rootTemplateId,
  });
};

export const getQuestionTemplateSharedUsernames = async (ownerId: string, templateId: string) => {
  const template = await getOwnedTemplateById(ownerId, templateId);

  if (!template.sharedWithUserIds || template.sharedWithUserIds.length === 0) {
    return [];
  }

  const users = await UserModel.find({ _id: { $in: template.sharedWithUserIds } })
    .select({ _id: 0, username: 1 })
    .sort({ username: 1 })
    .lean();
  return users.map((user) => user.username);
};

export const updateQuestionTemplateSharedUsernames = async (ownerId: string, templateId: string, usernames: string[]) => {
  const template = await getOwnedTemplateById(ownerId, templateId);

  const normalizedUsernames = [...new Set(usernames.map((item) => item.trim()).filter((item) => item.length > 0))];

  if (normalizedUsernames.length === 0) {
    template.set('sharedWithUserIds', []);
    await template.save();
    return [];
  }

  const users = await UserModel.find({ username: { $in: normalizedUsernames } })
    .select({ _id: 1, username: 1 })
    .lean();

  const existingUsernames = new Set(users.map((user) => user.username));
  const missing = normalizedUsernames.filter((username) => !existingUsernames.has(username));
  if (missing.length > 0) {
    throw new ApiError(404, `以下用户不存在: ${missing.join(', ')}`);
  }

  const userIds = users
    .map((user) => user._id)
    .filter((userId) => userId.toString() !== ownerId)
    .map((userId) => new Types.ObjectId(userId));
  template.set('sharedWithUserIds', userIds);
  await template.save();

  return users
    .filter((user) => user._id.toString() !== ownerId)
    .map((user) => user.username)
    .sort((left, right) => left.localeCompare(right));
};

export const listQuestionTemplateVersions = async (ownerId: string, templateId: string) => {
  const template = await getOwnedTemplateById(ownerId, templateId);
  return QuestionTemplateModel.find({
    ownerId: template.ownerId,
    rootTemplateId: template.rootTemplateId,
  }).sort({ version: -1, updatedAt: -1 });
};

export const restoreQuestionTemplateVersion = async (ownerId: string, templateId: string, versionRemark: string) => {
  const template = await getOwnedTemplateById(ownerId, templateId);
  const latestTemplate = await QuestionTemplateModel.findOne({
    ownerId: template.ownerId,
    rootTemplateId: template.rootTemplateId,
  })
    .sort({ version: -1 })
    .lean();

  if (latestTemplate && latestTemplate._id.toString() === template._id.toString()) {
    throw new ApiError(400, '当前已是最新版本，无需恢复');
  }

  if (!latestTemplate) {
    throw new ApiError(404, '题目版本链不存在');
  }

  const content = {
    title: template.title,
    description: template.description,
    type: template.type,
    isRequired: template.isRequired,
    options: template.options.map((option) => ({ optionId: option.optionId, text: option.text })),
    validation: template.validation ? { ...template.validation } : {},
  };

  return createNextTemplateVersion({
    ownerId: template.ownerId,
    rootTemplateId: template.rootTemplateId,
    sourceTemplateId: new Types.ObjectId(latestTemplate._id),
    sharedWithUserIds: latestTemplate.sharedWithUserIds
      ? latestTemplate.sharedWithUserIds.map((item) => new Types.ObjectId(item))
      : template.sharedWithUserIds.map((item) => new Types.ObjectId(item)),
    versionRemark: normalizeVersionRemark(versionRemark, `回退到历史版本：${template.title}`),
    content,
  });
};

export const listQuestionTemplateUsages = async (ownerId: string, templateId: string) => {
  const { template, usages } = await collectTemplateUsages(ownerId, templateId);

  return {
    templateId: template._id.toString(),
    rootTemplateId: template.rootTemplateId,
    usageCount: usages.length,
    usages,
  };
};

export const getQuestionTemplateCrossSurveyStatistics = async (
  ownerId: string,
  templateId: string,
): Promise<QuestionTemplateCrossSurveyStatistics> => {
  const { template, usages } = await collectTemplateUsages(ownerId, templateId);

  const distinctSurveyIds = [...new Set(usages.map((usage) => usage.surveyId))];
  if (distinctSurveyIds.length === 0) {
    return {
      templateId: template._id.toString(),
      rootTemplateId: template.rootTemplateId,
      templateType: template.type,
      usageCount: 0,
      surveyCount: 0,
      responseCount: 0,
      answerTypeCounts: {
        single_choice: 0,
        multi_choice: 0,
        text: 0,
        number: 0,
      },
      optionCounts: [],
      average: null,
      textValues: [],
      usages: [],
    };
  }

  const usageMap = new Map<string, QuestionTemplateUsageItem>();
  for (const usage of usages) {
    usageMap.set(usageKey(usage.surveyId, usage.questionId), usage);
  }

  const responses = await ResponseModel.find({
    surveyId: { $in: distinctSurveyIds.map((id) => new Types.ObjectId(id)) },
    status: 'submitted',
  })
    .select({ surveyId: 1, answers: 1 })
    .lean();

  const answerTypeCounts: Record<QuestionType, number> = {
    single_choice: 0,
    multi_choice: 0,
    text: 0,
    number: 0,
  };
  const optionCountMap = new Map<string, number>();
  const responseCountByUsage = new Map<string, number>();
  const textValues: string[] = [];
  let responseCount = 0;
  let numberSum = 0;
  let numberCount = 0;

  for (const response of responses) {
    const surveyId = response.surveyId.toString();
    for (const answer of response.answers) {
      const key = usageKey(surveyId, answer.questionId);
      if (!usageMap.has(key)) {
        continue;
      }

      responseCount += 1;
      responseCountByUsage.set(key, (responseCountByUsage.get(key) ?? 0) + 1);

      if (answer.type === 'single_choice') {
        answerTypeCounts.single_choice += 1;
        if (typeof answer.value === 'string') {
          optionCountMap.set(answer.value, (optionCountMap.get(answer.value) ?? 0) + 1);
        }
        continue;
      }

      if (answer.type === 'multi_choice') {
        answerTypeCounts.multi_choice += 1;
        if (Array.isArray(answer.value)) {
          for (const optionId of answer.value) {
            if (typeof optionId === 'string') {
              optionCountMap.set(optionId, (optionCountMap.get(optionId) ?? 0) + 1);
            }
          }
        }
        continue;
      }

      if (answer.type === 'text') {
        answerTypeCounts.text += 1;
        if (typeof answer.value === 'string') {
          textValues.push(answer.value);
        }
        continue;
      }

      if (answer.type === 'number') {
        answerTypeCounts.number += 1;
        if (typeof answer.value === 'number' && Number.isFinite(answer.value)) {
          numberSum += answer.value;
          numberCount += 1;
        }
      }
    }
  }

  const optionCounts = [...optionCountMap.entries()]
    .map(([optionId, count]) => ({ optionId, count }))
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }
      return left.optionId.localeCompare(right.optionId);
    });

  const usageStats = usages
    .map((usage) => ({
      ...usage,
      responseCount: responseCountByUsage.get(usageKey(usage.surveyId, usage.questionId)) ?? 0,
    }))
    .sort((left, right) => {
      if (right.responseCount !== left.responseCount) {
        return right.responseCount - left.responseCount;
      }
      return left.surveyTitle.localeCompare(right.surveyTitle);
    });

  return {
    templateId: template._id.toString(),
    rootTemplateId: template.rootTemplateId,
    templateType: template.type,
    usageCount: usages.length,
    surveyCount: distinctSurveyIds.length,
    responseCount,
    answerTypeCounts,
    optionCounts,
    average: numberCount > 0 ? numberSum / numberCount : null,
    textValues,
    usages: usageStats,
  };
};
