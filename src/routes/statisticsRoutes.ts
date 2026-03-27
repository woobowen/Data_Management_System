import { Router } from 'express';

import { getSurveyStatisticsController } from '../controllers/statisticsController';
import { requireAuth } from '../middlewares/auth';

export const statisticsRouter = Router();

statisticsRouter.get('/surveys/:id', requireAuth, getSurveyStatisticsController);
