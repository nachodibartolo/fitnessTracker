import { Router } from 'express';
import { z } from 'zod';
import { requireUser, userId } from '../middleware/user.js';
import { runChat } from './chat.service.js';

export const chatRouter = Router();
chatRouter.use(requireUser);

const chatBody = z.object({
  /** Historial completo de la conversación (solo texto; las tools quedan del lado del server). */
  messages: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().trim().min(1) }))
    .min(1)
    .max(40),
});

/** POST /api/chat → { reply, toolCalls, model } */
chatRouter.post('/', async (req, res) => {
  const { messages } = chatBody.parse(req.body);
  const result = await runChat(userId(res), messages);
  res.json(result);
});
