# Fase 2: CRUD del árbol y visualización — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar la pantalla "Sesión iniciada" por la vista real del árbol: un diagrama de nodos conectados que carga solo el vecindario del usuario (padres, hijos, hermanos) y permite expandir cualquier nodo cargado o agregar familiares nuevos directamente desde el diagrama.

**Architecture:** Capa de datos pura y testeable (`src/lib/tree-layout.ts`, `src/lib/tree-slots.ts`, `src/lib/tree-data.ts`) separada de los componentes de presentación (`src/components/tree/*`). La pantalla `src/app/index.tsx` orquesta: carga el vecindario inicial, calcula layout y slots vacíos, renderiza `TreeCanvas` (SVG sobre `react-native-svg`), y navega a `src/app/add-person.tsx` para crear personas nuevas. Cada tap sobre un nodo ya cargado dispara una consulta acotada a ese nodo y fusiona el resultado al estado en memoria — nunca se trae el árbol completo (requisito de `CLAUDE.md`).

**Tech Stack:** El mismo de la Fase 1 (Expo/TypeScript/Supabase) más `react-native-svg` para el diagrama.

**Spec:** `docs/superpowers/specs/2026-09-21-myfamilytree-design.md` (§3 modelo de datos, §10 adenda de carga incremental) y el plan de Fase 1 (`docs/superpowers/plans/2026-09-21-phase1-foundation.md`) para la base ya construida.

## Alcance de esta fase

**Incluido:**
- Algoritmo de layout por generación (ancestros arriba, descendientes abajo, hermanos en la misma fila).
- Consultas acotadas: vecindario de un nodo (padres, hijos, hermanos por padre compartido), fusionadas incrementalmente al expandir.
- Crear una persona nueva como padre/madre, hijo o hermano de cualquier nodo ya cargado, desde slots vacíos en el propio diagrama.
- Diagrama visual con `react-native-svg`, navegable con scroll en ambos ejes.

**Explícitamente fuera de alcance (fases posteriores):**
- Login con Google OAuth (fase propia, pospuesta desde la Fase 1).
- Pinch-to-zoom / gestos avanzados — por ahora scroll simple en ambos ejes; se agrega como pulido posterior si el árbol crece mucho.
- Subir foto de perfil (la columna `photo_url` existe en el esquema desde la Fase 1, pero ningún flujo la usa todavía).
- Editar una persona ya creada, o cualquier flujo de `change_requests`/aprobación — esta fase solo crea personas nuevas, nunca vincula una persona ya existente a otro punto del árbol, así que `wouldCreateCycle` (de la Fase 1) no se usa aquí: un ciclo solo es posible al vincular dos personas que ya existen, y eso llega recién con invitaciones (Fase 3) o fusión de duplicados (v2).
- Relación "pareja" independiente, búsqueda pública, medio-hermanos explícitos — igual que en la spec original.

## Global Constraints

- Todo lo de la Fase 1 (ver ese plan) sigue vigente: solo aristas padre-hijo, npm, TypeScript estricto, tiers gratuitos.
- Ninguna consulta debe traer el árbol completo — siempre acotada al vecindario de un nodo específico.
- Cada función de datos/lógica pura (`tree-layout.ts`, `tree-slots.ts`) debe ser testeable sin red ni Supabase real, igual que `family-graph.ts` en la Fase 1.

---

## Task 1: Algoritmo de layout por generación

**Files:**
- Create: `src/lib/tree-layout.ts`
- Test: `src/lib/tree-layout.test.ts`

**Interfaces:**
- Consumes: `RelationshipEdge` de `src/lib/family-graph.ts` (Fase 1).
- Produces: `PersonPosition` type, `computeTreeLayout(personIds, edges, focusPersonId): PersonPosition[]`, y las constantes `NODE_SPACING_X`/`GENERATION_SPACING_Y` — Task 2 las reutiliza para posicionar slots vacíos en la misma cuadrícula.

- [ ] **Step 1: Escribir el test que falla primero**

Create `src/lib/tree-layout.test.ts`:

```ts
import { computeTreeLayout } from './tree-layout';
import { RelationshipEdge } from './family-graph';

describe('computeTreeLayout', () => {
  it('places a lone focus person at the origin', () => {
    const positions = computeTreeLayout(['me'], [], 'me');
    expect(positions).toEqual([{ personId: 'me', x: 0, y: 0, generation: 0 }]);
  });

  it('places a parent above and a child below the focus person', () => {
    const edges: RelationshipEdge[] = [
      { parentId: 'mom', childId: 'me' },
      { parentId: 'me', childId: 'kid' },
    ];
    const positions = computeTreeLayout(['me', 'mom', 'kid'], edges, 'me');

    const byId = Object.fromEntries(positions.map((p) => [p.personId, p]));
    expect(byId.me).toEqual({ personId: 'me', x: 0, y: 0, generation: 0 });
    expect(byId.mom.generation).toBe(-1);
    expect(byId.mom.y).toBeLessThan(0);
    expect(byId.kid.generation).toBe(1);
    expect(byId.kid.y).toBeGreaterThan(0);
  });

  it('places siblings (shared parent) in the same row as the focus person, sorted and spaced', () => {
    const edges: RelationshipEdge[] = [
      { parentId: 'mom', childId: 'A' },
      { parentId: 'mom', childId: 'B' },
      { parentId: 'mom', childId: 'C' },
    ];
    const positions = computeTreeLayout(['A', 'B', 'C', 'mom'], edges, 'B');

    const byId = Object.fromEntries(positions.map((p) => [p.personId, p]));
    expect(byId.A.generation).toBe(0);
    expect(byId.B.generation).toBe(0);
    expect(byId.C.generation).toBe(0);
    // sorted alphabetically and centered: A, B, C -> -220, 0, 220
    expect(byId.A.x).toBeLessThan(byId.B.x);
    expect(byId.B.x).toBeLessThan(byId.C.x);
    expect(byId.B.x).toBe(0);
  });
});
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `npx jest src/lib/tree-layout.test.ts`
Expected: FAIL — `Cannot find module './tree-layout'`.

- [ ] **Step 3: Implementar `src/lib/tree-layout.ts`**

```ts
import { RelationshipEdge } from './family-graph';

export type PersonPosition = {
  personId: string;
  x: number;
  y: number;
  generation: number;
};

export const NODE_SPACING_X = 220;
export const GENERATION_SPACING_Y = 160;

export function computeTreeLayout(
  personIds: string[],
  edges: RelationshipEdge[],
  focusPersonId: string
): PersonPosition[] {
  const generationById = new Map<string, number>();
  generationById.set(focusPersonId, 0);

  const adjacency = new Map<string, { neighborId: string; delta: number }[]>();
  function addAdjacency(from: string, to: string, delta: number) {
    const list = adjacency.get(from) ?? [];
    list.push({ neighborId: to, delta });
    adjacency.set(from, list);
  }
  for (const edge of edges) {
    addAdjacency(edge.parentId, edge.childId, 1);
    addAdjacency(edge.childId, edge.parentId, -1);
  }

  const queue = [focusPersonId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentGeneration = generationById.get(current)!;
    for (const { neighborId, delta } of adjacency.get(current) ?? []) {
      if (!generationById.has(neighborId)) {
        generationById.set(neighborId, currentGeneration + delta);
        queue.push(neighborId);
      }
    }
  }

  const byGeneration = new Map<number, string[]>();
  for (const personId of personIds) {
    const generation = generationById.get(personId) ?? 0;
    const list = byGeneration.get(generation) ?? [];
    list.push(personId);
    byGeneration.set(generation, list);
  }

  const positions: PersonPosition[] = [];
  for (const [generation, ids] of byGeneration) {
    const sorted = [...ids].sort();
    const offset = ((sorted.length - 1) * NODE_SPACING_X) / 2;
    sorted.forEach((personId, index) => {
      positions.push({
        personId,
        x: index * NODE_SPACING_X - offset,
        y: generation * GENERATION_SPACING_Y,
        generation,
      });
    });
  }

  return positions;
}
```

- [ ] **Step 4: Correr el test y confirmar que pasa**

Run: `npx jest src/lib/tree-layout.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Typecheck y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/lib/tree-layout.ts src/lib/tree-layout.test.ts
git commit -m "feat: add generation-based tree layout algorithm"
```

---

## Task 2: Slots vacíos ("+ Agregar padre/hijo/hermano")

**Files:**
- Create: `src/lib/tree-slots.ts`
- Test: `src/lib/tree-slots.test.ts`

**Interfaces:**
- Consumes: `RelationshipEdge` (Fase 1), `PersonPosition`/`NODE_SPACING_X`/`GENERATION_SPACING_Y` de `src/lib/tree-layout.ts` (Task 1).
- Produces: `EmptySlot` type (`{ personId, role: 'parent' | 'child' | 'sibling' }`), `computeEmptySlots(personIds, edges): EmptySlot[]`, `PositionedSlot` type, `computeSlotPositions(slots, personPositions): PositionedSlot[]` — Task 6 (`TreeCanvas`) los consume para renderizar los slots.

- [ ] **Step 1: Escribir el test que falla primero**

Create `src/lib/tree-slots.test.ts`:

```ts
import { computeEmptySlots, computeSlotPositions } from './tree-slots';
import { RelationshipEdge } from './family-graph';
import { computeTreeLayout } from './tree-layout';

describe('computeEmptySlots', () => {
  it('offers a parent slot and a child slot for a person with no relationships', () => {
    const slots = computeEmptySlots(['me'], []);
    expect(slots).toContainEqual({ personId: 'me', role: 'parent' });
    expect(slots).toContainEqual({ personId: 'me', role: 'child' });
    expect(slots).not.toContainEqual({ personId: 'me', role: 'sibling' });
  });

  it('stops offering a parent slot once 2 parents are recorded', () => {
    const edges: RelationshipEdge[] = [
      { parentId: 'mom', childId: 'me' },
      { parentId: 'dad', childId: 'me' },
    ];
    const slots = computeEmptySlots(['me'], edges);
    expect(slots.filter((s) => s.personId === 'me' && s.role === 'parent')).toHaveLength(0);
  });

  it('offers a sibling slot once at least 1 parent is recorded', () => {
    const edges: RelationshipEdge[] = [{ parentId: 'mom', childId: 'me' }];
    const slots = computeEmptySlots(['me'], edges);
    expect(slots).toContainEqual({ personId: 'me', role: 'sibling' });
  });
});

describe('computeSlotPositions', () => {
  it('places a parent slot one generation above its reference person', () => {
    const positions = computeTreeLayout(['me'], [], 'me');
    const slots = computeSlotPositions([{ personId: 'me', role: 'parent' }], positions);
    expect(slots[0].y).toBeLessThan(positions[0].y);
  });

  it('places a child slot one generation below its reference person', () => {
    const positions = computeTreeLayout(['me'], [], 'me');
    const slots = computeSlotPositions([{ personId: 'me', role: 'child' }], positions);
    expect(slots[0].y).toBeGreaterThan(positions[0].y);
  });
});
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `npx jest src/lib/tree-slots.test.ts`
Expected: FAIL — `Cannot find module './tree-slots'`.

- [ ] **Step 3: Implementar `src/lib/tree-slots.ts`**

```ts
import { RelationshipEdge } from './family-graph';
import { GENERATION_SPACING_Y, NODE_SPACING_X, PersonPosition } from './tree-layout';

export type SlotRole = 'parent' | 'child' | 'sibling';

export type EmptySlot = {
  personId: string;
  role: SlotRole;
};

export type PositionedSlot = EmptySlot & { x: number; y: number };

const MAX_PARENTS = 2;

export function computeEmptySlots(personIds: string[], edges: RelationshipEdge[]): EmptySlot[] {
  const slots: EmptySlot[] = [];
  for (const personId of personIds) {
    const parentCount = edges.filter((e) => e.childId === personId).length;
    if (parentCount < MAX_PARENTS) {
      slots.push({ personId, role: 'parent' });
    }
    slots.push({ personId, role: 'child' });
    if (parentCount > 0) {
      slots.push({ personId, role: 'sibling' });
    }
  }
  return slots;
}

export function computeSlotPositions(
  slots: EmptySlot[],
  personPositions: PersonPosition[]
): PositionedSlot[] {
  const positionByPersonId = new Map(personPositions.map((p) => [p.personId, p]));
  const countPerGenerationRow = new Map<number, number>();
  for (const position of personPositions) {
    countPerGenerationRow.set(
      position.generation,
      (countPerGenerationRow.get(position.generation) ?? 0) + 1
    );
  }

  return slots.map((slot) => {
    const anchor = positionByPersonId.get(slot.personId);
    const anchorGeneration = anchor?.generation ?? 0;
    const generation =
      slot.role === 'parent'
        ? anchorGeneration - 1
        : slot.role === 'child'
          ? anchorGeneration + 1
          : anchorGeneration;

    const indexInRow = countPerGenerationRow.get(generation) ?? 0;
    countPerGenerationRow.set(generation, indexInRow + 1);

    return {
      ...slot,
      x: indexInRow * NODE_SPACING_X,
      y: generation * GENERATION_SPACING_Y,
    };
  });
}
```

- [ ] **Step 4: Correr el test y confirmar que pasa**

Run: `npx jest src/lib/tree-slots.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Typecheck, lint, commit**

```bash
npx tsc --noEmit && npm run lint
git add src/lib/tree-slots.ts src/lib/tree-slots.test.ts
git commit -m "feat: add empty-slot computation for adding relatives"
```

---

## Task 3: Consultas de lectura del vecindario (`tree-data.ts`)

**Files:**
- Create: `src/lib/tree-data.ts`
- Test: `src/lib/tree-data.test.ts`

**Interfaces:**
- Consumes: `supabase` de `src/lib/supabase.ts` (Fase 1), `RelationshipEdge` de `family-graph.ts`.
- Produces: `Person` type, `Neighborhood` type (`{ people: Person[]; edges: RelationshipEdge[] }`), `fetchNeighborhood(personId): Promise<Neighborhood>`, `fetchMyPersonId(): Promise<{ personId: string; treeId: string }>`, `mergeNeighborhoods(a, b): Neighborhood` — Task 8 (pantalla del árbol) los usa para cargar y expandir el grafo.

- [ ] **Step 1: Escribir los tests que fallan primero**

Create `src/lib/tree-data.test.ts`:

```ts
import { mergeNeighborhoods, Neighborhood } from './tree-data';

describe('mergeNeighborhoods', () => {
  it('unions people by id without duplicates', () => {
    const a: Neighborhood = {
      people: [{ id: '1', fullName: 'A', isLiving: true, birthDate: null, deathDate: null }],
      edges: [],
    };
    const b: Neighborhood = {
      people: [
        { id: '1', fullName: 'A', isLiving: true, birthDate: null, deathDate: null },
        { id: '2', fullName: 'B', isLiving: true, birthDate: null, deathDate: null },
      ],
      edges: [],
    };
    const merged = mergeNeighborhoods(a, b);
    expect(merged.people.map((p) => p.id).sort()).toEqual(['1', '2']);
  });

  it('unions edges without duplicating the same parent-child pair', () => {
    const a: Neighborhood = { people: [], edges: [{ parentId: 'p', childId: 'c' }] };
    const b: Neighborhood = {
      people: [],
      edges: [
        { parentId: 'p', childId: 'c' },
        { parentId: 'p', childId: 'c2' },
      ],
    };
    const merged = mergeNeighborhoods(a, b);
    expect(merged.edges).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `npx jest src/lib/tree-data.test.ts`
Expected: FAIL — `Cannot find module './tree-data'`.

- [ ] **Step 3: Implementar `src/lib/tree-data.ts` (lectura)**

```ts
import { supabase } from './supabase';
import { RelationshipEdge } from './family-graph';

export type Person = {
  id: string;
  fullName: string;
  isLiving: boolean;
  birthDate: string | null;
  deathDate: string | null;
};

export type Neighborhood = {
  people: Person[];
  edges: RelationshipEdge[];
};

type PersonRow = {
  id: string;
  full_name: string;
  is_living: boolean;
  birth_date: string | null;
  death_date: string | null;
};

type RelationshipRow = {
  parent_id: string;
  child_id: string;
};

function mapPersonRow(row: PersonRow): Person {
  return {
    id: row.id,
    fullName: row.full_name,
    isLiving: row.is_living,
    birthDate: row.birth_date,
    deathDate: row.death_date,
  };
}

function dedupeEdges(edges: RelationshipEdge[]): RelationshipEdge[] {
  const seen = new Set<string>();
  const result: RelationshipEdge[] = [];
  for (const edge of edges) {
    const key = `${edge.parentId}:${edge.childId}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(edge);
    }
  }
  return result;
}

export async function fetchMyPersonId(): Promise<{ personId: string; treeId: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('people')
    .select('id, tree_id')
    .eq('claimed_by_user_id', user.id)
    .single();
  if (error) throw error;
  return { personId: data.id, treeId: data.tree_id };
}

export async function fetchNeighborhood(personId: string): Promise<Neighborhood> {
  const [{ data: asChild, error: asChildError }, { data: asParent, error: asParentError }] =
    await Promise.all([
      supabase
        .from('relationships')
        .select('parent_id, child_id')
        .eq('child_id', personId)
        .returns<RelationshipRow[]>(),
      supabase
        .from('relationships')
        .select('parent_id, child_id')
        .eq('parent_id', personId)
        .returns<RelationshipRow[]>(),
    ]);
  if (asChildError) throw asChildError;
  if (asParentError) throw asParentError;

  const parentIds = (asChild ?? []).map((r) => r.parent_id);
  const childIds = (asParent ?? []).map((r) => r.child_id);

  let siblingEdges: RelationshipRow[] = [];
  if (parentIds.length > 0) {
    const { data, error } = await supabase
      .from('relationships')
      .select('parent_id, child_id')
      .in('parent_id', parentIds)
      .returns<RelationshipRow[]>();
    if (error) throw error;
    siblingEdges = data ?? [];
  }

  const allEdgeRows = [...(asChild ?? []), ...(asParent ?? []), ...siblingEdges];
  const edges = dedupeEdges(
    allEdgeRows.map((r) => ({ parentId: r.parent_id, childId: r.child_id }))
  );

  const personIds = Array.from(
    new Set([personId, ...parentIds, ...childIds, ...siblingEdges.map((r) => r.child_id)])
  );

  const { data: people, error: peopleError } = await supabase
    .from('people')
    .select('id, full_name, is_living, birth_date, death_date')
    .in('id', personIds)
    .returns<PersonRow[]>();
  if (peopleError) throw peopleError;

  return { people: (people ?? []).map(mapPersonRow), edges };
}

export function mergeNeighborhoods(a: Neighborhood, b: Neighborhood): Neighborhood {
  const peopleById = new Map(a.people.map((p) => [p.id, p]));
  for (const person of b.people) peopleById.set(person.id, person);

  const edgeKeys = new Set(a.edges.map((e) => `${e.parentId}:${e.childId}`));
  const edges = [...a.edges];
  for (const edge of b.edges) {
    const key = `${edge.parentId}:${edge.childId}`;
    if (!edgeKeys.has(key)) {
      edgeKeys.add(key);
      edges.push(edge);
    }
  }

  return { people: Array.from(peopleById.values()), edges };
}
```

- [ ] **Step 4: Correr el test y confirmar que pasa**

Run: `npx jest src/lib/tree-data.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Typecheck, lint, commit**

```bash
npx tsc --noEmit && npm run lint
git add src/lib/tree-data.ts src/lib/tree-data.test.ts
git commit -m "feat: add neighborhood queries and merge logic for the tree view"
```

---

## Task 4: Crear personas (padre/hijo/hermano)

**Files:**
- Modify: `src/lib/tree-data.ts`
- Modify: `src/lib/tree-data.test.ts`

**Interfaces:**
- Consumes: `supabase` (Fase 1), `Person` type (Task 3).
- Produces: `createPersonWithRelationship(params): Promise<Person>`, `createSibling(params): Promise<Person>` — Task 7 (formulario) los invoca al enviar.

- [ ] **Step 1: Escribir los tests que fallan primero**

Replace the full contents of `src/lib/tree-data.test.ts` (adds the new imports/mock at the top, keeps the existing `mergeNeighborhoods` tests unchanged, and appends the two new `describe` blocks):

```ts
import { createPersonWithRelationship, createSibling, mergeNeighborhoods, Neighborhood } from './tree-data';
import { supabase } from './supabase';

jest.mock('./supabase', () => ({
  supabase: {
    from: jest.fn(),
    auth: { getUser: jest.fn() },
  },
}));

describe('mergeNeighborhoods', () => {
  it('unions people by id without duplicates', () => {
    const a: Neighborhood = {
      people: [{ id: '1', fullName: 'A', isLiving: true, birthDate: null, deathDate: null }],
      edges: [],
    };
    const b: Neighborhood = {
      people: [
        { id: '1', fullName: 'A', isLiving: true, birthDate: null, deathDate: null },
        { id: '2', fullName: 'B', isLiving: true, birthDate: null, deathDate: null },
      ],
      edges: [],
    };
    const merged = mergeNeighborhoods(a, b);
    expect(merged.people.map((p) => p.id).sort()).toEqual(['1', '2']);
  });

  it('unions edges without duplicating the same parent-child pair', () => {
    const a: Neighborhood = { people: [], edges: [{ parentId: 'p', childId: 'c' }] };
    const b: Neighborhood = {
      people: [],
      edges: [
        { parentId: 'p', childId: 'c' },
        { parentId: 'p', childId: 'c2' },
      ],
    };
    const merged = mergeNeighborhoods(a, b);
    expect(merged.edges).toHaveLength(2);
  });
});

describe('createPersonWithRelationship', () => {
  it('inserts the person then the parent-child relationship in the right direction', async () => {
    const insertedPerson = {
      id: 'new-id',
      full_name: 'Abuela',
      is_living: false,
      birth_date: null,
      death_date: null,
    };
    const single = jest.fn().mockResolvedValue({ data: insertedPerson, error: null });
    const select = jest.fn().mockReturnValue({ single });
    const personInsert = jest.fn().mockReturnValue({ select });
    const relInsert = jest.fn().mockResolvedValue({ error: null });

    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'people') return { insert: personInsert };
      if (table === 'relationships') return { insert: relInsert };
      throw new Error(`unexpected table ${table}`);
    });

    const result = await createPersonWithRelationship({
      treeId: 'tree-1',
      fullName: 'Abuela',
      isLiving: false,
      relationship: { role: 'parent', otherPersonId: 'me', type: 'biological' },
      createdBy: 'user-1',
    });

    expect(result.id).toBe('new-id');
    expect(relInsert).toHaveBeenCalledWith({
      tree_id: 'tree-1',
      parent_id: 'new-id',
      child_id: 'me',
      type: 'biological',
    });
  });
});

describe('createSibling', () => {
  it('links the new person as a child of every existing parent', async () => {
    const insertedPerson = {
      id: 'new-id',
      full_name: 'Hermano',
      is_living: true,
      birth_date: null,
      death_date: null,
    };
    const single = jest.fn().mockResolvedValue({ data: insertedPerson, error: null });
    const select = jest.fn().mockReturnValue({ single });
    const personInsert = jest.fn().mockReturnValue({ select });
    const relInsert = jest.fn().mockResolvedValue({ error: null });

    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'people') return { insert: personInsert };
      if (table === 'relationships') return { insert: relInsert };
      throw new Error(`unexpected table ${table}`);
    });

    await createSibling({
      treeId: 'tree-1',
      fullName: 'Hermano',
      isLiving: true,
      parentIds: ['mom', 'dad'],
      type: 'biological',
      createdBy: 'user-1',
    });

    expect(relInsert).toHaveBeenCalledWith([
      { tree_id: 'tree-1', parent_id: 'mom', child_id: 'new-id', type: 'biological' },
      { tree_id: 'tree-1', parent_id: 'dad', child_id: 'new-id', type: 'biological' },
    ]);
  });
});
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `npx jest src/lib/tree-data.test.ts`
Expected: FAIL — `createPersonWithRelationship`/`createSibling` no exportados.

- [ ] **Step 3: Agregar las funciones a `src/lib/tree-data.ts`**

```ts
export type RelationshipType = 'biological' | 'adoptive';

export async function createPersonWithRelationship(params: {
  treeId: string;
  fullName: string;
  isLiving: boolean;
  birthDate?: string;
  relationship: { role: 'parent' | 'child'; otherPersonId: string; type: RelationshipType };
  createdBy: string;
}): Promise<Person> {
  const { data: person, error: personError } = await supabase
    .from('people')
    .insert({
      tree_id: params.treeId,
      full_name: params.fullName,
      is_living: params.isLiving,
      birth_date: params.birthDate ?? null,
      created_by: params.createdBy,
    })
    .select('id, full_name, is_living, birth_date, death_date')
    .single();
  if (personError) throw personError;

  const parentId =
    params.relationship.role === 'parent' ? person.id : params.relationship.otherPersonId;
  const childId =
    params.relationship.role === 'parent' ? params.relationship.otherPersonId : person.id;

  const { error: relError } = await supabase.from('relationships').insert({
    tree_id: params.treeId,
    parent_id: parentId,
    child_id: childId,
    type: params.relationship.type,
  });
  if (relError) throw relError;

  return mapPersonRow(person);
}

export async function createSibling(params: {
  treeId: string;
  fullName: string;
  isLiving: boolean;
  birthDate?: string;
  parentIds: string[];
  type: RelationshipType;
  createdBy: string;
}): Promise<Person> {
  const { data: person, error: personError } = await supabase
    .from('people')
    .insert({
      tree_id: params.treeId,
      full_name: params.fullName,
      is_living: params.isLiving,
      birth_date: params.birthDate ?? null,
      created_by: params.createdBy,
    })
    .select('id, full_name, is_living, birth_date, death_date')
    .single();
  if (personError) throw personError;

  const rows = params.parentIds.map((parentId) => ({
    tree_id: params.treeId,
    parent_id: parentId,
    child_id: person.id,
    type: params.type,
  }));
  const { error: relError } = await supabase.from('relationships').insert(rows);
  if (relError) throw relError;

  return mapPersonRow(person);
}
```

- [ ] **Step 4: Correr el test y confirmar que pasa**

Run: `npx jest src/lib/tree-data.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Typecheck, lint, commit**

```bash
npx tsc --noEmit && npm run lint
git add src/lib/tree-data.ts src/lib/tree-data.test.ts
git commit -m "feat: add person/relationship creation to tree-data"
```

---

## Task 5: Instalar react-native-svg y componentes de nodo/slot

**Files:**
- Create: `src/components/tree/PersonNode.tsx`
- Create: `src/components/tree/EmptySlotBox.tsx`
- Test: `src/components/tree/__tests__/PersonNode.test.tsx`
- Test: `src/components/tree/__tests__/EmptySlotBox.test.tsx`

**Interfaces:**
- Consumes: `Person` (Task 3), `PositionedSlot` (Task 2).
- Produces: `<PersonNode person={Person} x={number} y={number} onPress={() => void} />`, `<EmptySlotBox slot={PositionedSlot} label={string} onPress={() => void} />` — Task 6 (`TreeCanvas`) los renderiza dentro del SVG.

- [ ] **Step 1: Instalar `react-native-svg`**

```bash
npx expo install react-native-svg
```

- [ ] **Step 2: Escribir los tests que fallan primero**

Create `src/components/tree/__tests__/PersonNode.test.tsx`:

```tsx
import { fireEvent, render } from '@testing-library/react-native';
import { PersonNode } from '../PersonNode';

describe('PersonNode', () => {
  it('calls onPress when tapped', async () => {
    const onPress = jest.fn();
    const person = { id: '1', fullName: 'Mamá', isLiving: true, birthDate: null, deathDate: null };
    const { getByTestId } = await render(
      <PersonNode person={person} x={0} y={0} onPress={onPress} />
    );

    await fireEvent.press(getByTestId('person-node-1'));
    expect(onPress).toHaveBeenCalled();
  });
});
```

Create `src/components/tree/__tests__/EmptySlotBox.test.tsx`:

```tsx
import { fireEvent, render } from '@testing-library/react-native';
import { EmptySlotBox } from '../EmptySlotBox';

describe('EmptySlotBox', () => {
  it('calls onPress when tapped', async () => {
    const onPress = jest.fn();
    const slot = { personId: '1', role: 'parent' as const, x: 0, y: 0 };
    const { getByTestId } = await render(
      <EmptySlotBox slot={slot} label="+ Agregar padre" onPress={onPress} />
    );

    await fireEvent.press(getByTestId('empty-slot-1-parent'));
    expect(onPress).toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Correr los tests y confirmar que fallan**

Run: `npx jest src/components/tree`
Expected: FAIL — módulos no encontrados.

- [ ] **Step 4: Implementar `src/components/tree/PersonNode.tsx`**

```tsx
import { Pressable } from 'react-native';
import { Rect, Text as SvgText } from 'react-native-svg';
import type { Person } from '@/lib/tree-data';

const WIDTH = 180;
const HEIGHT = 70;

export function PersonNode({
  person,
  x,
  y,
  onPress,
}: {
  person: Person;
  x: number;
  y: number;
  onPress: () => void;
}) {
  return (
    <Pressable testID={`person-node-${person.id}`} onPress={onPress}>
      <Rect
        x={x - WIDTH / 2}
        y={y - HEIGHT / 2}
        width={WIDTH}
        height={HEIGHT}
        rx={10}
        fill={person.isLiving ? '#e8f0fe' : '#f1f1ee'}
        stroke="#3c87f7"
        strokeWidth={1.5}
      />
      <SvgText x={x} y={y} textAnchor="middle" fontSize={14} fill="#16181c">
        {person.fullName}
      </SvgText>
    </Pressable>
  );
}
```

- [ ] **Step 5: Implementar `src/components/tree/EmptySlotBox.tsx`**

```tsx
import { Pressable } from 'react-native';
import { Rect, Text as SvgText } from 'react-native-svg';
import type { PositionedSlot } from '@/lib/tree-slots';

const WIDTH = 180;
const HEIGHT = 70;

export function EmptySlotBox({
  slot,
  label,
  onPress,
}: {
  slot: PositionedSlot;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable testID={`empty-slot-${slot.personId}-${slot.role}`} onPress={onPress}>
      <Rect
        x={slot.x - WIDTH / 2}
        y={slot.y - HEIGHT / 2}
        width={WIDTH}
        height={HEIGHT}
        rx={10}
        fill="none"
        stroke="#9aa0a6"
        strokeDasharray="6,4"
        strokeWidth={1.5}
      />
      <SvgText x={slot.x} y={slot.y} textAnchor="middle" fontSize={13} fill="#5b5f66">
        {label}
      </SvgText>
    </Pressable>
  );
}
```

- [ ] **Step 6: Correr los tests y confirmar que pasan**

Run: `npx jest src/components/tree`
Expected: PASS, 2 tests.

- [ ] **Step 7: Typecheck, lint, commit**

```bash
npx tsc --noEmit && npm run lint
git add package.json package-lock.json src/components/tree
git commit -m "feat: add PersonNode and EmptySlotBox tree diagram components"
```

---

## Task 6: `TreeCanvas` — composición del diagrama

**Files:**
- Create: `src/components/tree/TreeCanvas.tsx`
- Test: `src/components/tree/__tests__/TreeCanvas.test.tsx`

**Interfaces:**
- Consumes: `Person`/`Neighborhood` (Task 3), `computeTreeLayout` (Task 1), `computeEmptySlots`/`computeSlotPositions` (Task 2), `PersonNode`/`EmptySlotBox` (Task 5).
- Produces: `<TreeCanvas neighborhood={Neighborhood} focusPersonId={string} onPersonPress={(id) => void} onSlotPress={(slot) => void} />` — Task 8 (pantalla del árbol) lo renderiza como cuerpo principal de la vista.

- [ ] **Step 1: Escribir el test que falla primero**

Create `src/components/tree/__tests__/TreeCanvas.test.tsx`:

```tsx
import { fireEvent, render } from '@testing-library/react-native';
import { TreeCanvas } from '../TreeCanvas';

describe('TreeCanvas', () => {
  it('renders a node per person and calls onPersonPress when one is tapped', async () => {
    const onPersonPress = jest.fn();
    const neighborhood = {
      people: [
        { id: 'me', fullName: 'Yo', isLiving: true, birthDate: null, deathDate: null },
        { id: 'mom', fullName: 'Mamá', isLiving: true, birthDate: null, deathDate: null },
      ],
      edges: [{ parentId: 'mom', childId: 'me' }],
    };

    const { getByTestId } = await render(
      <TreeCanvas
        neighborhood={neighborhood}
        focusPersonId="me"
        onPersonPress={onPersonPress}
        onSlotPress={jest.fn()}
      />
    );

    await fireEvent.press(getByTestId('person-node-mom'));
    expect(onPersonPress).toHaveBeenCalledWith('mom');
  });

  it('renders an empty slot and calls onSlotPress when tapped', async () => {
    const onSlotPress = jest.fn();
    const neighborhood = {
      people: [{ id: 'me', fullName: 'Yo', isLiving: true, birthDate: null, deathDate: null }],
      edges: [],
    };

    const { getByTestId } = await render(
      <TreeCanvas
        neighborhood={neighborhood}
        focusPersonId="me"
        onPersonPress={jest.fn()}
        onSlotPress={onSlotPress}
      />
    );

    await fireEvent.press(getByTestId('empty-slot-me-child'));
    expect(onSlotPress).toHaveBeenCalledWith({ personId: 'me', role: 'child' });
  });
});
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `npx jest src/components/tree/__tests__/TreeCanvas.test.tsx`
Expected: FAIL — `Cannot find module '../TreeCanvas'`.

- [ ] **Step 3: Implementar `src/components/tree/TreeCanvas.tsx`**

```tsx
import { ScrollView } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { computeTreeLayout } from '@/lib/tree-layout';
import { computeEmptySlots, computeSlotPositions } from '@/lib/tree-slots';
import type { Neighborhood } from '@/lib/tree-data';
import type { EmptySlot } from '@/lib/tree-slots';
import { PersonNode } from './PersonNode';
import { EmptySlotBox } from './EmptySlotBox';

const CANVAS_PADDING = 400;

const SLOT_LABELS: Record<EmptySlot['role'], string> = {
  parent: '+ Agregar padre/madre',
  child: '+ Agregar hijo/a',
  sibling: '+ Agregar hermano/a',
};

export function TreeCanvas({
  neighborhood,
  focusPersonId,
  onPersonPress,
  onSlotPress,
}: {
  neighborhood: Neighborhood;
  focusPersonId: string;
  onPersonPress: (personId: string) => void;
  onSlotPress: (slot: EmptySlot) => void;
}) {
  const personIds = neighborhood.people.map((p) => p.id);
  const positions = computeTreeLayout(personIds, neighborhood.edges, focusPersonId);
  const positionByPersonId = new Map(positions.map((p) => [p.personId, p]));
  const slots = computeEmptySlots(personIds, neighborhood.edges);
  const positionedSlots = computeSlotPositions(slots, positions);

  const xs = [...positions.map((p) => p.x), ...positionedSlots.map((s) => s.x)];
  const ys = [...positions.map((p) => p.y), ...positionedSlots.map((s) => s.y)];
  const minX = Math.min(0, ...xs) - CANVAS_PADDING;
  const maxX = Math.max(0, ...xs) + CANVAS_PADDING;
  const minY = Math.min(0, ...ys) - CANVAS_PADDING;
  const maxY = Math.max(0, ...ys) + CANVAS_PADDING;
  const width = maxX - minX;
  const height = maxY - minY;

  return (
    <ScrollView horizontal nestedScrollEnabled testID="tree-canvas-scroll-x">
      <ScrollView nestedScrollEnabled testID="tree-canvas-scroll-y">
        <Svg width={width} height={height} viewBox={`${minX} ${minY} ${width} ${height}`}>
          {neighborhood.edges.map((edge) => {
            const parent = positionByPersonId.get(edge.parentId);
            const child = positionByPersonId.get(edge.childId);
            if (!parent || !child) return null;
            return (
              <Line
                key={`${edge.parentId}:${edge.childId}`}
                x1={parent.x}
                y1={parent.y}
                x2={child.x}
                y2={child.y}
                stroke="#9aa0a6"
                strokeWidth={1.5}
              />
            );
          })}
          {positionedSlots.map((slot) => (
            <EmptySlotBox
              key={`${slot.personId}-${slot.role}`}
              slot={slot}
              label={SLOT_LABELS[slot.role]}
              onPress={() => onSlotPress({ personId: slot.personId, role: slot.role })}
            />
          ))}
          {neighborhood.people.map((person) => {
            const position = positionByPersonId.get(person.id);
            if (!position) return null;
            return (
              <PersonNode
                key={person.id}
                person={person}
                x={position.x}
                y={position.y}
                onPress={() => onPersonPress(person.id)}
              />
            );
          })}
        </Svg>
      </ScrollView>
    </ScrollView>
  );
}
```

- [ ] **Step 4: Correr el test y confirmar que pasa**

Run: `npx jest src/components/tree/__tests__/TreeCanvas.test.tsx`
Expected: PASS, 2 tests.

- [ ] **Step 5: Typecheck, lint, commit**

```bash
npx tsc --noEmit && npm run lint
git add src/components/tree/TreeCanvas.tsx src/components/tree/__tests__/TreeCanvas.test.tsx
git commit -m "feat: add TreeCanvas composing layout, slots, nodes, and edges"
```

---

## Task 7: Pantalla para agregar una persona

**Files:**
- Create: `src/app/add-person.tsx`
- Test: `src/app/__tests__/add-person.test.tsx`

**Interfaces:**
- Consumes: `createPersonWithRelationship`/`createSibling` (Task 4), `useLocalSearchParams`/`router` de `expo-router`.
- Produces: ruta `/add-person` — Task 8 navega ahí desde `onSlotPress` de `TreeCanvas`, pasando `role`, `referencePersonId`, `treeId`, y (para `role=sibling`) `parentIds`.

- [ ] **Step 1: Escribir el test que falla primero**

Create `src/app/__tests__/add-person.test.tsx`:

```tsx
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import AddPersonScreen from '../add-person';
import { createPersonWithRelationship, createSibling } from '@/lib/tree-data';
import { supabase } from '@/lib/supabase';
import { router, useLocalSearchParams } from 'expo-router';

jest.mock('@/lib/tree-data', () => ({
  createPersonWithRelationship: jest.fn(),
  createSibling: jest.fn(),
}));

jest.mock('@/lib/supabase', () => ({
  supabase: { auth: { getUser: jest.fn() } },
}));

jest.mock('expo-router', () => ({
  router: { back: jest.fn() },
  useLocalSearchParams: jest.fn(),
}));

describe('AddPersonScreen', () => {
  beforeEach(() => {
    (createPersonWithRelationship as jest.Mock).mockReset();
    (createSibling as jest.Mock).mockReset();
    (router.back as jest.Mock).mockReset();
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: { id: 'user-1' } },
    });
  });

  it('creates a parent relationship and navigates back on submit', async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      role: 'parent',
      referencePersonId: 'me',
      treeId: 'tree-1',
    });
    (createPersonWithRelationship as jest.Mock).mockResolvedValue({ id: 'new-id' });

    const { getByTestId } = await render(<AddPersonScreen />);
    await fireEvent.changeText(getByTestId('full-name-input'), 'Abuela');
    await fireEvent.press(getByTestId('submit-button'));

    await waitFor(() => {
      expect(createPersonWithRelationship).toHaveBeenCalledWith({
        treeId: 'tree-1',
        fullName: 'Abuela',
        isLiving: true,
        birthDate: undefined,
        relationship: { role: 'parent', otherPersonId: 'me', type: 'biological' },
        createdBy: 'user-1',
      });
    });
    expect(router.back).toHaveBeenCalled();
  });

  it('creates a sibling linked to every existing parent on submit', async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      role: 'sibling',
      referencePersonId: 'me',
      treeId: 'tree-1',
      parentIds: 'mom,dad',
    });
    (createSibling as jest.Mock).mockResolvedValue({ id: 'new-id' });

    const { getByTestId } = await render(<AddPersonScreen />);
    await fireEvent.changeText(getByTestId('full-name-input'), 'Hermano');
    await fireEvent.press(getByTestId('submit-button'));

    await waitFor(() => {
      expect(createSibling).toHaveBeenCalledWith({
        treeId: 'tree-1',
        fullName: 'Hermano',
        isLiving: true,
        birthDate: undefined,
        parentIds: ['mom', 'dad'],
        type: 'biological',
        createdBy: 'user-1',
      });
    });
  });
});
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `npx jest src/app/__tests__/add-person.test.tsx`
Expected: FAIL — `Cannot find module '../add-person'`.

- [ ] **Step 3: Implementar `src/app/add-person.tsx`**

```tsx
import { useState } from 'react';
import { Button, StyleSheet, Switch, TextInput } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { supabase } from '@/lib/supabase';
import { createPersonWithRelationship, createSibling } from '@/lib/tree-data';

const ROLE_TITLES: Record<string, string> = {
  parent: 'Agregar padre/madre',
  child: 'Agregar hijo/a',
  sibling: 'Agregar hermano/a',
};

export default function AddPersonScreen() {
  const { role, referencePersonId, treeId, parentIds } = useLocalSearchParams<{
    role: 'parent' | 'child' | 'sibling';
    referencePersonId: string;
    treeId: string;
    parentIds?: string;
  }>();

  const [fullName, setFullName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [isLiving, setIsLiving] = useState(true);
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  async function handleSubmit() {
    setStatus('saving');
    setErrorMessage('');
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (role === 'sibling') {
        await createSibling({
          treeId,
          fullName,
          isLiving,
          birthDate: birthDate || undefined,
          parentIds: (parentIds ?? '').split(',').filter(Boolean),
          type: 'biological',
          createdBy: user.id,
        });
      } else {
        await createPersonWithRelationship({
          treeId,
          fullName,
          isLiving,
          birthDate: birthDate || undefined,
          relationship: { role, otherPersonId: referencePersonId, type: 'biological' },
          createdBy: user.id,
        });
      }
      router.back();
    } catch (error) {
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Error al guardar');
    }
  }

  return (
    <ThemedView style={styles.container} testID="add-person-screen">
      <ThemedText type="title" style={styles.title}>
        {ROLE_TITLES[role] ?? 'Agregar persona'}
      </ThemedText>
      <TextInput
        style={styles.input}
        placeholder="Nombre completo"
        value={fullName}
        onChangeText={setFullName}
        testID="full-name-input"
      />
      <TextInput
        style={styles.input}
        placeholder="Fecha de nacimiento (opcional, AAAA-MM-DD)"
        value={birthDate}
        onChangeText={setBirthDate}
        testID="birth-date-input"
      />
      <ThemedView style={styles.switchRow}>
        <ThemedText>¿Está viva?</ThemedText>
        <Switch value={isLiving} onValueChange={setIsLiving} testID="is-living-switch" />
      </ThemedView>
      <Button
        title={status === 'saving' ? 'Guardando...' : 'Guardar'}
        onPress={handleSubmit}
        disabled={status === 'saving' || fullName.length === 0}
        testID="submit-button"
      />
      {status === 'error' && (
        <ThemedText style={styles.error} testID="error-message">
          {errorMessage}
        </ThemedText>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 12 },
  title: { fontSize: 22, marginBottom: 16 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  error: { color: '#c33', textAlign: 'center' },
});
```

- [ ] **Step 4: Correr el test y confirmar que pasa**

Run: `npx jest src/app/__tests__/add-person.test.tsx`
Expected: PASS, 2 tests.

- [ ] **Step 5: Typecheck, lint, commit**

```bash
npx tsc --noEmit && npm run lint
git add src/app/add-person.tsx src/app/__tests__/add-person.test.tsx
git commit -m "feat: add screen for creating a parent/child/sibling"
```

---

## Task 8: Conectar la vista del árbol como pantalla principal

**Files:**
- Modify: `src/app/index.tsx`

**Interfaces:**
- Consumes: `fetchMyPersonId`, `fetchNeighborhood`, `mergeNeighborhoods` (Task 3), `TreeCanvas` (Task 6), `EmptySlot` (Task 2), `router` de `expo-router`.
- Produces: la pantalla de inicio real de la app — punto de entrada para la Fase 3 (invitaciones) y Fase 4 (aprobación de cambios).

- [ ] **Step 1: Reemplazar `src/app/index.tsx`**

```tsx
import { useCallback, useState } from 'react';
import { Button, StyleSheet, ActivityIndicator } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { supabase } from '@/lib/supabase';
import {
  fetchMyPersonId,
  fetchNeighborhood,
  mergeNeighborhoods,
  type Neighborhood,
} from '@/lib/tree-data';
import type { EmptySlot } from '@/lib/tree-slots';
import { TreeCanvas } from '@/components/tree/TreeCanvas';

export default function HomeScreen() {
  const [focusPersonId, setFocusPersonId] = useState<string | null>(null);
  const [treeId, setTreeId] = useState<string | null>(null);
  const [neighborhood, setNeighborhood] = useState<Neighborhood>({ people: [], edges: [] });
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      async function load() {
        try {
          const { personId, treeId: myTreeId } = await fetchMyPersonId();
          const initial = await fetchNeighborhood(personId);
          if (cancelled) return;
          setFocusPersonId(personId);
          setTreeId(myTreeId);
          setNeighborhood((current) => mergeNeighborhoods(current, initial));
          setStatus('ready');
        } catch (error) {
          if (cancelled) return;
          setErrorMessage(error instanceof Error ? error.message : 'Error al cargar el árbol');
          setStatus('error');
        }
      }
      load();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  async function handlePersonPress(personId: string) {
    const expanded = await fetchNeighborhood(personId);
    setNeighborhood((current) => mergeNeighborhoods(current, expanded));
  }

  function handleSlotPress(slot: EmptySlot) {
    if (!treeId) return;
    const parentIds =
      slot.role === 'sibling'
        ? neighborhood.edges
            .filter((e) => e.childId === slot.personId)
            .map((e) => e.parentId)
            .join(',')
        : undefined;
    router.push({
      pathname: '/add-person',
      params: {
        role: slot.role,
        referencePersonId: slot.personId,
        treeId,
        ...(parentIds ? { parentIds } : {}),
      },
    });
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  if (status === 'loading') {
    return (
      <ThemedView style={styles.center} testID="home-loading">
        <ActivityIndicator />
      </ThemedView>
    );
  }

  if (status === 'error') {
    return (
      <ThemedView style={styles.center} testID="home-error">
        <ThemedText>{errorMessage}</ThemedText>
        <Button title="Cerrar sesión" onPress={handleSignOut} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container} testID="home-screen">
      <TreeCanvas
        neighborhood={neighborhood}
        focusPersonId={focusPersonId!}
        onPersonPress={handlePersonPress}
        onSlotPress={handleSlotPress}
      />
      <Button title="Cerrar sesión" onPress={handleSignOut} testID="sign-out-button" />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
});
```

- [ ] **Step 2: Typecheck y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 3: Correr toda la suite**

Run: `npx jest`
Expected: todos los tests existentes siguen en PASS (esta pantalla no tiene test propio nuevo — su comportamiento ya está cubierto por los tests de `tree-data`, `tree-layout`, `tree-slots` y `TreeCanvas`; verificarla en vivo es el Task 9).

- [ ] **Step 4: Commit**

```bash
git add src/app/index.tsx
git commit -m "feat: wire the tree view as the app's home screen"
```

---

## Task 9: Verificación end-to-end y despliegue

**Files:** ninguno (verificación manual + push).

- [ ] **Step 1: Probar localmente**

```bash
npx expo start --web
```

Abre `http://localhost:8081`, inicia sesión. Deberías ver tu propio nodo en el centro con slots "+ Agregar padre/madre" y "+ Agregar hijo/a". Toca "+ Agregar padre/madre", crea una persona (ej. "Mamá"), confirma que aparece conectada arriba de tu nodo y que ahora ves un slot "+ Agregar hermano/a" en tu nodo. Agrega un hermano y confirma que aparece en tu misma fila. Toca el nodo de tu mamá y confirma que se expande (aparecen sus propios slots de padre/hijo).

- [ ] **Step 2: Push a producción**

```bash
git push
```

- [ ] **Step 3: Verificar en producción**

Repite la prueba del Step 1 contra `https://myfamilytree-alpha.vercel.app`.

- [ ] **Step 4: Actualizar `CLAUDE.md`**

Agrega una línea breve en la sección de infraestructura/decisiones notando que la vista del árbol y el alta de personas ya están en producción, y que el pinch-zoom y la subida de foto quedaron pendientes (ya documentado en el alcance de este plan, pero vale la pena que quede también en la memoria viva del proyecto).

```bash
git add CLAUDE.md
git commit -m "docs: note Phase 2 tree view is live"
git push
```

---

## Siguientes fases (no incluidas aquí)

- **Fase 3**: invitaciones por correo a un nodo específico y unión al árbol compartido (spec §4).
- **Fase 4**: UI del flujo de `change_requests`/aprobación del creador (spec §3, §6).
- **Pendiente suelto**: login con Google OAuth (pospuesto de la Fase 1), pinch-zoom, subir foto de perfil.
