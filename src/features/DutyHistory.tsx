import type { Duty } from '../domain/model';
import { previousDuties, shiftRange } from '../domain/roster';
import { Badge, Empty, Modal } from '../components/ui';
import { useLabel, useT } from '../i18n';

export default function DutyHistory({
  duties,
  onDuty,
  onClose,
}: {
  duties: Duty[];
  onDuty: (d: Duty) => void;
  onClose: () => void;
}) {
  const t = useT(),
    l = useLabel(),
    rows = previousDuties(duties);
  return (
    <Modal title={t('Previous Duties', '過往更次')} onClose={onClose} wide>
      <p className="muted">
        {t(
          'Latest past start first · Hong Kong dates. Planned does not mean worked. Future shifts remain in the Logbook.',
          '按香港開更日期由近至遠排列。計劃不代表已工作；未來更次仍可在紀錄簿查看。',
        )}
      </p>
      {rows.map((d) => {
        const range = shiftRange(d);
        return (
          <button key={d.id} className="duty-row duty-history-row" onClick={() => onDuty(d)}>
            <span>
              <strong>{d.date}</strong>
              <small>
                {d.start || '—'} – {d.end || '—'}
                {range?.overnight ? ` (+1 · ${range.endDate})` : ''}
              </small>
            </span>
            <Badge tone={d.status === 'Draft' ? 'amber' : 'teal'}>
              {l(d.status)} ·{' '}
              {l(d.workState || (d.status === 'Confirmed' ? 'Worked' : 'Not Recorded'))}
              {d.shiftType ? ` · ${l(d.shiftType)}` : ''}
            </Badge>
          </button>
        );
      })}
      {!rows.length && (
        <Empty
          text={t(
            'No previous saved duties. Add a Duty or open the Logbook for future plans.',
            '尚無過往更次，可新增更次或在紀錄簿查看未來計劃。',
          )}
        />
      )}
    </Modal>
  );
}
