import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';

export async function requireUser(req: Request, res: Response, next: NextFunction) {
   const token = req.header('authorization')?.replace(/^Bearer /i, '');
   if (!token) {
      res.status(401).json({ error: 'Falta Authorization: Bearer <token>' });
      return;
   }

   const session = await prisma.authSession.findUnique({ where: { token } });
   if (!session || session.expiresAt < new Date()) {
      res.status(401).json({ error: 'Sesión inválida o vencida' });
      return;
   }

   res.locals.userId = session.userId;
   next();
}

export function userId(res: Response): string {
   return res.locals.userId as string;
}
