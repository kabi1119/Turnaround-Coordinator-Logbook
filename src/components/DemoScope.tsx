import type { Aircraft } from '../domain/model';
import { isCurrentDemo } from '../data/demoDatasetRefresh';
import { stats } from '../domain/selectors';
import { useT } from '../i18n';

export default function DemoScope({ rows }: { rows: Aircraft[] }) {
  const t = useT(),
    demo = rows.filter(isCurrentDemo),
    totals = stats(demo);
  return (
    <p className="muted demo-scope">
      {t(
        'Metrics above cover all matching records. Historical sample subset',
        '以上統計涵蓋所有符合紀錄。歷史樣本子集',
      )}
      : {demo.length} · {t('Logged / Handled / Primary', '記錄／處理／主要')}: {totals.logged} /{' '}
      {totals.handled} / {totals.primary}.{' '}
      {t(
        'Edited, historical and custom records remain in overall totals.',
        '修改過、歷史及自訂紀錄仍計入整體總數。',
      )}
    </p>
  );
}
