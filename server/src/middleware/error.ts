import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

/** Manejo centralizado de errores: Zod → 400, el resto → 500 con mensaje. */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    res.status(400).json({ error: 'Body inválido', issues: err.issues });
    return;
  }
  const message = err instanceof Error ? err.message : String(err);
  console.error(err);
  res.status(500).json({ error: message });
}
