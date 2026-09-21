import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Identificación provisoria hasta que haya login: la app manda un UUID
 * por dispositivo en el header `x-user-id`. Si el usuario no existe, se crea.
 * El id queda en `res.locals.userId` para los handlers.
 */
export async function requireUser(req: Request, res: Response, next: NextFunction) {
  const id = req.header('x-user-id');
  if (!id || !UUID_RE.test(id)) {
    res.status(401).json({ error: 'Falta el header x-user-id (UUID)' });
    return;
  }
  await prisma.user.upsert({ where: { id }, create: { id }, update: {} });
  res.locals.userId = id;
  next();
}

export function userId(res: Response): string {
  return res.locals.userId as string;
}
