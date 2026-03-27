import express from 'express';

import { authRouter } from './routes/authRoutes';
import { surveyRouter } from './routes/surveyRoutes';
import { statisticsRouter } from './routes/statisticsRoutes';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';

export const createApp = () => {
  const app = express();

  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({
      code: 200,
      message: 'ok',
      data: null,
    });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/surveys', surveyRouter);
  app.use('/api/statistics', statisticsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
