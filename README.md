# Fitness Tracker

App móvil de seguimiento de salud, entrenamiento y comida, con un agente de IA que responde preguntas sobre tus datos.

- **App:** Expo SDK 57 + React Native, Expo Router, NativeWind, React Native Reusables.
- **API:** Express 5 + TypeScript, Prisma 7.
- **Base:** PostgreSQL en Supabase.

La arquitectura y las decisiones técnicas están en [ARQUITECTURA.md](./ARQUITECTURA.md).

## Requisitos

- Node.js 20 o superior y **pnpm** (`npm i -g pnpm`).
- Xcode con el simulador de iOS, o Android Studio con un emulador. La app usa pestañas nativas y **no corre en Expo Go**.
- Un proyecto en [Supabase](https://supabase.com) (plan gratuito).

## Levantar todo en local

### 1. Instalar dependencias

Desde la raíz del repo:

```bash
pnpm install
cd server && pnpm install && cd ..
```

### 2. Configurar la base de datos

1. En Supabase: **Connect** → **Session pooler** → copiá la connection string. Tiene que usar el puerto **5432** (no 6543).
2. Creá `server/.env` a partir del ejemplo y pegá la URL con tu contraseña:

```bash
cp server/.env.example server/.env
```

```env
DATABASE_URL="postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres"
PORT=3000
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=google/gemini-3.1-flash-lite
```

`OPENROUTER_API_KEY` se crea en [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys) y solo hace falta para el chat; el resto de la API levanta sin ella. El modelo es opcional (tiene que soportar tools).

3. Generá el cliente de Prisma y aplicá el esquema:

```bash
cd server
pnpm db:generate
pnpm db:migrate
```

> Usá siempre `pnpm exec prisma` o los scripts `pnpm db:*`. No uses `npx prisma`: puede resolver una versión distinta a la del proyecto.

### 3. Levantar la API

```bash
cd server
pnpm dev
```

Comprobá que conecta a la base:

```bash
curl http://localhost:3000/health
# {"ok":true,"db":"connected"}
```

### 4. Configurar la app

Creá `.env` en la raíz a partir del ejemplo:

```bash
cp .env.example .env
```

- **Simulador de iOS:** `EXPO_PUBLIC_API_URL=http://localhost:3000`
- **Celular físico:** tiene que estar en el mismo WiFi que la computadora y apuntar a su IP local, por ejemplo `http://192.168.0.15:3000`. La IP la ves con `ipconfig getifaddr en0` en macOS.
- `EXPO_PUBLIC_USER_ID`: mientras no hay login, la app manda este UUID fijo en el header `x-user-id`. Tiene que ser el mismo con el que se importaron los datos (el que usaste en el `curl` a `/api/health/import`).

### 5. Compilar y correr la app

La primera vez (o cada vez que se agrega un módulo nativo) hay que compilar el development build:

```bash
pnpm expo run:ios
# o
pnpm expo run:android
```

Tarda varios minutos la primera vez. Después, para el día a día alcanza con el servidor de desarrollo, que se conecta al build ya instalado:

```bash
pnpm dev
```

### 6. Probar el chat con IA

Con la API levantada y `OPENROUTER_API_KEY` configurada:

```bash
curl -X POST http://localhost:3000/api/chat \
  -H 'Content-Type: application/json' \
  -H 'x-user-id: <tu uuid>' \
  -d '{"messages":[{"role":"user","content":"¿Cómo dormí esta semana?"}]}'
# {"reply":"...","toolCalls":[{"name":"get_daily_health","args":"{...}"}],"model":"..."}
```

En la app es la pestaña **Chat**.

## Scripts útiles

| Dónde | Comando | Qué hace |
|---|---|---|
| raíz | `pnpm dev` | Servidor de desarrollo de Expo |
| raíz | `pnpm ios` / `pnpm android` | Idem, abriendo el simulador/emulador |
| server | `pnpm dev` | API con recarga automática |
| server | `pnpm db:migrate` | Crea y aplica una migración a partir del schema |
| server | `pnpm db:push` | Sincroniza el schema sin migración (solo prototipado) |
| server | `pnpm db:studio` | Abre Prisma Studio para ver los datos |
| server | `pnpm build` / `pnpm start` | Compila y corre la API en producción |

## Agregar componentes de UI

```bash
npx react-native-reusables/cli@latest add input textarea
```

Los componentes se copian a `components/ui/` y son código del proyecto.

## Estructura

```
fitnessTracker/
├── app/                # rutas de Expo Router
│   ├── _layout.tsx     # layout raíz: fuentes, tema, Stack
│   └── (tabs)/         # index (dashboard), salud, entrenamiento, comida, chat
├── components/         # componentes de UI
├── lib/api.ts          # cliente de la API (URL + header x-user-id)
├── server/             # API Express
│   ├── src/index.ts
│   ├── src/health/     # ingesta y consulta de Apple Health
│   ├── src/chat/       # agente: ruta /api/chat, loop con OpenRouter, tools
│   ├── src/lib/prisma.ts
│   ├── prisma/schema.prisma
│   └── prisma.config.ts
├── ARQUITECTURA.md
└── README.md
```
