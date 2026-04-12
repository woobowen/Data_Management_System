import { Request, Response } from 'express';

import { asyncHandler } from '../lib/asyncHandler';
import { questionTemplatePayloadSchema, shareQuestionTemplateSchema } from '../lib/schemas';
import {
  createQuestionTemplate,
  deleteQuestionTemplate,
  getQuestionTemplateById,
  getQuestionTemplateSharedUsernames,
  listQuestionTemplateVersions,
  listQuestionTemplates,
  restoreQuestionTemplateVersion,
  updateQuestionTemplate,
  updateQuestionTemplateSharedUsernames,
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

export const getQuestionTemplateSharesController = asyncHandler(async (req: Request, res: Response) => {
  const usernames = await getQuestionTemplateSharedUsernames(req.user!.userId, String(req.params.id));
  res.json({
    code: 200,
    message: '获取题目共享列表成功',
    data: {
      templateId: String(req.params.id),
      usernames,
    },
  });
});

export const updateQuestionTemplateSharesController = asyncHandler(async (req: Request, res: Response) => {
  const payload = shareQuestionTemplateSchema.parse(req.body);
  const usernames = await updateQuestionTemplateSharedUsernames(req.user!.userId, String(req.params.id), payload.usernames);
  res.json({
    code: 200,
    message: '题目共享设置已更新',
    data: {
      templateId: String(req.params.id),
      usernames,
    },
  });
});

export const listQuestionTemplateVersionsController = asyncHandler(async (req: Request, res: Response) => {
  const versions = await listQuestionTemplateVersions(req.user!.userId, String(req.params.id));
  res.json({
    code: 200,
    message: '获取题目版本历史成功',
    data: versions,
  });
});

export const restoreQuestionTemplateVersionController = asyncHandler(async (req: Request, res: Response) => {
  const template = await restoreQuestionTemplateVersion(req.user!.userId, String(req.params.id));
  res.status(201).json({
    code: 201,
    message: '题目已恢复为新版本',
    data: template,
  });
});
