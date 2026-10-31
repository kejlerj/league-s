export function isWebUrl(url: string | null): url is string {
  return url !== null && /^https?:\/\//i.test(url);
}
