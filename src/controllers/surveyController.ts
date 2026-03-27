import { Request, Response } from 'express';

import { asyncHandler } from '../lib/asyncHandler';
import { surveyPayloadSchema } from '../lib/schemas';
import { createSurvey, getOwnerSurveyById, listOwnerSurveys, publishSurvey, updateSurvey } from '../services/surveyService';

export const createSurveyController = asyncHandler(async (req: Request, res: Response) => {
  const payload = surveyPayloadSchema.parse(req.body);
  const survey = await createSurvey(req.user!.userId, payload);
  res.status(201).json({
    code: 201,
    message: '问卷创建成功',
    data: survey,
  });
});

export const listMySurveysController = asyncHandler(async (req: Request, res: Response) => {
  const surveys = await listOwnerSurveys(req.user!.userId);
  res.json({
    code: 200,
    message: '获取成功',
    data: surveys,
  });
});

export const getMySurveyController = asyncHandler(async (req: Request, res: Response) => {
  const survey = await getOwnerSurveyById(req.user!.userId, String(req.params.id));
  res.json({
    code: 200,
    message: '获取成功',
    data: survey,
  });
});

export const updateSurveyController = asyncHandler(async (req: Request, res: Response) => {
  const payload = surveyPayloadSchema.parse(req.body);
  const survey = await updateSurvey(req.user!.userId, String(req.params.id), payload);
  res.json({
    code: 200,
    message: '问卷更新成功',
    data: survey,
  });
});

export const publishSurveyController = asyncHandler(async (req: Request, res: Response) => {
  const survey = await publishSurvey(req.user!.userId, String(req.params.id));
  res.json({
    code: 200,
    message: '问卷发布成功',
    data: {
      survey,
      shareLink: `/api/surveys/${survey._id.toString()}/render`,
    },
  });
});
