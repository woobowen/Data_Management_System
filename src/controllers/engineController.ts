import { Request, Response } from 'express';

import { asyncHandler } from '../lib/asyncHandler';
import { submitAnswersSchema } from '../lib/schemas';
import { submitSurveyResponse } from '../services/responseService';
import { getRenderableSurvey } from '../services/surveyService';

export const renderSurveyController = asyncHandler(async (req: Request, res: Response) => {
  const survey = await getRenderableSurvey(String(req.params.id));
  res.json({
    code: 200,
    message: '获取问卷定义成功',
    data: survey,
  });
});

export const submitSurveyController = asyncHandler(async (req: Request, res: Response) => {
  const payload = submitAnswersSchema.parse(req.body);
  const data = await submitSurveyResponse(String(req.params.id), payload.answers, req.user?.userId);
  res.status(201).json({
    code: 201,
    message: '提交成功',
    data,
  });
});
