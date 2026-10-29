import { useT } from '../i18n';
export default function GuestDataWarning() {
  const t = useT();
  return (
    <p className="auth-invitation guest-data-warning">
      {t(
        'Your data is stored only on this device and may be lost if you clear browser data or remove the app.',
        '資料只儲存在此裝置；清除瀏覽器資料或移除 App 可能令資料遺失。',
      )}
    </p>
  );
}
