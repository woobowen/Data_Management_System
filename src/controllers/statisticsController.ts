import { Request, Response } from 'express';

import { asyncHandler } from '../lib/asyncHandler';
import { getSurveyStatistics } from '../services/statisticsService';

export const getSurveyStatisticsController = asyncHandler(async (req: Request, res: Response) => {
  const data = await getSurveyStatistics(req.user!.userId, String(req.params.id));
  res.json({
    code: 200,
    message: '获取统计成功',
    data,
  });
});
