import type { ExpoConfig } from 'expo/config';
import { resolveAppEnv, withEnvironment } from './app.config';

const BASE: ExpoConfig = {
  name: 'Ligue Amateur',
  slug: 'ligue-amateur',
  ios: { supportsTablet: true, infoPlist: { UIViewControllerBasedStatusBarAppearance: true } },
};

const HTTPS_API = 'https://api.example.com/api/v1';

function localNetworking(config: ExpoConfig): unknown {
  const ats = config.ios?.infoPlist?.NSAppTransportSecurity as { NSAllowsLocalNetworking?: boolean } | undefined;
  return ats?.NSAllowsLocalNetworking;
}

test('without APP_ENV the build is a development build', () => {
  expect(resolveAppEnv({})).toBe('development');
});

test('a development build needs no API address', () => {
  expect(resolveAppEnv({ APP_ENV: 'development' })).toBe('development');
});

test('an unknown APP_ENV fails the build', () => {
  expect(() => resolveAppEnv({ APP_ENV: 'staging' })).toThrow('APP_ENV');
});

test.each(['preview', 'production'])('%s builds with an https EXPO_PUBLIC_API_URL', (appEnv) => {
  expect(resolveAppEnv({ APP_ENV: appEnv, EXPO_PUBLIC_API_URL: HTTPS_API })).toBe(appEnv);
});

test.each(['preview', 'production'])('%s fails the build without EXPO_PUBLIC_API_URL', (appEnv) => {
  expect(() => resolveAppEnv({ APP_ENV: appEnv })).toThrow('EXPO_PUBLIC_API_URL');
});

test.each(['preview', 'production'])('%s fails the build with an http API address', (appEnv) => {
  expect(() => resolveAppEnv({ APP_ENV: appEnv, EXPO_PUBLIC_API_URL: 'http://api.example.com/api/v1' })).toThrow('https');
});

test('development allows local networking', () => {
  expect(localNetworking(withEnvironment(BASE, {}))).toBe(true);
});

test.each(['preview', 'production'])('%s does not allow local networking', (appEnv) => {
  const config = withEnvironment(BASE, { APP_ENV: appEnv, EXPO_PUBLIC_API_URL: HTTPS_API });
  expect(config.ios?.infoPlist?.NSAppTransportSecurity).toBeUndefined();
});

test('the app config fails for an invalid environment', () => {
  expect(() => withEnvironment(BASE, { APP_ENV: 'production' })).toThrow('EXPO_PUBLIC_API_URL');
});

test('keeps the rest of the app config', () => {
  const config = withEnvironment(BASE, {});
  expect(config.name).toBe('Ligue Amateur');
  expect(config.ios?.supportsTablet).toBe(true);
  expect(config.ios?.infoPlist?.UIViewControllerBasedStatusBarAppearance).toBe(true);
});
