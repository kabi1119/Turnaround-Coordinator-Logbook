import { useContext, useEffect, useRef, useState } from 'react';
import { LogIn, UserRound, ChevronDown } from 'lucide-react';
import { LanguageContext, useT } from '../i18n';
import { Modal } from '../components/ui';
import SyncControl from '../sync/SyncControl';
import type { SyncEngine } from '../sync/engine';
import type { AccountIdentity } from './client';
export default function AccountControl({
  user,
  syncEngine = null,
  offline,
  onSignIn,
  onLeave,
}: {
  user: AccountIdentity | null;
  syncEngine?: SyncEngine | null;
  offline: boolean;
  onSignIn: (language: 'en' | 'zh-HK') => void;
  onLeave: () => void;
}) {
  const t = useT(),
    language = useContext(LanguageContext);
  const [open, setOpen] = useState(false),
    [settings, setSettings] = useState(false);
  const group = useRef<HTMLDivElement>(null),
    button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    group.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const outside = (e: PointerEvent) => {
      if (!group.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  if (!user)
    return (
      <button className="account-trigger" onClick={() => onSignIn(language)}>
        <LogIn size={18} />
        <span>{t('Sign in', '登入')}</span>
      </button>
    );
  const close = () => {
    setOpen(false);
    button.current?.focus();
  };
  return (
    <div
      className="account-control"
      ref={group}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false);
      }}
      onKeyDown={(e) => {
        if (open && e.key === 'Escape') {
          e.preventDefault();
          close();
        }
        if (open && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
          e.preventDefault();
          const items = [...group.current!.querySelectorAll<HTMLElement>('[role="menuitem"]')];
          const index = items.indexOf(document.activeElement as HTMLElement);
          items[
            e.key === 'Home'
              ? 0
              : e.key === 'End'
                ? items.length - 1
                : (index + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
          ]?.focus();
        }
      }}
    >
      <button
        ref={button}
        className="account-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <UserRound size={18} />
        <span>{offline ? t('Vault', '資料庫') : t('Account', '帳戶')}</span>
        <ChevronDown size={13} />
      </button>
      {open && (
        <div className="account-menu" role="menu" aria-label={t('Account menu', '帳戶選單')}>
          <p>
            {offline
              ? t('Local vault unlocked · Session not verified', '本機資料庫已解鎖 · 未驗證登入')
              : t('Signed in as', '已登入為')}
            <strong className="auth-email">
              {user.email || t('Offline account vault', '離線帳戶資料庫')}
            </strong>
          </p>
          <p>
            {t('Account workspace', '帳戶工作區')}
            <small>
              {t('Manage encrypted sync in Account Settings', '在帳戶設定管理加密同步')}
            </small>
          </p>
          <button
            role="menuitem"
            onClick={() => {
              close();
              setSettings(true);
            }}
          >
            {t('Account Settings', '帳戶設定')}
          </button>
          {offline && (
            <button
              role="menuitem"
              onClick={() => {
                close();
                onSignIn(language);
              }}
            >
              {t('Sign in', '登入')}
            </button>
          )}
          <button role="menuitem" onClick={onLeave}>
            {t('Switch to Guest', '切換至訪客')}
          </button>
          <button role="menuitem" onClick={onLeave}>
            {t('Sign Out', '登出')}
          </button>
        </div>
      )}
      {settings && (
        <Modal
          syncControl
          title={t('Account Settings', '帳戶設定')}
          onClose={() => setSettings(false)}
        >
          <p>{user.email || t('Server session not verified', '未驗證伺服器登入狀態')}</p>
          <SyncControl engine={syncEngine} />
          <p>
            {t(
              'Sign out locks the vault without deleting it. Keep a verified JSON backup; losing the vault passphrase can make local records unrecoverable.',
              '登出會鎖定資料庫而不刪除紀錄。請保留已核對的 JSON 備份；遺失密語可能令本機紀錄無法復原。',
            )}
          </p>
        </Modal>
      )}
    </div>
  );
}
