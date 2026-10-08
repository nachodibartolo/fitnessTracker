import { Router } from 'express';
import { z } from 'zod';
import { dayRangeInTz, todayInTz } from '../lib/dates.js';
import { prisma } from '../lib/prisma.js';
import { requireUser, userId } from '../middleware/user.js';
import { analyzeAndLogMeal } from './meal-agent.js';

export const mealsRouter = Router();
mealsRouter.use(requireUser);

const mealInclude = { items: { orderBy: { order: 'asc' as const } } };

const dayQuery = z.object({
  /** Día calendario en la zona horaria del usuario. Default: hoy. */
  date: z.iso.date().optional(),
});

/** GET /api/meals?date=YYYY-MM-DD → { date, meals, totals } */
mealsRouter.get('/', async (req, res) => {
  const uid = userId(res);
  const q = dayQuery.parse(req.query);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: uid } });
  const date = q.date ?? todayInTz(user.timezone);
  const { from, to } = dayRangeInTz(date, user.timezone);

  const meals = await prisma.meal.findMany({
    where: { userId: uid, eatenAt: { gte: from, lt: to } },
    orderBy: { eatenAt: 'desc' },
    include: mealInclude,
  });

  const totals = meals.reduce(
    (acc, m) => ({
      calories: acc.calories + (m.calories ?? 0),
      proteinG: acc.proteinG + (m.proteinG ?? 0),
      carbsG: acc.carbsG + (m.carbsG ?? 0),
      fatG: acc.fatG + (m.fatG ?? 0),
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }
  );

  res.json({ date, meals, totals });
});

const analyzeBody = z
  .object({
    description: z.string().trim().max(1000).optional(),
    /** Data URL con la foto (data:image/jpeg;base64,...). La app la manda ya reducida. */
    image: z
      .string()
      .regex(/^data:image\/(jpeg|png|webp|heic);base64,/, 'Tiene que ser un data URL de imagen')
      .optional(),
    eatenAt: z.iso.datetime().optional(),
  })
  .refine((b) => b.description || b.image, { message: 'Mandá una descripción, una foto, o ambas' });

/** POST /api/meals/analyze → la IA estima macros y guarda la comida. Devuelve la Meal creada. */
mealsRouter.post('/analyze', async (req, res) => {
  const body = analyzeBody.parse(req.body);
  const meal = await analyzeAndLogMeal(userId(res), {
    description: body.description || undefined,
    image: body.image,
    eatenAt: body.eatenAt ? new Date(body.eatenAt) : undefined,
  });
  res.status(201).json(meal);
});

mealsRouter.delete('/:id', async (req, res) => {
  const { count } = await prisma.meal.deleteMany({ where: { id: req.params.id, userId: userId(res) } });
  if (count === 0) {
    res.status(404).json({ error: 'Comida no encontrada' });
    return;
  }
  res.status(204).end();
});
