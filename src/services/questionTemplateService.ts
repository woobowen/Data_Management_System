import { Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

import { ApiError } from '../lib/errors';
import { questionTemplatePayloadSchema } from '../lib/schemas';
import { QuestionTemplateModel } from '../models/QuestionTemplate';

type QuestionTemplatePayload = z.infer<typeof questionTemplatePayloadSchema>;

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

export const createQuestionTemplate = async (ownerId: string, payload: QuestionTemplatePayload) => {
  validateTemplatePayload(payload);
  const normalized = normalizeTemplatePayload(payload);
  return QuestionTemplateModel.create({
    ownerId: new Types.ObjectId(ownerId),
    rootTemplateId: uuidv4(),
    version: 1,
    previousTemplateId: null,
    ...normalized,
  });
};

export const listQuestionTemplates = async (ownerId: string) => {
  const ownerObjectId = new Types.ObjectId(ownerId);
  return QuestionTemplateModel.find({
    $or: [{ ownerId: ownerObjectId }, { sharedWithUserIds: ownerObjectId }],
  }).sort({ updatedAt: -1 });
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
  const objectId = parseTemplateObjectId(templateId);

  const template = await QuestionTemplateModel.findById(objectId);
  if (!template) {
    throw new ApiError(404, '题库题目不存在');
  }
  if (template.ownerId.toString() !== ownerId) {
    throw new ApiError(403, '仅题目拥有者可编辑题库题目');
  }

  const normalized = normalizeTemplatePayload(payload);
  template.title = normalized.title;
  template.description = normalized.description;
  template.type = normalized.type;
  template.isRequired = normalized.isRequired;
  template.set('options', normalized.options);
  template.set('validation', normalized.validation);
  await template.save();
  return template;
};

export const deleteQuestionTemplate = async (ownerId: string, templateId: string) => {
  const objectId = parseTemplateObjectId(templateId);

  const template = await QuestionTemplateModel.findById(objectId);
  if (!template) {
    throw new ApiError(404, '题库题目不存在');
  }
  if (template.ownerId.toString() !== ownerId) {
    throw new ApiError(403, '仅题目拥有者可删除题库题目');
  }

  await QuestionTemplateModel.deleteOne({ _id: objectId });
};
