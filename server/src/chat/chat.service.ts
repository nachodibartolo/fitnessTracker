import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { fromDbDate } from '../health/sync.service.js';
import { prisma } from '../lib/prisma.js';
import { runTool, toolDefinitions } from './tools.js';

/**
 * OpenRouter expone la misma API que OpenAI, así que se usa el SDK oficial
 * apuntando a otra URL. La API key vive solo en el server. Se crea el cliente
 * recién al usarlo: el SDK tira error si la key falta, y sin key el resto de
 * la API igual tiene que levantar.
 */
function openrouter() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('Falta OPENROUTER_API_KEY en server/.env');
  return new OpenAI({ baseURL: 'https://openrouter.ai/api/v1', apiKey });
}

const MODEL = process.env.OPENROUTER_MODEL ?? 'google/gemini-3.1-flash-lite';

/** Cuántas idas y vueltas modelo ↔ tools se permiten por mensaje del usuario. */
const MAX_STEPS = 6;

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

async function systemPrompt(userId: string): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const range = await prisma.dailyHealthSummary.aggregate({
    where: { userId },
    _min: { date: true },
    _max: { date: true },
    _count: true,
  });
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: user.timezone }).format(new Date());

  const perfil = [
    user.name && `nombre: ${user.name}`,
    user.heightCm && `altura: ${user.heightCm} cm`,
    user.birthDate && `nacimiento: ${fromDbDate(user.birthDate)}`,
    user.dailyKcalTarget && `objetivo kcal/día: ${user.dailyKcalTarget}`,
    user.dailyProteinTarget && `objetivo proteína/día: ${user.dailyProteinTarget} g`,
  ]
    .filter(Boolean)
    .join(', ');

  const datos =
    range._count > 0
      ? `Hay ${range._count} días de salud cargados, desde ${fromDbDate(range._min.date!)} hasta ${fromDbDate(range._max.date!)}.`
      : 'Todavía no hay datos de salud cargados.';

  return [
    'Sos el asistente de una app de fitness personal. Respondés en español rioplatense, corto y concreto.',
    'Tenés tools de solo lectura sobre los datos del usuario (Apple Health y sesiones de gimnasio).',
    'Cuando la pregunta dependa de datos, usá las tools; no inventes números. Si no hay datos para lo que piden, decilo.',
    'Cuando des cifras, aclará el rango de fechas que usaste. Peso en kg, sueño en horas y minutos.',
    `Hoy es ${today} (zona horaria ${user.timezone}).`,
    perfil ? `Perfil: ${perfil}.` : '',
    datos,
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Un turno de chat: manda el historial al modelo con las tools disponibles y,
 * mientras el modelo pida tools, las ejecuta y le devuelve el resultado.
 * Termina cuando el modelo responde con texto. Devuelve ese texto más la
 * lista de tools que usó (útil para mostrar y para debuggear).
 */
export async function runChat(userId: string, history: ChatMessage[]) {
  const client = openrouter();
  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: await systemPrompt(userId) },
    ...history,
  ];
  const toolCalls: { name: string; args: string }[] = [];

  for (let step = 0; step < MAX_STEPS; step++) {
    const completion = await client.chat.completions.create({
      model: MODEL,
      messages,
      tools: toolDefinitions,
    });

    const reply = completion.choices[0]?.message;
    if (!reply) throw new Error('El modelo no devolvió respuesta');
    messages.push(reply);

    const calls = (reply.tool_calls ?? []).filter((c) => c.type === 'function');
    if (calls.length === 0) {
      return { reply: reply.content ?? '', toolCalls, model: completion.model };
    }

    for (const call of calls) {
      const result = await runTool(userId, call.function.name, call.function.arguments);
      toolCalls.push({ name: call.function.name, args: call.function.arguments });
      messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
    }
  }

  throw new Error(`El agente superó el máximo de ${MAX_STEPS} pasos sin responder`);
}
