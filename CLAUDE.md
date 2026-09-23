@AGENTS.md

# MyFamilyTree

## Qué es

Producto colaborativo de árboles genealógicos. Cada usuario arma su propio árbol y,
mediante invitaciones explícitas por correo a nodos específicos, los árboles de
distintos familiares se conectan hasta formar un grafo familiar compartido —
incluyendo personas fallecidas.

La spec completa de diseño (modelo de datos, flujo de colaboración, permisos, casos
límite) vive en `docs/superpowers/specs/2026-09-21-myfamilytree-design.md` (con
export en PDF junto al mismo archivo). Léela antes de tomar decisiones de
arquitectura o de producto — este archivo resume convenciones de trabajo, no
reemplaza la spec.

## Stack

- **Frontend**: Expo (React Native + React Native Web), TypeScript. Una sola base de
  código para Web y Android; iOS queda soportado por la misma arquitectura, activable
  después sin reescritura.
- **Backend**: Supabase (Postgres + Auth con Google OAuth/magic link + Storage).
- **Hosting**: Vercel (web, auto-deploy desde GitHub) y Expo EAS Build (Android,
  tier gratuito).

## Decisiones de arquitectura clave (no las repitas, ya están tomadas)

- El modelo de relaciones familiares usa **solo aristas padre/madre-hijo**
  (`biological` | `adoptive`). No existe una relación "pareja/cónyuge" independiente
  en v1 — se infiere por hijos compartidos. Tíos/primos se calculan por recorrido del
  grafo, no se almacenan.
- Conexión entre árboles **solo vía invitación explícita** a un correo, atada a un
  nodo específico. Sin detección automática de duplicados ni búsqueda pública en v1
  (eso es v2).
- Edición de un nodo: cualquier colaborador del árbol puede proponer un cambio, pero
  requiere aprobación de quien creó ese nodo (`change_requests` con historial en
  `change_history`).

## Requisito de rendimiento: carga incremental del árbol

**Importante, dado por el usuario:** la aplicación debe ser inteligente sobre cómo
carga datos a medida que el árbol crece con el tiempo (múltiples generaciones y
ramas por fusión de árboles). No se debe cargar el grafo completo de una vez.

Esto aplica en dos capas:
- **API/consultas**: las consultas recursivas (CTEs) sobre `relationships` deben
  acotarse por profundidad/ventana (ej. N generaciones arriba/abajo desde el nodo
  enfocado), nunca traer el árbol completo en una sola llamada.
- **UI**: la vista del árbol debe cargar y renderizar solo la porción visible/cercana
  al nodo actual, y pedir más datos (ancestros, descendientes, ramas colapsadas) a
  medida que el usuario navega o expande un nodo — no precargar todo el grafo al
  entrar a la vista.

Tenlo presente al diseñar el esquema de queries del backend y los componentes de
visualización del árbol en el plan de implementación.

## Pendientes antes de tener usuarios reales

- **SMTP propio para Supabase Auth**: el servicio de correo integrado de Supabase
  (plan free) tiene un límite muy bajo de envíos por hora (pensado solo para pruebas
  ligeras) — nos topamos con "email rate limit exceeded" solo probando el flujo de
  magic link manualmente. Antes de invitar usuarios reales hay que configurar un
  proveedor SMTP propio (ej. Resend, tiene tier gratuito) en Authentication > Emails
  del dashboard de Supabase.

## Infraestructura desplegada (Fase 1)

- Proyecto de Supabase: ver `.env` local para URL/anon key (no está commiteado).
  Site URL y Redirect URLs en Authentication > URL Configuration ya apuntan a
  producción + `http://localhost:8081`.
- Producción (web): desplegado en Vercel desde el repo de GitHub
  `jfg-my-apps/myfamilytree` (público — sin secretos en el código, `.env` está
  gitignored). Auto-deploy en cada push a `main`.
- `vercel.json` tiene `cleanUrls: true` — sin esto, rutas como `/login` dan 404
  porque el export estático de Expo genera `login.html`, no `login/index.html`.

## Cómo mantener este archivo

Este archivo es memoria viva del proyecto. Cuando en una sesión se tome una decisión
de arquitectura, convención o restricción que una sesión futura necesitaría conocer
sin que se le repita, agrégala aquí (sección correspondiente, o una nueva si no
encaja). No documentes aquí detalles que ya se puedan derivar leyendo el código o la
spec — solo lo que no es obvio ni está escrito en otro lado.

## Comandos

- `npm run web` — servidor de desarrollo (Expo, plataforma web).
- `npm test` — corre la suite de Jest (`jest-expo` preset).
- `npm run lint` — `expo lint` (ESLint, flat config en `eslint.config.js`).
- `npm run format` — Prettier sobre todo el repo.
- `npm run build:web` — export estático para producción (lo usa Vercel como Build
  Command, con Output Directory `dist`).
- Requiere `.env` local (copiar de `.env.example`) con
  `EXPO_PUBLIC_SUPABASE_URL`/`EXPO_PUBLIC_SUPABASE_ANON_KEY` de tu proyecto Supabase.
