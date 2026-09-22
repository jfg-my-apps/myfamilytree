import { useSyncExternalStore } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

function subscribe() {
  return () => {};
}

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web
 */
export function useColorScheme() {
  // useSyncExternalStore's getServerSnapshot runs during SSR/static render (returns
  // false), and its getSnapshot runs once hydrated on the client (returns true) —
  // avoids the setState-in-effect cascading-render pattern for this hydration flag.
  const hasHydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );

  const colorScheme = useRNColorScheme();

  if (hasHydrated) {
    return colorScheme;
  }

  return 'light';
}
