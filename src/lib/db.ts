import mongoose from 'mongoose';

export const connectDatabase = async (uri: string): Promise<void> => {
  await mongoose.connect(uri);
};

export const disconnectDatabase = async (): Promise<void> => {
  await mongoose.disconnect();
};
