import { useState } from 'react';
import { StyleSheet, TextInput, Button } from 'react-native';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { supabase } from '@/lib/supabase';

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
    <ThemedView style={styles.container} testID="login-screen">
      <ThemedText type="title" style={styles.title}>
        MyFamilyTree
      </ThemedText>
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
        <ThemedText style={styles.info} testID="sent-message">
          Revisa tu correo para el link de acceso.
        </ThemedText>
      )}
      {status === 'error' && (
        <ThemedText style={styles.error} testID="error-message">
          {errorMessage}
        </ThemedText>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 24, marginBottom: 16, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
  info: { color: '#2a7', textAlign: 'center' },
  error: { color: '#c33', textAlign: 'center' },
});
