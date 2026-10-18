import { useState } from 'react';
import type { Duty } from '../domain/model';
import { hkToday } from '../domain/model';
import { calendarExamples } from '../domain/dutyCalendar';
import { dutyOptionText } from '../domain/roster';
import DutyCalendar from '../components/DutyCalendar';
import { useCalendarNow } from '../lib/useCalendarNow';
import { Modal } from '../components/ui';
import { useT, useLabel } from '../i18n';
import { useMotionClose } from '../lib/useMotionClose';

export default function FullDutyCalendar({
  duties,
  onDuty,
  open,
  onClose: leave,
}: {
  duties: Duty[];
  onDuty: (d: Duty) => void;
  open: boolean;
  onClose: () => void;
}) {
  const t = useT(),
    l = useLabel(),
    now = useCalendarNow();
  const { closing, close: onClose } = useMotionClose(leave);
  const [month, setMonth] = useState(hkToday().slice(0, 7)),
    [day, setDay] = useState(hkToday()),
    [preview, setPreview] = useState(false);
  const rows = duties
    .filter((d) => d.date === day && d.status !== 'Trashed')
    .sort((a, b) => a.start.localeCompare(b.start));
  if (!open) return null;
  return (
    <>
      <Modal
        title={t('Full Duty Calendar', '完整更次月曆')}
        onClose={onClose}
        wide
        closing={closing}
      >
        <div className="calendar-secondary">
          <p className="muted">
            {t(
              'Saved duties on this device. Preview examples are fictional and read-only.',
              '此裝置已儲存的更次；預覽範例為唯讀虛構資料。',
            )}
          </p>
          <button className="text-button" onClick={() => setPreview(true)}>
            {t('Fictional calendar preview', '虛構月曆預覽')}
          </button>
        </div>
        <div className="actions">
          <button onClick={onClose}>{t('Return to Home', '返回首頁')}</button>
        </div>
        <DutyCalendar
          duties={duties}
          month={month}
          onMonth={setMonth}
          selected={[day]}
          onSelect={setDay}
        />
        <div className="calendar-records motion-date-details" key={day} aria-live="polite">
          <h3>{day}</h3>
          {rows.length ? (
            rows.map((d) => (
              <button key={d.id} onClick={() => onDuty(d)}>
                {dutyOptionText(d, l)} · {l(d.status)}
              </button>
            ))
          ) : (
            <p className="muted">{t('No duty records for this date.', '此日期沒有更次紀錄。')}</p>
          )}
        </div>
      </Modal>
      {preview && (
        <Modal
          title={t('Fictional calendar preview', '虛構月曆預覽')}
          onClose={() => setPreview(false)}
        >
          <p className="notice">
            {t(
              'Read-only synthetic examples, relative to Hong Kong today. These are not your saved duties and are never written to storage.',
              '按香港當日動態產生的唯讀虛構範例，並非已儲存更次，也不會寫入本機資料。',
            )}
          </p>
          <DutyCalendar
            duties={calendarExamples(month, now)}
            month={month}
            onMonth={setMonth}
            selected={[day]}
            onSelect={setDay}
            now={now}
          />
          <div className="calendar-records">
            {calendarExamples(month, now)
              .filter((d) => d.date === day)
              .map((d) => (
                <p key={d.id}>{dutyOptionText(d, l)}</p>
              ))}
          </div>
        </Modal>
      )}
    </>
  );
}
