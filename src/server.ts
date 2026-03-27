import { createApp } from './app';
import { config } from './lib/config';
import { connectDatabase } from './lib/db';

const bootstrap = async () => {
  await connectDatabase(config.mongoUri);
  const app = createApp();

  app.listen(config.port, () => {
    console.log(`Survey backend listening on port ${config.port}`);
  });
};

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
