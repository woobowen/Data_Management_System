import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import { config } from '../lib/config';
import { ApiError } from '../lib/errors';

interface TokenPayload {
  userId: string;
  username: string;
}

const readBearerToken = (authorization?: string): string | null => {
  if (!authorization) {
    return null;
  }

  const [scheme, token] = authorization.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return null;
  }

  return token;
};

export const requireAuth = (req: Request, _res: Response, next: NextFunction): void => {
  const token = readBearerToken(req.headers.authorization);
  if (!token) {
    next(new ApiError(401, '缺少有效的认证令牌'));
    return;
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret) as TokenPayload;
    req.user = { userId: payload.userId, username: payload.username };
    next();
  } catch {
    next(new ApiError(401, '认证令牌无效'));
  }
};

export const attachOptionalUser = (req: Request, _res: Response, next: NextFunction): void => {
  const token = readBearerToken(req.headers.authorization);
  if (!token) {
    next();
    return;
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret) as TokenPayload;
    req.user = { userId: payload.userId, username: payload.username };
  } catch {
    req.user = undefined;
  }

  next();
};
