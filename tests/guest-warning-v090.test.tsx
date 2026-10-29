import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import SignIn from '../src/auth/SignIn';
import { LanguageContext } from '../src/i18n';
const warning =
  'Your data is stored only on this device and may be lost if you clear browser data or remove the app.';
it('places the requested readable warning directly below Continue as Guest without opening a modal or authenticating', () => {
  const guest = vi.fn(),
    verified = vi.fn();
  render(<SignIn client={null} onVerified={verified} onGuest={guest} />);
  const button = screen.getByRole('button', { name: 'Continue as Guest' });
  expect(button.nextElementSibling).toHaveTextContent(warning);
  expect(screen.getByText(warning)).toBeVisible();
  fireEvent.click(button);
  expect(guest).toHaveBeenCalledOnce();
  expect(verified).not.toHaveBeenCalled();
  expect(screen.queryByRole('dialog')).toBeNull();
});
it('localizes the Guest warning while retaining its inline placement', () => {
  render(
    <LanguageContext.Provider value="zh-HK">
      <SignIn client={null} onVerified={async () => {}} onGuest={() => {}} />
    </LanguageContext.Provider>,
  );
  expect(
    screen.getByRole('button', { name: '以訪客身分繼續' }).nextElementSibling,
  ).toHaveTextContent('清除瀏覽器資料或移除 App');
});
