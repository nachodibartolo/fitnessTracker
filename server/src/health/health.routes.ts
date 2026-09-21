import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireUser, userId } from '../middleware/user.js';
import { parseAppleExport } from './apple-export.js';
import { healthSyncPayload } from './sync.schema.js';
import { fromDbDate, syncHealth, toDbDate } from './sync.service.js';

export const healthRouter = Router();
healthRouter.use(requireUser);

/** Lo que va a llamar la app cuando lea HealthKit directo. */
healthRouter.post('/sync', async (req, res) => {
  const payload = healthSyncPayload.parse(req.body);
  const result = await syncHealth(userId(res), 'HEALTHKIT', payload);
  res.json(result);
});

/**
 * Mientras tanto: el export.xml crudo en el body (Content-Type: application/xml).
 * Se parsea en streaming, se agrega por día y entra por el mismo servicio
 * que /sync. Un import nuevo reemplaza al anterior.
 */
healthRouter.post('/import', async (req, res) => {
  req.setEncoding('utf8');
  const { payload, stats } = await parseAppleExport(req);
  const result = await syncHealth(userId(res), 'APPLE_HEALTH_XML', payload, {
    fileName: req.header('x-file-name'),
  });
  res.json({ import: result, stats });
});

const rangeQuery = z.object({
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
});

healthRouter.get('/days', async (req, res) => {
  const q = rangeQuery.parse(req.query);
  const days = await prisma.dailyHealthSummary.findMany({
    where: {
      userId: userId(res),
      date: {
        gte: q.from ? toDbDate(q.from) : undefined,
        lte: q.to ? toDbDate(q.to) : undefined,
      },
    },
    orderBy: { date: 'asc' },
  });
  res.json(days.map((d) => ({ ...d, date: fromDbDate(d.date) })));
});

healthRouter.get('/workouts', async (req, res) => {
  const q = rangeQuery.parse(req.query);
  const workouts = await prisma.workout.findMany({
    where: {
      userId: userId(res),
      startedAt: {
        gte: q.from ? toDbDate(q.from) : undefined,
        lte: q.to ? new Date(`${q.to}T23:59:59.999Z`) : undefined,
      },
    },
    orderBy: { startedAt: 'desc' },
  });
  res.json(workouts);
});

healthRouter.get('/imports', async (_req, res) => {
  const imports = await prisma.healthImport.findMany({
    where: { userId: userId(res) },
    orderBy: { startedAt: 'desc' },
  });
  res.json(imports);
});
