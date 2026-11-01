import * as Sentry from '@sentry/react-native';
import { initSentry, scrubEvent, scrubTokens } from './sentry';

jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  reactNavigationIntegration: jest.fn(() => ({ name: 'ReactNavigation', registerNavigationContainer: jest.fn() })),
}));

beforeEach(() => {
  jest.mocked(Sentry.init).mockClear();
});

test('without a DSN, Sentry is not started', () => {
  expect(initSentry(undefined, 'development')).toBe(false);
  expect(initSentry('', 'production')).toBe(false);
  expect(Sentry.init).not.toHaveBeenCalled();
});

test('with a DSN, Sentry starts for the build environment, without personal data', () => {
  expect(initSentry('https://key@o1.ingest.de.sentry.io/2', 'preview')).toBe(true);
  expect(Sentry.init).toHaveBeenCalledWith(
    expect.objectContaining({
      dsn: 'https://key@o1.ingest.de.sentry.io/2',
      environment: 'preview',
      sendDefaultPii: false,
      beforeSend: scrubEvent,
      beforeSendTransaction: scrubEvent,
    })
  );
});

test('the scrubber hides token values in URLs', () => {
  expect(scrubTokens('https://admin.test/reset-password?token=abc123&next=/')).toBe(
    'https://admin.test/reset-password?token=[Filtered]&next=/'
  );
  expect(scrubTokens('/invitation?lang=fr&token=x.y-z')).toBe('/invitation?lang=fr&token=[Filtered]');
  expect(scrubTokens('/api/v1/leagues?season=2026')).toBe('/api/v1/leagues?season=2026');
});

test('the scrubber cleans the request and the breadcrumbs of an event', () => {
  const event = scrubEvent({
    request: { url: 'https://api.test/invitations/lookup?token=secret' },
    breadcrumbs: [
      { category: 'fetch', data: { url: 'https://api.test/reset?token=secret', status_code: 200 } },
      { category: 'navigation', message: 'to /invitation?token=secret' },
    ],
  });
  expect(JSON.stringify(event)).not.toContain('secret');
  expect(event.request?.url).toBe('https://api.test/invitations/lookup?token=[Filtered]');
  expect(event.breadcrumbs?.[0].data?.status_code).toBe(200);
});

test('a token followed by a quote inside a string is scrubbed without breaking the event', () => {
  const event = scrubEvent({
    message: '{"url":"x?token=abc"}',
    breadcrumbs: [{ category: 'console', message: 'payload {"next":"/reset?token=abc"} sent' }],
  });
  expect(event.message).toBe('{"url":"x?token=[Filtered]"}');
  expect(event.breadcrumbs[0].message).toBe('payload {"next":"/reset?token=[Filtered]"} sent');
});
