import { fireEvent, render, waitFor } from '@testing-library/react-native';
import LoginScreen from '../login';
import { supabase } from '@/lib/supabase';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithOtp: jest.fn(),
    },
  },
}));

describe('LoginScreen', () => {
  beforeEach(() => {
    (supabase.auth.signInWithOtp as jest.Mock).mockReset();
  });

  it('sends a magic link for the entered email', async () => {
    (supabase.auth.signInWithOtp as jest.Mock).mockResolvedValue({ error: null });
    const { getByTestId } = await render(<LoginScreen />);

    await fireEvent.changeText(getByTestId('email-input'), 'hermana@example.com');
    await fireEvent.press(getByTestId('send-magic-link-button'));

    await waitFor(() => {
      expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith({
        email: 'hermana@example.com',
      });
    });
    expect(getByTestId('sent-message')).toBeTruthy();
  });

  it('shows an error message when the request fails', async () => {
    (supabase.auth.signInWithOtp as jest.Mock).mockResolvedValue({
      error: { message: 'Correo inválido' },
    });
    const { getByTestId } = await render(<LoginScreen />);

    await fireEvent.changeText(getByTestId('email-input'), 'bad');
    await fireEvent.press(getByTestId('send-magic-link-button'));

    await waitFor(() => {
      expect(getByTestId('error-message').props.children).toBe('Correo inválido');
    });
  });
});
