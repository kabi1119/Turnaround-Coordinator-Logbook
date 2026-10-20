import { useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Field } from '../components/ui';
import { useT } from '../i18n';
import { authenticationReady, resumeAuthRequests } from './client';
export default function SignIn({
  client,
  onVerified,
  onGuest,
}: {
  client: SupabaseClient | null;
  onVerified: (email: string) => Promise<void>;
  onGuest: () => void;
}) {
  const t = useT();
  const [email, setEmail] = useState(''),
    [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [until, setUntil] = useState(0),
    [now, setNow] = useState(Date.now);
  const pending = useRef(false),
    sequence = useRef(0);
  useEffect(
    () => () => {
      sequence.current++;
    },
    [],
  );
  useEffect(() => {
    if (!until) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [until]);
  const remaining = Math.max(0, Math.ceil((until - now) / 1000));
  async function run(verify: boolean) {
    if (!client || pending.current || (!verify && remaining)) return;
    pending.current = true;
    setBusy(true);
    setError('');
    const turn = ++sequence.current;
    try {
      await authenticationReady();
      if (sequence.current !== turn) return;
      resumeAuthRequests();
      const result = verify
        ? await client.auth.verifyOtp({ email: email.trim(), token: code, type: 'email' })
        : await client.auth.signInWithOtp({
            email: email.trim(),
            options: { shouldCreateUser: false },
          });
      if (sequence.current !== turn) return;
      if (result.error) throw result.error;
      if (verify) {
        if (!result.data.session) throw new Error('No session');
        await onVerified(email.trim());
      } else {
        setStep('code');
        setCode('');
        setNow(Date.now());
        setUntil(Date.now() + 60_000);
      }
    } catch {
      if (sequence.current === turn) {
        setError(
          verify
            ? t(
                'Could not verify this code or account. Check the code, request a new one after the cooldown, or try again when connected.',
                '未能驗證此代碼或帳戶。請檢查代碼、等候後重新索取，或連線後再試。',
              )
            : t(
                'Could not send a code. Check your connection and try again later. Account access is invitation only.',
                '未能傳送代碼。請檢查連線並稍後再試；帳戶只限獲邀用戶。',
              ),
        );
        if (!verify) {
          setNow(Date.now());
          setUntil(Date.now() + 60_000);
        }
      }
    } finally {
      if (sequence.current === turn) {
        pending.current = false;
        setBusy(false);
      }
    }
  }
  return (
    <div className="sign-in-form">
      <h2>{t('Sign in to your account', '登入你的帳戶')}</h2>
      <p>
        {t(
          'Secure cross-device cloud sync is coming soon. Sign in to get your account ready.',
          '安全跨裝置雲端同步即將推出，先登入以準備好帳戶。',
        )}
      </p>
      {!client && (
        <p className="notice amber" role="status">
          {t(
            'Account sign-in is not configured on this installation. Guest Mode remains available.',
            '此版本尚未設定帳戶登入，仍可使用訪客模式。',
          )}
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(step === 'code');
        }}
        aria-busy={busy}
      >
        {step === 'email' ? (
          <Field
            label={t('Email address', '電郵地址')}
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
          />
        ) : (
          <>
            <p>
              {t('Verification code sent to', '驗證代碼收件地址')}{' '}
              <strong className="auth-email">{email}</strong>
            </p>
            <Field
              label={t('Six-digit verification code', '六位數驗證代碼')}
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              disabled={busy}
            />
          </>
        )}
        <button
          className="primary"
          type="submit"
          disabled={!client || busy || (step === 'email' && remaining > 0)}
        >
          {busy
            ? t('Please wait…', '請稍候…')
            : step === 'code'
              ? t('Verify code', '驗證代碼')
              : t('Continue with Email OTP', '使用電郵一次性密碼繼續')}
        </button>
        {step === 'code' && (
          <div className="auth-secondary-actions">
            <button type="button" disabled={busy || remaining > 0} onClick={() => void run(false)}>
              {t('Resend code', '重新傳送代碼')}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setStep('email');
                setCode('');
                setError('');
              }}
            >
              {t('Back to email entry', '返回電郵輸入')}
            </button>
          </div>
        )}
        {remaining > 0 && (
          <p role="status">
            {t('Request another code in', '可再次索取代碼的剩餘時間')} {remaining}s
          </p>
        )}
      </form>
      {error && (
        <p role="alert" className="notice amber">
          {error}
        </p>
      )}
      <button className="passkey-soon" disabled type="button">
        {t('Continue with Passkey', '使用通行密鑰繼續')}{' '}
        <small>{t('Coming Soon', '即將推出')}</small>
      </button>
      <p className="auth-invitation">
        {t('Account access is currently by invitation only.', '目前帳戶只限獲邀用戶。')}
      </p>
      <div className="auth-guest">
        <button
          type="button"
          onClick={() => {
            sequence.current++;
            onGuest();
          }}
        >
          {t('Continue as Guest', '以訪客身分繼續')}
        </button>
        <p>{t('Keep your records on this device only.', '紀錄只儲存在此裝置。')}</p>
      </div>
    </div>
  );
}
