import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

import { ApiError } from '../lib/errors';

export const notFoundHandler = (_req: Request, _res: Response, next: NextFunction): void => {
  next(new ApiError(404, '接口不存在'));
};

export const errorHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction): void => {
  if (err instanceof ZodError) {
    res.status(400).json({
      code: 400,
      message: '请求参数校验失败',
      data: err.flatten(),
    });
    return;
  }

  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      code: err.statusCode,
      message: err.message,
      data: null,
    });
    return;
  }

  console.error(err);
  res.status(500).json({
    code: 500,
    message: '服务器内部错误',
    data: null,
  });
};
