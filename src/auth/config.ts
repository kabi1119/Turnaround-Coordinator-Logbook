export type AuthConfig = { url: string; key: string };
export function authConfig(env: Record<string, unknown>): AuthConfig | null {
  const url = String(env.VITE_SUPABASE_URL || '').trim(),
    key = String(env.VITE_SUPABASE_PUBLISHABLE_KEY || '').trim();
  if (!url && !key) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Invalid public authentication configuration');
  }
  if (
    parsed.protocol !== 'https:' ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    parsed.pathname !== '/'
  )
    throw new Error('Invalid public authentication configuration');
  let allowed = /^sb_publishable_[A-Za-z0-9_-]{10,}$/.test(key);
  if (key.split('.').length === 3) {
    try {
      allowed =
        JSON.parse(atob(key.split('.')[1].replaceAll('-', '+').replaceAll('_', '/'))).role ===
        'anon';
    } catch {
      allowed = false;
    }
  }
  if (!allowed) throw new Error('Only a public Supabase publishable/anon key is allowed');
  return { url: parsed.origin, key };
}
