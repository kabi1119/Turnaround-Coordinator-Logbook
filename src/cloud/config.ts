/** Development stays opt-in. Production builds inject this value through the verified build policy. */
export function cloudAccountsEnabled(env: Record<string, unknown>): boolean {
  return env.VITE_ACCOUNT_CLOUD_V2 === 'preview';
}
