import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireUser, userId } from '../middleware/user.js';
import { hashPassword, verifyPassword } from './password.js';

export const authRouter = Router();

const SESSION_DAYS = 30;

const loginBody = z.object({
   email: z.email().toLowerCase(),
   password: z.string().min(1),
});

const registerBody = loginBody.extend({
   password: z.string().min(6, 'La contraseña tiene que tener al menos 6 caracteres'),
});

async function createSession(id: string) {
   const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
   const session = await prisma.authSession.create({
      data: { token: randomBytes(32).toString('hex'), userId: id, expiresAt },
   });
   return session.token;
}

const publicUser = { id: true, email: true, name: true } as const;

authRouter.post('/register', async (req, res) => {
   const { email, password } = registerBody.parse(req.body);

   const exists = await prisma.user.findUnique({ where: { email } });
   if (exists) {
      res.status(400).json({ error: 'Ya hay una cuenta con ese email' });
      return;
   }

   const user = await prisma.user.create({
      data: { email, passwordHash: hashPassword(password) },
      select: publicUser,
   });
   const token = await createSession(user.id);
   res.status(201).json({ token, user });
});

authRouter.post('/login', async (req, res) => {
   const { email, password } = loginBody.parse(req.body);

   const user = await prisma.user.findUnique({ where: { email } });
   if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
      res.status(401).json({ error: 'Email o contraseña incorrectos' });
      return;
   }

   const token = await createSession(user.id);
   res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
});

authRouter.post('/logout', requireUser, async (req, res) => {
   const token = req.header('authorization')!.replace(/^Bearer /i, '');
   await prisma.authSession.deleteMany({ where: { token, userId: userId(res) } });
   res.status(204).end();
});
