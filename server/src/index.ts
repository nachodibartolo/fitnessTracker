import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { chatRouter } from './chat/chat.routes.js';
import { healthRouter } from './health/health.routes.js';
import { prisma } from './lib/prisma.js';
import { errorHandler } from './middleware/error.js';

const app = express();
const port = Number(process.env.PORT ?? 3000);

app.use(cors());
// 10 MB: un sync completo desde HealthKit (250 días + mediciones) son unos cientos de KB.
app.use(express.json({ limit: '10mb' }));

app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, db: 'connected' });
  } catch (error) {
    res.status(500).json({ ok: false, db: 'error', message: (error as Error).message });
  }
});

app.use('/api/health', healthRouter);
app.use('/api/chat', chatRouter);

app.use(errorHandler);

app.listen(port, () => {
  console.log(`API escuchando en http://localhost:${port}`);
});
