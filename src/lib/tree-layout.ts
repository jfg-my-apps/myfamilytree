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

  // Reference maps used to cluster a generation's people near their already-
  // placed relatives, instead of scattering them in plain alphabetical order.
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

  const positions: PersonPosition[] = [];
  const xById = new Map<string, number>();

  function placeGeneration(generation: number, ids: string[], referenceMap: Map<string, string[]>) {
    const withSortKeys = ids.map((personId) => {
      const references = referenceMap.get(personId) ?? [];
      const referenceXs = references
        .map((id) => xById.get(id))
        .filter((x): x is number => x !== undefined);
      const sortKey =
        referenceXs.length > 0 ? referenceXs.reduce((a, b) => a + b, 0) / referenceXs.length : null;
      return { personId, sortKey };
    });

    withSortKeys.sort((a, b) => {
      if (a.sortKey !== null && b.sortKey !== null) {
        return a.sortKey - b.sortKey || a.personId.localeCompare(b.personId);
      }
      if (a.sortKey !== null) return -1;
      if (b.sortKey !== null) return 1;
      return a.personId.localeCompare(b.personId);
    });

    const offset = ((withSortKeys.length - 1) * NODE_SPACING_X) / 2;
    withSortKeys.forEach(({ personId }, index) => {
      const x = index * NODE_SPACING_X - offset;
      xById.set(personId, x);
      positions.push({ personId, x, y: generation * GENERATION_SPACING_Y, generation });
    });
  }

  // Generation 0 has no shallower generation to reference yet, so it's the
  // bootstrap (alphabetical). Descendant generations are then ordered by
  // their parents' average x (already placed, since we walk outward from 0);
  // ancestor generations are ordered by their children's average x, for the
  // same reason in the opposite direction.
  placeGeneration(0, byGeneration.get(0) ?? [], new Map());

  const generations = Array.from(byGeneration.keys());
  const maxGeneration = Math.max(0, ...generations);
  const minGeneration = Math.min(0, ...generations);

  for (let generation = 1; generation <= maxGeneration; generation++) {
    placeGeneration(generation, byGeneration.get(generation) ?? [], parentsOf);
  }
  for (let generation = -1; generation >= minGeneration; generation--) {
    placeGeneration(generation, byGeneration.get(generation) ?? [], childrenOf);
  }

  return positions;
}
