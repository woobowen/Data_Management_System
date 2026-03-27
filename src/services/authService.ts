import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';

import { config } from '../lib/config';
import { ApiError } from '../lib/errors';
import { UserModel } from '../models/User';

export const registerUser = async (username: string, password: string) => {
  const existingUser = await UserModel.findOne({ username });
  if (existingUser) {
    throw new ApiError(409, '用户名已存在');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await UserModel.create({
    username,
    passwordHash,
    createdAt: new Date(),
  });

  return {
    id: user._id.toString(),
    username: user.username,
    createdAt: user.createdAt,
  };
};

export const loginUser = async (username: string, password: string) => {
  const user = await UserModel.findOne({ username });
  if (!user) {
    throw new ApiError(401, '用户名或密码错误');
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    throw new ApiError(401, '用户名或密码错误');
  }

  const token = jwt.sign(
    {
      userId: user._id.toString(),
      username: user.username,
    },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn as SignOptions['expiresIn'] },
  );

  return {
    token,
    user: {
      id: user._id.toString(),
      username: user.username,
    },
  };
};
