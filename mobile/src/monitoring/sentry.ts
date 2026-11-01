import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import { isRunningInExpoGo } from 'expo';

const TOKEN_VALUE = /([?&]token=)[^&#\s"]*/gi;

export function scrubTokens(text: string): string {
  return text.replace(TOKEN_VALUE, '$1[Filtered]');
}

function scrubValue(value: unknown): unknown {
  if (typeof value === 'string') return scrubTokens(value);
  if (Array.isArray(value)) return value.map(scrubValue);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, scrubValue(item)]));
  }
  return value;
}

export function scrubEvent<T extends object>(event: T): T {
  return scrubValue(event) as T;
}

export const navigationIntegration = Sentry.reactNavigationIntegration({
  enableTimeToInitialDisplay: !isRunningInExpoGo(),
});

function buildEnvironment(): string {
  const appEnv = Constants.expoConfig?.extra?.appEnv;
  return typeof appEnv === 'string' ? appEnv : 'development';
}

export function initSentry(dsn = process.env.EXPO_PUBLIC_SENTRY_DSN, environment = buildEnvironment()): boolean {
  if (!dsn) return false;
  Sentry.init({
    dsn,
    environment,
    sendDefaultPii: false,
    tracesSampleRate: environment === 'production' ? 0.2 : 1,
    integrations: [navigationIntegration],
    enableNativeFramesTracking: !isRunningInExpoGo(),
    beforeSend: scrubEvent,
    beforeSendTransaction: scrubEvent,
  });
  return true;
}
