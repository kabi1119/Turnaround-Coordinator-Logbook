import { fireEvent, screen, within } from '@testing-library/react';

/** Exercise the actual review control; never bypass production validation or persistence. */
export function attestHandlingReview() {
  const review = screen.queryByRole('dialog', { name: /Review Handling Record|覆核航機處理紀錄/ });
  const check =
    review &&
    within(review).queryByRole('checkbox', {
      name: /I confirm this handling assignment actually occurred|我確認此航機處理任務已實際發生/,
    });
  if (check && !(check as HTMLInputElement).checked) fireEvent.click(check);
}

export function chooseRequiredHandling(language: 'en' | 'zh-HK' = 'en') {
  const zh = language === 'zh-HK';
  fireEvent.change(screen.getByLabelText(zh ? '處理類型 *' : 'Handling Type *'), {
    target: { value: 'Full Turnaround' },
  });
  fireEvent.change(screen.getByLabelText(zh ? '本人角色 *' : 'My Role *'), {
    target: { value: 'Primary Coordinator' },
  });
  const arrival = screen.queryByLabelText(zh ? '抵港航班編號 *' : 'Arrival Flight Number *');
  const departure = screen.queryByLabelText(zh ? '離港航班編號 *' : 'Departure Flight Number *');
  if (arrival) fireEvent.change(arrival, { target: { value: '9401' } });
  if (departure) fireEvent.change(departure, { target: { value: '9402' } });
}
