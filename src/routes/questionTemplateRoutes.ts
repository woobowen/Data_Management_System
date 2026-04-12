import { Router } from 'express';

import {
  createQuestionTemplateController,
  deleteQuestionTemplateController,
  getQuestionTemplateByIdController,
  listQuestionTemplatesController,
  updateQuestionTemplateController,
} from '../controllers/questionTemplateController';
import { requireAuth } from '../middlewares/auth';

export const questionTemplateRouter = Router();

questionTemplateRouter.post('/', requireAuth, createQuestionTemplateController);
questionTemplateRouter.get('/', requireAuth, listQuestionTemplatesController);
questionTemplateRouter.get('/:id', requireAuth, getQuestionTemplateByIdController);
questionTemplateRouter.put('/:id', requireAuth, updateQuestionTemplateController);
questionTemplateRouter.delete('/:id', requireAuth, deleteQuestionTemplateController);
