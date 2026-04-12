import { Request, Response } from 'express';

import { asyncHandler } from '../lib/asyncHandler';
import { questionTemplatePayloadSchema } from '../lib/schemas';
import {
  createQuestionTemplate,
  deleteQuestionTemplate,
  getQuestionTemplateById,
  listQuestionTemplates,
  updateQuestionTemplate,
} from '../services/questionTemplateService';

export const createQuestionTemplateController = asyncHandler(async (req: Request, res: Response) => {
  const payload = questionTemplatePayloadSchema.parse(req.body);
  const template = await createQuestionTemplate(req.user!.userId, payload);
  res.status(201).json({
    code: 201,
    message: '题目已保存到题库',
    data: template,
  });
});

export const listQuestionTemplatesController = asyncHandler(async (req: Request, res: Response) => {
  const templates = await listQuestionTemplates(req.user!.userId);
  res.json({
    code: 200,
    message: '获取题库成功',
    data: templates,
  });
});

export const getQuestionTemplateByIdController = asyncHandler(async (req: Request, res: Response) => {
  const template = await getQuestionTemplateById(req.user!.userId, String(req.params.id));
  res.json({
    code: 200,
    message: '获取题目成功',
    data: template,
  });
});

export const updateQuestionTemplateController = asyncHandler(async (req: Request, res: Response) => {
  const payload = questionTemplatePayloadSchema.parse(req.body);
  const template = await updateQuestionTemplate(req.user!.userId, String(req.params.id), payload);
  res.json({
    code: 200,
    message: '题库题目更新成功',
    data: template,
  });
});

export const deleteQuestionTemplateController = asyncHandler(async (req: Request, res: Response) => {
  await deleteQuestionTemplate(req.user!.userId, String(req.params.id));
  res.json({
    code: 200,
    message: '题库题目删除成功',
    data: null,
  });
});
