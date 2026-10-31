import React, { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { useAppStore } from '../store/useAppStore';

export function RequireLeague({ children }: { children: React.ReactNode }) {
  const leagueId = useAppStore((s) => s.leagueId);
  const [hydrated, setHydrated] = useState(() => useAppStore.persist.hasHydrated());

  useEffect(() => {
    setHydrated(useAppStore.persist.hasHydrated());
    return useAppStore.persist.onFinishHydration(() => setHydrated(true));
  }, []);

  if (!hydrated) return null;
  if (!leagueId) return <Redirect href="/leagues" />;
  return <>{children}</>;
}
