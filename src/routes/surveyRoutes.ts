import { Router } from 'express';

import {
  closeSurveyController,
  createSurveyController,
  getMySurveyController,
  listMySurveysController,
  publishSurveyController,
  updateSurveyController,
} from '../controllers/surveyController';
import { renderSurveyController, submitSurveyController } from '../controllers/engineController';
import { attachOptionalUser, requireAuth } from '../middlewares/auth';

export const surveyRouter = Router();

surveyRouter.post('/', requireAuth, createSurveyController);
surveyRouter.get('/', requireAuth, listMySurveysController);
surveyRouter.get('/:id', requireAuth, getMySurveyController);
surveyRouter.put('/:id', requireAuth, updateSurveyController);
surveyRouter.post('/:id/publish', requireAuth, publishSurveyController);
surveyRouter.post('/:id/close', requireAuth, closeSurveyController);
surveyRouter.get('/:id/render', renderSurveyController);
surveyRouter.post('/:id/submit', attachOptionalUser, submitSurveyController);
