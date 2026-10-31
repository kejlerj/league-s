import type { ConfigContext, ExpoConfig } from 'expo/config';

export type AppEnv = 'development' | 'preview' | 'production';

type Variables = Record<string, string | undefined>;

const APP_ENVS: AppEnv[] = ['development', 'preview', 'production'];

export function resolveAppEnv(vars: Variables): AppEnv {
  const value = vars.APP_ENV;
  if (value === undefined) return 'development';
  const appEnv = APP_ENVS.find((candidate) => candidate === value);
  if (!appEnv) throw new Error(`APP_ENV must be one of ${APP_ENVS.join(', ')}, got "${value}"`);
  if (appEnv === 'development') return appEnv;
  const apiUrl = vars.EXPO_PUBLIC_API_URL;
  if (!apiUrl) throw new Error(`EXPO_PUBLIC_API_URL is required for a ${appEnv} build`);
  if (!apiUrl.startsWith('https://')) throw new Error(`EXPO_PUBLIC_API_URL must use https for a ${appEnv} build`);
  return appEnv;
}

export function withEnvironment(config: ExpoConfig, vars: Variables): ExpoConfig {
  if (resolveAppEnv(vars) !== 'development') return config;
  return {
    ...config,
    ios: {
      ...config.ios,
      infoPlist: {
        ...config.ios?.infoPlist,
        NSAppTransportSecurity: { NSAllowsLocalNetworking: true },
      },
    },
  };
}

export default ({ config }: ConfigContext): ExpoConfig => withEnvironment(config as ExpoConfig, process.env);
