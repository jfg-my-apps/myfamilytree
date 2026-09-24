import { useCallback, useState } from 'react';
import { Button, StyleSheet, ActivityIndicator, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { supabase } from '@/lib/supabase';
import {
  fetchMyPersonId,
  fetchNeighborhood,
  mergeNeighborhoods,
  updateMyName,
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
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');

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

  const myPerson = neighborhood.people.find((p) => p.id === focusPersonId);

  function startEditingName() {
    setNameDraft(myPerson?.fullName ?? '');
    setEditingName(true);
  }

  async function saveName() {
    if (!focusPersonId || nameDraft.trim().length === 0) return;
    await updateMyName(focusPersonId, nameDraft.trim());
    setNeighborhood((current) => ({
      ...current,
      people: current.people.map((p) =>
        p.id === focusPersonId ? { ...p, fullName: nameDraft.trim() } : p
      ),
    }));
    setEditingName(false);
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
      <View style={styles.footer}>
        {editingName ? (
          <View style={styles.editRow}>
            <TextInput
              style={styles.input}
              value={nameDraft}
              onChangeText={setNameDraft}
              placeholder="Tu nombre completo"
              testID="my-name-input"
            />
            <Button title="Guardar" onPress={saveName} testID="save-name-button" />
          </View>
        ) : (
          <Button
            title="Editar mi nombre"
            onPress={startEditingName}
            testID="edit-name-button"
          />
        )}
        <Button title="Cerrar sesión" onPress={handleSignOut} testID="sign-out-button" />
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  footer: { padding: 12, gap: 8 },
  editRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: { flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 8 },
});
