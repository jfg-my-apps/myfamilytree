export type RelationshipEdge = {
  parentId: string;
  childId: string;
};

/**
 * Recorre hacia arriba desde newParentId por los edges existentes; si llega a
 * newChildId, agregar newParentId -> newChildId cerraría un ciclo.
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
