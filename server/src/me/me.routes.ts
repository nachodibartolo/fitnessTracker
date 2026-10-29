import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireUser, userId } from '../middleware/user.js';

export const meRouter = Router();
meRouter.use(requireUser);

const meSelect = {
  id: true,
  email: true,
  name: true,
  heightCm: true,
  birthDate: true,
  dailyKcalTarget: true,
  dailyProteinTarget: true,
} as const;

const patchBody = z.object({
  name: z.string().min(1).optional(),
  heightCm: z.number().min(50).max(300).optional(),
  birthDate: z.iso.date().optional(),
  dailyKcalTarget: z.int().min(500).max(10000).optional(),
  dailyProteinTarget: z.int().min(10).max(1000).optional(),
});

meRouter.get('/', async (_req, res) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId(res) }, select: meSelect });
  res.json(user);
});

meRouter.patch('/', async (req, res) => {
  const { birthDate, ...rest } = patchBody.parse(req.body);
  const user = await prisma.user.update({
    where: { id: userId(res) },
    data: { ...rest, ...(birthDate && { birthDate: new Date(`${birthDate}T00:00:00Z`) }) },
    select: meSelect,
  });
  res.json(user);
});
