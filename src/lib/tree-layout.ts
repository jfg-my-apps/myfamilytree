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
  const generationById = computeGenerations(personIds, edges, focusPersonId);

  const parentsOf = new Map<string, string[]>();
  const childrenOf = new Map<string, string[]>();
  for (const edge of edges) {
    const parentList = parentsOf.get(edge.childId) ?? [];
    parentList.push(edge.parentId);
    parentsOf.set(edge.childId, parentList);

    const childList = childrenOf.get(edge.parentId) ?? [];
    childList.push(edge.childId);
    childrenOf.set(edge.parentId, childList);
  }

  // Assign each person a horizontal "column" via a DFS that hands leaves the
  // next free integer column and gives every ancestor the average of their
  // children's columns. Because the counter only ever increases, no two
  // subtrees can ever claim the same horizontal range — unlike positioning
  // each generation's row independently, which let unrelated people (or
  // rows of different sizes) land on the same x by coincidence.
  const columnById = new Map<string, number>();
  const inProgress = new Set<string>();
  let nextColumn = 0;

  function assignColumn(personId: string): number {
    if (columnById.has(personId)) return columnById.get(personId)!;
    if (inProgress.has(personId)) return nextColumn; // guards a bad cycle, shouldn't occur
    inProgress.add(personId);

    const children = Array.from(new Set(childrenOf.get(personId) ?? []))
      .filter((id) => personIds.includes(id))
      .sort();

    const column =
      children.length === 0
        ? nextColumn++
        : average(children.map((childId) => assignColumn(childId)));

    columnById.set(personId, column);
    inProgress.delete(personId);
    return column;
  }

  const roots = personIds
    .filter((id) => (parentsOf.get(id) ?? []).every((parentId) => !personIds.includes(parentId)))
    .sort();
  for (const rootId of roots) {
    assignColumn(rootId);
  }
  // Anything not reached from a root (a fragment disconnected from the main
  // descent, which shouldn't normally happen) still gets its own column.
  for (const personId of personIds) {
    if (!columnById.has(personId)) columnById.set(personId, nextColumn++);
  }

  spreadTiedColumns(personIds, generationById, columnById);

  const positions = personIds.map((personId) => ({
    personId,
    x: columnById.get(personId)! * NODE_SPACING_X,
    y: (generationById.get(personId) ?? 0) * GENERATION_SPACING_Y,
    generation: generationById.get(personId) ?? 0,
  }));

  // Recenter so the focus person always sits at x=0, keeping the view
  // anchored on load instead of drifting toward whichever side has more
  // ancestors/descendants.
  const focusX = positions.find((p) => p.personId === focusPersonId)?.x ?? 0;
  return positions.map((p) => ({ ...p, x: p.x - focusX }));
}

/**
 * Final safety net: given any positioned items (real people, empty slots, or
 * both mixed together), nudges apart any that landed on the exact same
 * (generation, x) — which can happen because slots are placed relative to
 * their own anchor person independently of what else already occupies that
 * spot. Ties are spread symmetrically in a stable order.
 */
export function resolveRowCollisions<T extends { generation: number; x: number }>(
  items: T[],
  keyOf: (item: T) => string
): T[] {
  const byGeneration = new Map<number, T[]>();
  for (const item of items) {
    const list = byGeneration.get(item.generation) ?? [];
    list.push(item);
    byGeneration.set(item.generation, list);
  }

  const resolved: T[] = [];
  for (const rowItems of byGeneration.values()) {
    const groups = new Map<number, T[]>();
    for (const item of rowItems) {
      const list = groups.get(item.x) ?? [];
      list.push(item);
      groups.set(item.x, list);
    }
    for (const [x, tied] of groups) {
      if (tied.length === 1) {
        resolved.push(tied[0]);
        continue;
      }
      const sorted = [...tied].sort((a, b) => keyOf(a).localeCompare(keyOf(b)));
      const spread = (sorted.length - 1) / 2;
      sorted.forEach((item, index) => {
        resolved.push({ ...item, x: x + (index - spread) * NODE_SPACING_X });
      });
    }
  }
  return resolved;
}

function average(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function computeGenerations(
  personIds: string[],
  edges: RelationshipEdge[],
  focusPersonId: string
): Map<string, number> {
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

  for (const personId of personIds) {
    if (!generationById.has(personId)) generationById.set(personId, 0);
  }
  return generationById;
}

/**
 * Two co-parents who share every child compute the exact same average
 * column (and would otherwise be drawn stacked on top of each other).
 * Detects any such exact ties within a generation and spreads them evenly
 * around their shared value, in a stable (alphabetical) order.
 */
function spreadTiedColumns(
  personIds: string[],
  generationById: Map<string, number>,
  columnById: Map<string, number>
): void {
  const byGeneration = new Map<number, string[]>();
  for (const personId of personIds) {
    const generation = generationById.get(personId) ?? 0;
    const list = byGeneration.get(generation) ?? [];
    list.push(personId);
    byGeneration.set(generation, list);
  }

  for (const ids of byGeneration.values()) {
    const groupsByColumn = new Map<number, string[]>();
    for (const personId of ids) {
      const column = columnById.get(personId)!;
      const list = groupsByColumn.get(column) ?? [];
      list.push(personId);
      groupsByColumn.set(column, list);
    }
    for (const [column, tiedIds] of groupsByColumn) {
      if (tiedIds.length <= 1) continue;
      const sorted = [...tiedIds].sort();
      const spread = (sorted.length - 1) / 2;
      sorted.forEach((personId, index) => {
        columnById.set(personId, column + (index - spread) * 0.5);
      });
    }
  }
}
