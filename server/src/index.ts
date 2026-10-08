import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { chatRouter } from './chat/chat.routes.js';
import { healthRouter } from './health/health.routes.js';
import { mealsRouter } from './meals/meals.routes.js';
import { prisma } from './lib/prisma.js';
import { errorHandler } from './middleware/error.js';

const app = express();
const port = Number(process.env.PORT ?? 3000);

app.use(cors());
// 15 MB: una foto de comida en base64 (ya reducida por la app) pesa ~1 MB;
// un sync completo desde HealthKit, unos cientos de KB.
app.use(express.json({ limit: '15mb' }));

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
app.use('/api/meals', mealsRouter);

app.use(errorHandler);

app.listen(port, () => {
  console.log(`API escuchando en http://localhost:${port}`);
});
