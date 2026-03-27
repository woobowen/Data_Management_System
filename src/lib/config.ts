import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: Number(process.env.PORT || 3000),
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/survey_system_v1',
  jwtSecret: process.env.JWT_SECRET || 'survey-system-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
};
