import { attestHandlingReview, chooseRequiredHandling } from './handlingHelpers';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from '../src/App';
import AirlineCombobox from '../src/components/AirlineCombobox';
import AircraftEditor from '../src/features/AircraftEditor';
import DutyPicker from '../src/components/DutyPicker';
import { airlineCatalogue, orderAirlines, searchAirlines } from '../src/data/airlineCatalogue';
import { seedDatabase } from '../src/data/seed';
import { dutyOptionText } from '../src/domain/roster';
import { stats } from '../src/domain/selectors';
import { LanguageContext } from '../src/i18n';
import { STORAGE_KEY } from '../src/lib/storage';
import { createBackup, parseBackup } from '../src/lib/backup';

const expected = [
  'CX',
  'UO',
  'LD',
  'PX',
  'AK',
  'D7',
  'PG',
  'DL',
  'MS',
  'FJ',
  'QZ',
  'JL',
  '7C',
  'GK',
  'KE',
  'LH',
  'Z2',
  'QR',
  'BI',
  'RJ',
  'S7',
  'JX',
  '9G',
  'LX',
];
describe('v0.3.1 shared airline ordering', () => {
  it('prioritizes CX/UO/LD then exactly 21 English-name alphabetical identities without mutation', () => {
    const before = structuredClone(airlineCatalogue);
    const ordered = orderAirlines(airlineCatalogue);
    expect(ordered.map((a) => a.iata)).toEqual(expected);
    expect(new Set(ordered.map((a) => a.iata)).size).toBe(24);
    expect(airlineCatalogue).toEqual(before);
    expect(searchAirlines('  ').map((a) => a.iata)).toEqual(expected);
    for (const a of ordered) expect(a).toBe(airlineCatalogue.find((x) => x.iata === a.iata));
  });
  it('filters active queries without unrelated pinned identities and preserves aliases', () => {
    expect(searchAirlines('CX').map((a) => a.iata)).toEqual(['CX']);
    expect(searchAirlines('Hong Kong Express').map((a) => a.iata)).toEqual(['UO']);
    expect(searchAirlines('Lufthansa German').map((a) => a.iata)).toEqual(['LH']);
    const matches = searchAirlines('a');
    expect(matches[0].iata).toBe('LD');
    expect(matches.findIndex((a) => a.iata === 'CX')).toBeGreaterThan(
      matches.findIndex((a) => a.iata === 'LD'),
    );
    expect(matches.some((a) => a.iata === 'UO')).toBe(false);
    expect(searchAirlines('unknown airline')).toEqual([]);
  });
  it.each([false, true])(
    'connects the same 24 local-logo order to the %s existing-record form',
    (existing) => {
      const db = seedDatabase();
      render(
        <AircraftEditor
          db={db}
          existing={existing ? db.aircraft[0] : undefined}
          commit={() => true}
          onSaved={() => {}}
          onClose={() => {}}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Show airline options' }));
      const options = within(screen.getByRole('listbox')).getAllByRole('option');
      expect(options.map((o) => o.querySelector('strong')?.textContent)).toEqual(expected);
      options.forEach((o, i) =>
        expect(o.querySelector('img')).toHaveAttribute(
          'src',
          `/assets/airlines/${expected[i]}.png`,
        ),
      );
    },
  );
  it('keyboard selects CX from the default order and preserves custom text after failed searches', () => {
    const onChange = vi.fn();
    render(<AirlineCombobox value="My historical airline" onChange={onChange} />);
    const input = screen.getByRole('combobox');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('Cathay Pacific');
    fireEvent.change(input, { target: { value: 'Custom unknown' } });
    expect(onChange).toHaveBeenLastCalledWith('Custom unknown');
    expect(screen.getByRole('status')).toHaveTextContent('Custom text is kept');
  });
});

describe('v0.3.1 progress-only duty labels', () => {
  it('displays Scheduled/Worked, overnight and unknown progress without changing dates or data', () => {
    const db = seedDatabase(),
      before = structuredClone(db);
    expect(dutyOptionText(db.duties[0])).toBe('2026-Oct-16 06:00–14:00 · Worked');
    expect(dutyOptionText(db.duties[1])).toBe('2026-Oct-15 22:00–06:00(+1) · Worked');
    expect(dutyOptionText({ ...db.duties[2], date: '2020-01-01' })).toBe(
      '2020-Jan-01 14:00–22:00 · Scheduled',
    );
    expect(
      dutyOptionText({
        ...db.duties[0],
        status: 'Draft',
        workState: undefined,
        start: '',
        end: '',
      }),
    ).toBe('2026-Oct-16 —–— · Work state not recorded');
    expect(db).toEqual(before);
    expect(stats(db.aircraft, db.duties).duties).toBe(2);
    expect(parseBackup(JSON.stringify(createBackup(db))).data).toEqual(before);
  });
  it.each(['en', 'zh-HK'] as const)(
    'renders work progress only with bilingual unknown-state guidance (%s)',
    (language) => {
      const db = seedDatabase();
      db.duties.push({ ...db.duties[0], id: 'legacy', workState: undefined });
      render(
        <LanguageContext.Provider value={language}>
          <DutyPicker duties={db.duties} value="" onChange={() => {}} />
        </LanguageContext.Provider>,
      );
      fireEvent.click(screen.getByRole('combobox'));
      const options = screen.getAllByRole('option');
      expect(
        options.some((o) => o.textContent?.includes(language === 'en' ? 'Scheduled' : '已排班')),
      ).toBe(true);
      expect(
        options.some((o) =>
          o.textContent?.includes(language === 'en' ? 'Work state not recorded' : '未記錄工作進度'),
        ),
      ).toBe(true);
      expect(options.map((o) => o.textContent).join(' ')).not.toMatch(
        /Confirmed|Draft|已確認|草稿/,
      );
    },
  );
});

describe('v0.3.1 final bilingual handling terminology', () => {
  it.each([
    [
      'en',
      'Add',
      'New Handling Record',
      'Review Handling Record',
      'Handling Record',
      'Edit Handling Record',
      'Handling Assignments',
    ],
    [
      'zh-HK',
      '新增',
      '新增航機處理紀錄',
      '覆核航機處理紀錄',
      '航機處理紀錄',
      '編輯航機處理紀錄',
      '航機處理任務',
    ],
  ] as const)(
    'opens, reviews, saves and edits one Full Turnaround using final labels (%s)',
    (language, action, fresh, review, detail, edit, assignments) => {
      const db = seedDatabase();
      db.settings.language = language;
      const original = JSON.stringify(db);
      localStorage.setItem(STORAGE_KEY, original);
      const { container } = render(<App />);
      fireEvent.click(screen.getByRole('button', { name: action }));
      fireEvent.click(
        within(screen.getByRole('dialog')).getByRole('button', { name: new RegExp('^' + fresh) }),
      );
      expect(screen.getByRole('dialog', { name: fresh })).toBeInTheDocument();
      chooseRequiredHandling(language);
      fireEvent.change(
        screen.getByRole('combobox', { name: language === 'en' ? 'Airline *' : '航空公司 *' }),
        { target: { value: 'Cathay Pacific' } },
      );
      fireEvent.change(
        screen.getByLabelText(language === 'en' ? 'Aircraft Type *' : '航機型號 *'),
        { target: { value: 'A321' } },
      );
      fireEvent.change(
        screen.getByLabelText(language === 'en' ? 'Aircraft Variant *' : '航機子型號 *'),
        { target: { value: 'A321neo' } },
      );
      fireEvent.click(screen.getByText(language === 'en' ? 'Save & Close' : '儲存並關閉'));
      expect(screen.getByRole('dialog', { name: review })).toBeInTheDocument();
      expect(localStorage.getItem(STORAGE_KEY)).toBe(original);
      attestHandlingReview();
      fireEvent.click(screen.getByText(language === 'en' ? 'Confirm & Save' : '確認並儲存'));
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
      expect(saved.aircraft).toHaveLength(5);
      expect(stats(saved.aircraft, saved.duties)).toMatchObject({
        logged: 5,
        handled: 4,
        primary: 3,
      });
      fireEvent.click(container.querySelector('.aircraft-card')!);
      expect(screen.getByRole('dialog', { name: detail })).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: edit }));
      expect(screen.getByRole('dialog', { name: edit })).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: language === 'en' ? 'Close' : '關閉' }));
      fireEvent.click(screen.getByText(language === 'en' ? 'Discard changes' : '捨棄修改'));
      fireEvent.click(
        screen.getByRole('button', { name: language === 'en' ? 'Statistics' : '統計' }),
      );
      expect(screen.getByRole('heading', { name: assignments })).toBeInTheDocument();
      fireEvent.click(
        screen.getByRole('button', { name: language === 'en' ? 'Logbook' : '紀錄簿' }),
      );
      expect(container.querySelector('.page-heading .eyebrow')).toHaveTextContent(
        language === 'en' ? 'Aircraft' : '航機',
      );
      fireEvent.click(screen.getByRole('button', { name: fresh }));
      expect(screen.getByRole('dialog', { name: fresh })).toBeInTheDocument();
    },
  );
});
