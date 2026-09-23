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
