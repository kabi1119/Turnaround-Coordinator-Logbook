import { useState } from 'react';
import { ArrowUpRight, Plus, BookOpen } from 'lucide-react';
import { competencies, hkToday, id } from '../domain/model';
import type { Database, Journal as JournalRecord } from '../domain/model';
import { Badge, Confirm, Empty, Field, Modal, Select, TextArea } from '../components/ui';
import { cardText } from '../domain/selectors';
import { useLabel, useT } from '../i18n';
export function JournalPage({
  db,
  onOpen,
  onNew,
}: {
  db: Database;
  onOpen: (j: JournalRecord) => void;
  onNew: () => void;
}) {
  const t = useT(),
    l = useLabel();
  const [q, setQ] = useState(''),
    [tag, setTag] = useState(''),
    [from, setFrom] = useState(''),
    [to, setTo] = useState('');
  const rows = db.journals
    .filter(
      (j) =>
        (!q ||
          [
            j.title,
            j.situation,
            j.challenge,
            j.responsibility,
            j.actions,
            j.result,
            j.learning,
            ...j.tags,
          ]
            .join(' ')
            .toLowerCase()
            .includes(q.toLowerCase())) &&
        (!tag || j.tags.includes(tag)) &&
        (!from || j.date >= from) &&
        (!to || j.date <= to),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">REFLECT / GROW</span>
          <h1>{t('Your experience,\nworth remembering.', '值得記下的\n每一份經驗。')}</h1>
          <p>
            {t(
              'A space for lessons, contributions and the work behind the numbers.',
              '記下數字背後的學習、貢獻及經驗。',
            )}
          </p>
        </div>
        <button className="primary" onClick={onNew}>
          <Plus size={18} />
          {t('New Journal', '新增日誌')}
        </button>
      </div>
      <div className="panel filters journal-filters">
        <Field
          label={t('Search Journal', '搜尋日誌')}
          placeholder={t('Search stories or competencies', '搜尋故事或能力')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Select
          label={t('Competency', '能力')}
          options={competencies}
          placeholder={t('All competencies', '所有能力')}
          value={tag}
          onChange={(e) => setTag(e.target.value)}
        />
        <Field
          label={t('From', '由')}
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
        <Field
          label={t('To', '至')}
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
      </div>
      <p className="muted">
        {t(
          'Reflect on your experience. Journal entries do not increase Aircraft totals.',
          '只限虛構故事，日誌不計入航機統計。',
        )}
      </p>
      <div className="journal-grid">
        {rows.map((j) => (
          <button className="journal-card" key={j.id} onClick={() => onOpen(j)}>
            <div className="section-title">
              <span className="journal-icon">
                <BookOpen size={21} />
              </span>
              <ArrowUpRight size={20} />
            </div>
            <span className="eyebrow">{j.date}</span>
            <h2>{j.title}</h2>
            <p>{j.learning || j.situation || t('A story in progress.', '撰寫中的故事。')}</p>
            <div className="tags">
              {j.tags.map((tag) => (
                <Badge key={tag}>{l(tag)}</Badge>
              ))}
              <Badge tone={j.status === 'Draft' ? 'amber' : 'teal'}>{l(j.status)}</Badge>
            </div>
            <small>
              {j.aircraftIds.length} {t('Aircraft links', '航機連結')}
              {j.dutyId ? ' · Duty' : ''}
            </small>
          </button>
        ))}
      </div>
      {rows.length === 0 && (
        <Empty
          text={t('No stories match. Start a new reflection.', '沒有符合的日誌，試試新增一篇。')}
        />
      )}
    </>
  );
}
export function JournalEditor({
  db,
  existing,
  onClose,
  commit,
}: {
  db: Database;
  existing?: JournalRecord;
  onClose: () => void;
  commit: (db: Database) => boolean;
}) {
  const t = useT(),
    l = useLabel();
  const [j, setJ] = useState<JournalRecord>(
    existing
      ? structuredClone(existing)
      : {
          id: id(),
          date: hkToday(),
          title: '',
          status: 'Draft',
          situation: '',
          challenge: '',
          responsibility: '',
          actions: '',
          result: '',
          learning: '',
          tags: [],
          dutyId: '',
          aircraftIds: [],
          outcome: '',
          unit: '',
          contribution: '',
          evidence: '',
          verification: 'Self-reported · not employer verified',
        },
  );
  const [error, setError] = useState(''),
    [dirty, setDirty] = useState(false),
    [discard, setDiscard] = useState(false);
  const patch = (p: Partial<JournalRecord>) => {
    setJ({ ...j, ...p });
    setDirty(true);
  };
  const requestClose = () => (dirty ? setDiscard(true) : onClose());
  const [linkMode, setLinkMode] = useState(
    j.dutyId ? 'duty' : j.aircraftIds.length ? 'aircraft' : 'standalone',
  );
  const sections = [
    ['situation', 'Situation', '情境'],
    ['challenge', 'Challenge', '挑戰'],
    ['responsibility', 'My Responsibility', '本人責任'],
    ['actions', 'My Actions', '本人行動'],
    ['result', 'Result', '結果'],
    ['learning', 'Learning', '學習'],
  ] as const;
  return (
    <>
      <Modal
        title={existing ? t('Career Journal', '職涯日誌') : t('New Career Journal', '新增職涯日誌')}
        onClose={requestClose}
        wide
      >
        <p className="muted">
          {t(
            'Synthetic, sanitized experiences only. Self-reported, not employer verified.',
            '只限去識別化虛構經驗，自行申報，並非僱主核實。',
          )}
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (
              commit({
                ...db,
                journals: existing
                  ? db.journals.map((x) => (x.id === j.id ? j : x))
                  : [...db.journals, j],
              })
            )
              onClose();
            else setError(t('Could not save locally.', '未能在本機儲存。'));
          }}
        >
          <Field
            label={t('Title', '標題')}
            required
            value={j.title}
            onChange={(e) => patch({ title: e.target.value })}
          />
          <div className="form-grid">
            <Field
              label={t('Date', '日期')}
              type="date"
              required
              value={j.date}
              onChange={(e) => patch({ date: e.target.value })}
            />
            <Select
              label={t('Status', '狀態')}
              options={['Draft', 'Confirmed']}
              value={j.status}
              onChange={(e) => patch({ status: e.target.value as JournalRecord['status'] })}
            />
          </div>
          {sections.map(([key, en, zh]) => (
            <TextArea
              key={key}
              label={t(en, zh)}
              value={j[key]}
              onChange={(e) => patch({ [key]: e.target.value })}
            />
          ))}
          <fieldset>
            <legend>{t('Competency Tags', '能力標籤')}</legend>
            <div className="tags">
              {competencies.map((tag) => (
                <label className="tag-check" key={tag}>
                  <input
                    type="checkbox"
                    checked={j.tags.includes(tag)}
                    onChange={() =>
                      patch({
                        tags: j.tags.includes(tag)
                          ? j.tags.filter((x) => x !== tag)
                          : [...j.tags, tag],
                      })
                    }
                  />
                  {l(tag)}
                </label>
              ))}
            </div>
          </fieldset>
          <Select
            label={t('Link experience to', '連結經驗至')}
            options={[
              {
                value: 'standalone',
                label: t('Standalone / other career experience', '獨立／其他職涯經驗'),
              },
              { value: 'duty', label: t('One Duty', '一個更次') },
              { value: 'aircraft', label: t('Multiple Aircraft Records', '多個航機紀錄') },
            ]}
            value={linkMode}
            onChange={(e) => {
              setLinkMode(e.target.value);
              patch({ dutyId: '', aircraftIds: [], originalDutyId: undefined });
            }}
          />
          {linkMode === 'duty' && (
            <Select
              label={t('Linked Duty', '連結更次')}
              placeholder={t('No link', '不連結')}
              options={db.duties
                .filter((d) => d.status !== 'Trashed')
                .map((d) => ({
                  value: d.id,
                  label: `${d.date} ${d.start}–${d.end} · ${l(d.status)} · ${d.id.slice(0, 5)}`,
                }))}
              value={j.dutyId}
              onChange={(e) => patch({ dutyId: e.target.value, originalDutyId: undefined })}
            />
          )}
          {linkMode === 'aircraft' && (
            <fieldset>
              <legend>
                {t('Linked Aircraft · uncheck to unlink', '連結航機 · 取消勾選即可解除')}
              </legend>
              {db.aircraft
                .filter((a) => a.status !== 'Trashed')
                .map((a) => (
                  <label className="check" key={a.id}>
                    <input
                      type="checkbox"
                      checked={j.aircraftIds.includes(a.id)}
                      onChange={() =>
                        patch({
                          aircraftIds: j.aircraftIds.includes(a.id)
                            ? j.aircraftIds.filter((x) => x !== a.id)
                            : [...j.aircraftIds, a.id],
                        })
                      }
                    />
                    {a.date} · {cardText(a, db.settings.privacy).title} · {a.id.slice(0, 6)}
                  </label>
                ))}
            </fieldset>
          )}
          <details>
            <summary>{t('Outcomes & evidence · optional', '成果與資料來源 · 選填')}</summary>
            <div className="form-grid">
              <Field
                label={t('Quantified outcome', '成果數值')}
                type="number"
                value={j.outcome}
                onChange={(e) => patch({ outcome: e.target.value })}
              />
              <Field
                label={t('Unit', '單位')}
                value={j.unit}
                onChange={(e) => patch({ unit: e.target.value })}
              />
            </div>
            <TextArea
              label={t('My contribution', '個人貢獻')}
              value={j.contribution}
              onChange={(e) => patch({ contribution: e.target.value })}
            />
            <Field
              label={t('Evidence / source', '證據／來源')}
              value={j.evidence}
              onChange={(e) => patch({ evidence: e.target.value })}
            />
            <Select
              label={t(
                'Verification classification · personal label only',
                '核實分類 · 僅個人標籤',
              )}
              options={[
                'Self-reported · not employer verified',
                'Synthetic exercise · unverified',
                'Personal reflection · unverified',
              ]}
              value={j.verification}
              onChange={(e) => patch({ verification: e.target.value })}
            />
          </details>
          {error && <p role="alert">{error}</p>}
          <div className="actions">
            <button type="button" onClick={requestClose}>
              {t('Close', '關閉')}
            </button>
            <button className="primary">{t('Save Journal', '儲存日誌')}</button>
          </div>
        </form>
      </Modal>
      {discard && (
        <Confirm
          title={t('Discard unsaved Journal changes?', '捨棄未儲存的日誌修改？')}
          onClose={() => setDiscard(false)}
          onConfirm={onClose}
          confirmLabel={t('Discard changes', '捨棄修改')}
        >
          <p>{t('No changes will be saved.', '不會儲存修改。')}</p>
        </Confirm>
      )}
    </>
  );
}
