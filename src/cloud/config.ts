/** Deliberate preview-only value; unset/false/true never enables new account storage. */
export function cloudAccountsEnabled(env: Record<string, unknown>): boolean {
  return env.VITE_ACCOUNT_CLOUD_V2 === 'preview';
}
