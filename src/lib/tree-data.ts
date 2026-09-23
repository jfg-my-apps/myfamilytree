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
