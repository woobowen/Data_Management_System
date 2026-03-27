import 'express';

declare global {
  namespace Express {
    interface UserPayload {
      userId: string;
      username: string;
    }

    interface Request {
      user?: UserPayload;
    }
  }
}

export {};
