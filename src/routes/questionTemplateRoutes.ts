import { Router } from 'express';

import {
  createQuestionTemplateController,
  deleteQuestionTemplateController,
  getQuestionTemplateCrossSurveyStatisticsController,
  getQuestionTemplateByIdController,
  getQuestionTemplateSharesController,
  listQuestionTemplateUsagesController,
  listQuestionTemplateVersionsController,
  listQuestionTemplatesController,
  restoreQuestionTemplateVersionController,
  updateQuestionTemplateController,
  updateQuestionTemplateSharesController,
} from '../controllers/questionTemplateController';
import { requireAuth } from '../middlewares/auth';

export const questionTemplateRouter = Router();

questionTemplateRouter.post('/', requireAuth, createQuestionTemplateController);
questionTemplateRouter.get('/', requireAuth, listQuestionTemplatesController);
questionTemplateRouter.get('/:id/shares', requireAuth, getQuestionTemplateSharesController);
questionTemplateRouter.put('/:id/shares', requireAuth, updateQuestionTemplateSharesController);
questionTemplateRouter.get('/:id/usages', requireAuth, listQuestionTemplateUsagesController);
questionTemplateRouter.get('/:id/statistics', requireAuth, getQuestionTemplateCrossSurveyStatisticsController);
questionTemplateRouter.get('/:id/versions', requireAuth, listQuestionTemplateVersionsController);
questionTemplateRouter.post('/:id/restore', requireAuth, restoreQuestionTemplateVersionController);
questionTemplateRouter.get('/:id', requireAuth, getQuestionTemplateByIdController);
questionTemplateRouter.put('/:id', requireAuth, updateQuestionTemplateController);
questionTemplateRouter.delete('/:id', requireAuth, deleteQuestionTemplateController);
