export const SHOULD_FAIL = { current: false };

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withLatency<T>(factory: () => T): Promise<T> {
  await sleep(250);
  if (SHOULD_FAIL.current) {
    throw new Error('Erreur réseau simulée');
  }
  return factory();
}
