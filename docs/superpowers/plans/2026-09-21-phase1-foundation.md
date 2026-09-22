# Fase 1: Fundación — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tener MyFamilyTree desplegado en producción (web) con registro/login por magic link, un esquema de base de datos que refleja el modelo de datos de la spec, y el árbol/usuario propio auto-provisionado al primer login.

**Architecture:** App Expo (React Native + React Native Web, TypeScript, Expo Router) hablando directo con Supabase (Postgres + Auth + RLS) vía `@supabase/supabase-js`. Sin backend propio. Web exportada estáticamente y desplegada en Vercel con auto-deploy desde GitHub.

**Tech Stack:** Expo (SDK más reciente vía `create-expo-app@latest`), TypeScript, Expo Router, `@supabase/supabase-js`, Jest (`jest-expo` preset) + `@testing-library/react-native`, ESLint + Prettier, Vercel, Supabase (Postgres/Auth/Storage).

**Spec:** `docs/superpowers/specs/2026-09-21-myfamilytree-design.md`

## Alcance de esta fase

Esta fase cubre de la spec: §3 (modelo de datos — tablas base y RLS), §4 paso 1 (auto-provisión de árbol/persona al registrarse), y la mitad de §2/§7 (login por magic link, hosting en Vercel).

**Explícitamente diferido a fases posteriores** (no es un vacío de esta fase, es orden de trabajo):
- Login con Google OAuth (§2) — requiere configurar un proyecto en Google Cloud Console; se añade en la Fase 2 junto con las pantallas de árbol, para no bloquear el primer despliegue.
- CRUD de personas/relaciones, visualización del árbol y su carga incremental (§3, §10 adenda) — Fase 2.
- Invitaciones y colaboración entre árboles (§4) — Fase 3.
- Flujo de aprobación de cambios (`change_requests`/`change_history` ya existen en el esquema de esta fase, pero su UI y lógica de aplicación de cambios se implementan en Fase 4).
- Build de Android vía EAS — Fase posterior, requiere cuenta Expo autenticada interactivamente.

## Global Constraints

- Gestor de paquetes: npm.
- TypeScript en modo estricto en toda la app.
- Una sola base de código Expo para Web y Android (RN Web); nada de código nativo separado.
- El modelo de relaciones es solo aristas padre/madre-hijo (`biological` | `adoptive`); no existe relación "pareja" en la base de datos.
- Nadie edita `people` directamente vía UPDATE del cliente — todo cambio pasa por `change_requests` (ya definido en el esquema de esta fase, aplicado en Fase 4).
- Todo hosting en tiers gratuitos (Supabase free tier, Vercel free tier, Expo EAS free tier).

---

## Task 1: Scaffold del proyecto Expo

**Files:**
- Create: `package.json`, `app.json`, `tsconfig.json`, `babel.config.js` (generados por el scaffold)
- Create: `app/_layout.tsx`, `app/(tabs)/*` (generados; se limpian en tareas posteriores)

**Interfaces:**
- Consumes: nada (primera tarea).
- Produces: proyecto Expo ejecutable en el que las siguientes tareas instalan dependencias y agregan código.

- [ ] **Step 1: Scaffold en carpeta temporal para no chocar con los archivos existentes (docs/, CLAUDE.md, .gitignore)**

```bash
npx --yes create-expo-app@latest _scaffold_tmp
rm -rf _scaffold_tmp/.git
cp -a _scaffold_tmp/. .
rm -rf _scaffold_tmp
```

- [ ] **Step 2: Verificar que el proyecto compila**

Run: `npx tsc --noEmit`
Expected: sin errores de TypeScript.

- [ ] **Step 3: Verificar que el export web funciona**

Run: `npx expo export --platform web`
Expected: termina sin error y crea la carpeta `dist/`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: scaffold Expo app with TypeScript and Expo Router"
```

---

## Task 2: Lint y formato (ESLint + Prettier)

**Files:**
- Create: `.eslintrc.js`
- Create: `.prettierrc`
- Modify: `package.json:scripts`

**Interfaces:**
- Consumes: proyecto scaffolded en Task 1.
- Produces: comandos `npm run lint` y `npm run format` usados por el resto de las tareas antes de cada commit.

- [ ] **Step 1: Instalar dependencias**

```bash
npx expo install eslint eslint-config-expo prettier eslint-config-prettier --dev
```

- [ ] **Step 2: Crear `.eslintrc.js`**

```js
module.exports = {
  extends: ['expo', 'prettier'],
  ignorePatterns: ['/dist/*', '/_scaffold_tmp/*'],
};
```

- [ ] **Step 3: Crear `.prettierrc`**

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "es5",
  "printWidth": 100
}
```

- [ ] **Step 4: Agregar scripts a `package.json`**

```json
"scripts": {
  "lint": "eslint . --ext .ts,.tsx",
  "format": "prettier --write ."
}
```

- [ ] **Step 5: Verificar**

Run: `npm run lint`
Expected: termina sin errores (puede haber 0 warnings sobre el código generado por el scaffold; si los hay, corrígelos antes de continuar).

- [ ] **Step 6: Commit**

```bash
git add .eslintrc.js .prettierrc package.json package-lock.json
git commit -m "chore: add ESLint and Prettier config"
```

---

## Task 3: Jest + primera lógica de negocio real (prevención de ciclos)

**Files:**
- Create: `jest.setup.js`
- Modify: `package.json` (bloque `jest`, scripts)
- Create: `lib/family-graph.ts`
- Test: `lib/family-graph.test.ts`

**Interfaces:**
- Consumes: nada nuevo.
- Produces: `wouldCreateCycle(edges: RelationshipEdge[], newParentId: string, newChildId: string): boolean` — usada en Fase 2 antes de insertar una fila en `relationships` desde el cliente, para dar feedback inmediato sin esperar el round-trip a Postgres.

- [ ] **Step 1: Instalar dependencias de testing**

```bash
npx expo install jest-expo jest @types/jest --dev
npx expo install @testing-library/react-native react-test-renderer --dev
npx expo install @react-native-async-storage/async-storage
```

- [ ] **Step 2: Configurar Jest en `package.json`**

```json
"scripts": {
  "test": "jest"
},
"jest": {
  "preset": "jest-expo",
  "setupFiles": ["./jest.setup.js"]
}
```

- [ ] **Step 3: Crear `jest.setup.js`**

```js
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
```

- [ ] **Step 4: Escribir el test que falla primero**

Create `lib/family-graph.test.ts`:

```ts
import { wouldCreateCycle, RelationshipEdge } from './family-graph';

describe('wouldCreateCycle', () => {
  it('detects a direct cycle (person cannot be their own parent)', () => {
    const edges: RelationshipEdge[] = [];
    expect(wouldCreateCycle(edges, 'A', 'A')).toBe(true);
  });

  it('detects an indirect cycle through existing ancestors', () => {
    const edges: RelationshipEdge[] = [
      { parentId: 'A', childId: 'B' },
      { parentId: 'B', childId: 'C' },
    ];
    // C -> A cerraría el loop A -> B -> C -> A
    expect(wouldCreateCycle(edges, 'C', 'A')).toBe(true);
  });

  it('allows adding a second parent to the same child', () => {
    const edges: RelationshipEdge[] = [{ parentId: 'A', childId: 'B' }];
    expect(wouldCreateCycle(edges, 'C', 'B')).toBe(false);
  });

  it('allows unrelated new relationships', () => {
    const edges: RelationshipEdge[] = [{ parentId: 'A', childId: 'B' }];
    expect(wouldCreateCycle(edges, 'X', 'Y')).toBe(false);
  });
});
```

- [ ] **Step 5: Correr el test y confirmar que falla**

Run: `npx jest lib/family-graph.test.ts`
Expected: FAIL — `Cannot find module './family-graph'`.

- [ ] **Step 6: Implementar `lib/family-graph.ts`**

```ts
export type RelationshipEdge = {
  parentId: string;
  childId: string;
};

/**
 * Recorre hacia arriba desde newParentId por los edges existentes; si
 * llega a newChildId, agregar newParentId -> newChildId cerraría un ciclo.
 */
export function wouldCreateCycle(
  edges: RelationshipEdge[],
  newParentId: string,
  newChildId: string
): boolean {
  if (newParentId === newChildId) return true;

  const parentsOf = new Map<string, string[]>();
  for (const edge of edges) {
    const list = parentsOf.get(edge.childId) ?? [];
    list.push(edge.parentId);
    parentsOf.set(edge.childId, list);
  }

  const visited = new Set<string>();
  const stack = [newParentId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (visited.has(current)) continue;
    visited.add(current);
    if (current === newChildId) return true;
    const parents = parentsOf.get(current) ?? [];
    stack.push(...parents);
  }
  return false;
}
```

- [ ] **Step 7: Correr el test y confirmar que pasa**

Run: `npx jest lib/family-graph.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 8: Commit**

```bash
git add jest.setup.js package.json package-lock.json lib/family-graph.ts lib/family-graph.test.ts
git commit -m "feat: add cycle-prevention logic for family relationships"
```

---

## Task 4: Cliente de Supabase + configuración de entorno

**Files:**
- Create: `.env.example`
- Create: `lib/supabase.ts`
- Test: `lib/supabase.test.ts`
- Modify: `.gitignore` (ya ignora `.env`, verificar)

**Interfaces:**
- Consumes: nada nuevo.
- Produces: `supabase` (cliente exportado desde `lib/supabase.ts`), usado por toda pantalla que necesite auth o datos a partir de Task 6.

- [ ] **Step 1: Instalar dependencias**

```bash
npx expo install @supabase/supabase-js react-native-url-polyfill
```

- [ ] **Step 2: Crear `.env.example`**

```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

- [ ] **Step 3: Crear un proyecto en Supabase (manual, una vez)**

1. Entra a https://supabase.com, crea una cuenta gratuita si no tienes.
2. Crea un nuevo proyecto (elige una región cercana, cualquier contraseña de base de datos).
3. En Project Settings > API, copia "Project URL" y la clave "anon public".
4. Crea `.env` en la raíz (NO se commitea, ya está en `.gitignore`) con esos valores:

```
EXPO_PUBLIC_SUPABASE_URL=https://<tu-proyecto>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<tu-anon-key>
```

- [ ] **Step 4: Escribir el test que falla primero**

Create `lib/supabase.test.ts`:

```ts
describe('supabase client bootstrap', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('throws a clear error when env vars are missing', () => {
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    expect(() => require('./supabase')).toThrow(/EXPO_PUBLIC_SUPABASE_URL/);
  });

  it('creates a client when env vars are present', () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
    const { supabase } = require('./supabase');
    expect(supabase).toBeDefined();
    expect(typeof supabase.auth.signInWithOtp).toBe('function');
  });
});
```

- [ ] **Step 5: Correr el test y confirmar que falla**

Run: `npx jest lib/supabase.test.ts`
Expected: FAIL — `Cannot find module './supabase'`.

- [ ] **Step 6: Implementar `lib/supabase.ts`**

```ts
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env and fill in your Supabase project values.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: Platform.OS === 'web' ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});
```

- [ ] **Step 7: Correr el test y confirmar que pasa**

Run: `npx jest lib/supabase.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 8: Commit**

```bash
git add .env.example lib/supabase.ts lib/supabase.test.ts package.json package-lock.json
git commit -m "feat: add Supabase client bootstrap with env validation"
```

---

## Task 5: Esquema de base de datos, RLS y auto-provisión

**Files:**
- Create: `supabase/migrations/0001_init.sql`

**Interfaces:**
- Consumes: nada nuevo (SQL puro, no depende del código de la app).
- Produces: tablas `trees`, `people`, `relationships`, `tree_memberships`, `invitations`, `change_requests`, `change_history` en Postgres, más el trigger `on_auth_user_created` que Fase 2+ asume ya existe (todo usuario nuevo tiene automáticamente su propio `tree`, `people` y `tree_memberships`).

- [ ] **Step 1: Crear `supabase/migrations/0001_init.sql`**

```sql
create extension if not exists "uuid-ossp";

create table public.trees (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz not null default now()
);

create table public.people (
  id uuid primary key default uuid_generate_v4(),
  tree_id uuid not null references public.trees(id) on delete cascade,
  full_name text not null,
  photo_url text,
  birth_date date,
  birth_place text,
  death_date date,
  death_place text,
  is_living boolean not null default true,
  attributes jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id),
  claimed_by_user_id uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.relationships (
  id uuid primary key default uuid_generate_v4(),
  tree_id uuid not null references public.trees(id) on delete cascade,
  parent_id uuid not null references public.people(id) on delete cascade,
  child_id uuid not null references public.people(id) on delete cascade,
  type text not null check (type in ('biological', 'adoptive')),
  created_at timestamptz not null default now(),
  unique (parent_id, child_id)
);

create table public.tree_memberships (
  id uuid primary key default uuid_generate_v4(),
  tree_id uuid not null references public.trees(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  joined_at timestamptz not null default now(),
  unique (tree_id, user_id)
);

create table public.invitations (
  id uuid primary key default uuid_generate_v4(),
  tree_id uuid not null references public.trees(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  email text not null,
  invited_by uuid not null references auth.users(id),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'expired')),
  created_at timestamptz not null default now()
);

create table public.change_requests (
  id uuid primary key default uuid_generate_v4(),
  person_id uuid not null references public.people(id) on delete cascade,
  proposed_by uuid not null references auth.users(id),
  proposed_changes jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create table public.change_history (
  id uuid primary key default uuid_generate_v4(),
  person_id uuid not null references public.people(id) on delete cascade,
  change_request_id uuid not null references public.change_requests(id),
  applied_changes jsonb not null,
  proposed_by uuid not null references auth.users(id),
  approved_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.trees enable row level security;
alter table public.people enable row level security;
alter table public.relationships enable row level security;
alter table public.tree_memberships enable row level security;
alter table public.invitations enable row level security;
alter table public.change_requests enable row level security;
alter table public.change_history enable row level security;

create or replace function public.is_tree_member(target_tree_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.tree_memberships
    where tree_id = target_tree_id and user_id = auth.uid()
  );
$$;

create policy "members can view their trees"
  on public.trees for select
  using (public.is_tree_member(id));

create policy "members can view people in their trees"
  on public.people for select
  using (public.is_tree_member(tree_id));

create policy "members can add people to their trees"
  on public.people for insert
  with check (public.is_tree_member(tree_id) and created_by = auth.uid());

create policy "members can view relationships in their trees"
  on public.relationships for select
  using (public.is_tree_member(tree_id));

create policy "members can add relationships in their trees"
  on public.relationships for insert
  with check (public.is_tree_member(tree_id));

create policy "members can view memberships of their trees"
  on public.tree_memberships for select
  using (public.is_tree_member(tree_id));

create policy "members can view invitations in their trees"
  on public.invitations for select
  using (
    public.is_tree_member(tree_id)
    or email = auth.jwt() ->> 'email'
  );

create policy "members can create invitations in their trees"
  on public.invitations for insert
  with check (public.is_tree_member(tree_id) and invited_by = auth.uid());

create policy "members can view change requests in their trees"
  on public.change_requests for select
  using (
    exists (
      select 1 from public.people
      where people.id = change_requests.person_id
        and public.is_tree_member(people.tree_id)
    )
  );

create policy "members can propose change requests"
  on public.change_requests for insert
  with check (
    proposed_by = auth.uid()
    and exists (
      select 1 from public.people
      where people.id = change_requests.person_id
        and public.is_tree_member(people.tree_id)
    )
  );

create policy "only the node creator can decide a change request"
  on public.change_requests for update
  using (
    exists (
      select 1 from public.people
      where people.id = change_requests.person_id
        and people.created_by = auth.uid()
    )
  );

create policy "members can view change history in their trees"
  on public.change_history for select
  using (
    exists (
      select 1 from public.people
      where people.id = change_history.person_id
        and public.is_tree_member(people.tree_id)
    )
  );

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_tree_id uuid;
begin
  insert into public.trees default values returning id into new_tree_id;

  insert into public.people (tree_id, full_name, is_living, created_by, claimed_by_user_id)
  values (
    new_tree_id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    true,
    new.id,
    new.id
  );

  insert into public.tree_memberships (tree_id, user_id)
  values (new_tree_id, new.id);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

- [ ] **Step 2: Aplicar la migración (manual, vía dashboard de Supabase)**

1. Abre tu proyecto en https://supabase.com/dashboard.
2. Ve a SQL Editor > New query.
3. Pega el contenido completo de `supabase/migrations/0001_init.sql` y ejecútalo (Run).
4. Confirma en Table Editor que aparecen las 7 tablas (`trees`, `people`, `relationships`, `tree_memberships`, `invitations`, `change_requests`, `change_history`), cada una con el ícono de RLS activado.

- [ ] **Step 3: Verificar la auto-provisión manualmente**

1. En el dashboard, ve a Authentication > Users > Add user (crea un usuario de prueba con cualquier correo).
2. Ve a Table Editor > `people` y confirma que apareció automáticamente una fila con `claimed_by_user_id` igual al id de ese usuario.
3. Ve a `trees` y `tree_memberships` y confirma que también se crearon las filas correspondientes.
4. Borra el usuario de prueba cuando termines de verificar.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0001_init.sql
git commit -m "feat: add core database schema, RLS policies, and user auto-provisioning"
```

---

## Task 6: Pantallas de autenticación (magic link) y sesión

**Files:**
- Modify: `app/_layout.tsx`
- Create: `app/login.tsx`
- Test: `app/login.test.tsx`
- Modify: `app/index.tsx`

**Interfaces:**
- Consumes: `supabase` desde `lib/supabase.ts` (Task 4).
- Produces: flujo de navegación protegido por sesión — Fase 2 agrega pantallas dentro del mismo `Slot` protegido por `app/_layout.tsx`, asumiendo que si el usuario llegó ahí, `supabase.auth.getSession()` ya tiene sesión válida.

- [ ] **Step 1: Reemplazar `app/_layout.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setInitializing(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (initializing) return;
    const inAuthGroup = segments[0] === 'login';
    if (!session && !inAuthGroup) {
      router.replace('/login');
    } else if (session && inAuthGroup) {
      router.replace('/');
    }
  }, [session, initializing, segments]);

  if (initializing) return null;

  return <Slot />;
}
```

- [ ] **Step 2: Escribir el test que falla primero para el login**

Create `app/login.test.tsx`:

```tsx
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import LoginScreen from './login';
import { supabase } from '../lib/supabase';

jest.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithOtp: jest.fn(),
    },
  },
}));

describe('LoginScreen', () => {
  beforeEach(() => {
    (supabase.auth.signInWithOtp as jest.Mock).mockReset();
  });

  it('sends a magic link for the entered email', async () => {
    (supabase.auth.signInWithOtp as jest.Mock).mockResolvedValue({ error: null });
    const { getByTestId } = render(<LoginScreen />);

    fireEvent.changeText(getByTestId('email-input'), 'hermana@example.com');
    fireEvent.press(getByTestId('send-magic-link-button'));

    await waitFor(() => {
      expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith({
        email: 'hermana@example.com',
      });
    });
    expect(getByTestId('sent-message')).toBeTruthy();
  });

  it('shows an error message when the request fails', async () => {
    (supabase.auth.signInWithOtp as jest.Mock).mockResolvedValue({
      error: { message: 'Correo inválido' },
    });
    const { getByTestId } = render(<LoginScreen />);

    fireEvent.changeText(getByTestId('email-input'), 'bad');
    fireEvent.press(getByTestId('send-magic-link-button'));

    await waitFor(() => {
      expect(getByTestId('error-message').props.children).toBe('Correo inválido');
    });
  });
});
```

- [ ] **Step 3: Correr el test y confirmar que falla**

Run: `npx jest app/login.test.tsx`
Expected: FAIL — `Cannot find module './login'`.

- [ ] **Step 4: Crear `app/login.tsx`**

```tsx
import { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet } from 'react-native';
import { supabase } from '../lib/supabase';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  async function handleSendMagicLink() {
    setStatus('sending');
    setErrorMessage('');
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) {
      setStatus('error');
      setErrorMessage(error.message);
      return;
    }
    setStatus('sent');
  }

  return (
    <View style={styles.container} testID="login-screen">
      <Text style={styles.title}>MyFamilyTree</Text>
      <TextInput
        style={styles.input}
        placeholder="tu@correo.com"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        testID="email-input"
      />
      <Button
        title={status === 'sending' ? 'Enviando...' : 'Enviar link de acceso'}
        onPress={handleSendMagicLink}
        disabled={status === 'sending' || email.length === 0}
        testID="send-magic-link-button"
      />
      {status === 'sent' && (
        <Text style={styles.info} testID="sent-message">
          Revisa tu correo para el link de acceso.
        </Text>
      )}
      {status === 'error' && (
        <Text style={styles.error} testID="error-message">
          {errorMessage}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 24, fontWeight: '600', marginBottom: 16, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
  info: { color: '#2a7', textAlign: 'center' },
  error: { color: '#c33', textAlign: 'center' },
});
```

- [ ] **Step 5: Correr el test y confirmar que pasa**

Run: `npx jest app/login.test.tsx`
Expected: PASS, 2 tests.

- [ ] **Step 6: Reemplazar `app/index.tsx` con la pantalla de inicio autenticada**

```tsx
import { View, Text, Button, StyleSheet } from 'react-native';
import { supabase } from '../lib/supabase';

export default function HomeScreen() {
  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  return (
    <View style={styles.container} testID="home-screen">
      <Text style={styles.title}>Sesión iniciada</Text>
      <Button title="Cerrar sesión" onPress={handleSignOut} testID="sign-out-button" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  title: { fontSize: 20 },
});
```

- [ ] **Step 7: Eliminar pantallas de ejemplo del scaffold que ya no aplican**

Borra cualquier carpeta `app/(tabs)/` u otras rutas de ejemplo generadas por el scaffold que no sean `_layout.tsx`, `login.tsx` o `index.tsx`.

- [ ] **Step 8: Verificación manual end-to-end**

```bash
npx expo start --web
```

Abre la URL local, confirma que redirige a `/login`, ingresa tu correo real, revisa que llegue el correo de Supabase con el magic link, ábrelo, y confirma que aterrizas en la pantalla "Sesión iniciada".

- [ ] **Step 9: Commit**

```bash
git add app/
git commit -m "feat: add magic-link auth flow with session-protected navigation"
```

---

## Task 7: Despliegue a producción (GitHub + Vercel)

**Files:**
- Modify: `package.json:scripts` (agrega `build:web`)

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: URL pública en producción — el punto de partida sobre el que Fase 2 sigue iterando con despliegues automáticos en cada push.

- [ ] **Step 1: Agregar script de build a `package.json`**

```json
"scripts": {
  "build:web": "expo export --platform web"
}
```

- [ ] **Step 2: Crear el repositorio en GitHub y subir el código**

```bash
gh repo create myfamilytree --private --source=. --remote=origin --push
```

Si `gh` no está autenticado, crea el repo manualmente en https://github.com/new y luego:

```bash
git remote add origin <url-del-repo>
git push -u origin master
```

- [ ] **Step 3: Conectar Vercel (manual, vía dashboard)**

1. Entra a https://vercel.com, inicia sesión con tu cuenta de GitHub.
2. "Add New... > Project", importa el repo `myfamilytree`.
3. Framework Preset: "Other". Build Command: `npm run build:web`. Output Directory: `dist`.
4. En Environment Variables, agrega `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_ANON_KEY` con los mismos valores de tu `.env` local.
5. Deploy.

- [ ] **Step 4: Registrar la URL de producción en Supabase**

1. En el dashboard de Supabase, ve a Authentication > URL Configuration.
2. Agrega la URL de producción que te dio Vercel (y `http://localhost:8081` para desarrollo local) a "Redirect URLs", para que el magic link funcione en producción.

- [ ] **Step 5: Verificar el despliegue**

Run: `curl -s -o /dev/null -w "%{http_code}" https://<tu-url-de-vercel>.vercel.app`
Expected: `200`

Abre la URL en el navegador y confirma que ves la pantalla de login de MyFamilyTree. Repite el flujo de magic link contra producción para confirmar que el correo llega y la sesión se guarda.

- [ ] **Step 6: Commit**

```bash
git add package.json
git commit -m "chore: add web build script for Vercel deployment"
```

---

## Siguientes fases (no incluidas aquí)

- **Fase 2**: CRUD de personas/relaciones + visualización del árbol con carga incremental (spec §3, §10) + login con Google OAuth (spec §2).
- **Fase 3**: Invitaciones por correo a un nodo específico y unión al árbol compartido (spec §4).
- **Fase 4**: UI del flujo de `change_requests`/aprobación del creador (spec §3, §6) y build de Android vía EAS.
