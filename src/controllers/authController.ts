import { Request, Response } from 'express';

import { asyncHandler } from '../lib/asyncHandler';
import { loginSchema, registerSchema } from '../lib/schemas';
import { loginUser, registerUser } from '../services/authService';

export const register = asyncHandler(async (req: Request, res: Response) => {
  const payload = registerSchema.parse(req.body);
  const data = await registerUser(payload.username, payload.password);
  res.status(201).json({
    code: 201,
    message: '注册成功',
    data,
  });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const payload = loginSchema.parse(req.body);
  const data = await loginUser(payload.username, payload.password);
  res.json({
    code: 200,
    message: '登录成功',
    data,
  });
});
