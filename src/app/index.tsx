import { StyleSheet, Button } from 'react-native';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { supabase } from '@/lib/supabase';

export default function HomeScreen() {
  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  return (
    <ThemedView style={styles.container} testID="home-screen">
      <ThemedText type="title" style={styles.title}>
        Sesión iniciada
      </ThemedText>
      <Button title="Cerrar sesión" onPress={handleSignOut} testID="sign-out-button" />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  title: { fontSize: 20 },
});
