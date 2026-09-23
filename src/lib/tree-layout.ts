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
