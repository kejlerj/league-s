import React from 'react';
import { Redirect } from 'expo-router';
import { RequireLeague } from '@/src/components/RequireLeague';

export default function Index() {
  return (
    <RequireLeague>
      <Redirect href="/following" />
    </RequireLeague>
  );
}
