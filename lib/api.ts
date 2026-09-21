/**
 * Cliente mínimo de la API. La URL y el usuario salen de variables EXPO_PUBLIC_*
 * (ver .env.example). El usuario es provisorio: hasta que haya login, la app
 * manda un UUID fijo en el header `x-user-id`.
 */
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
const USER_ID = process.env.EXPO_PUBLIC_USER_ID ?? '';

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': USER_ID,
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // sin body JSON: queda el status
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

export type ChatResponse = {
  reply: string;
  toolCalls: { name: string; args: string }[];
  model: string;
};

/** Manda el historial completo; el server corre el agente y devuelve la respuesta final. */
export function sendChat(messages: ChatMessage[]) {
  return api<ChatResponse>('/api/chat', { method: 'POST', body: JSON.stringify({ messages }) });
}
