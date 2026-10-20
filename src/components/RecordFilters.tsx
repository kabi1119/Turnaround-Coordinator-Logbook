import type { Aircraft, Filters, Privacy } from '../domain/model';
import { flightStatuses, handlingTypes, roles } from '../domain/model';
import { Field, Select } from './ui';
import { useT } from '../i18n';
import type { ReactNode } from 'react';
export default function RecordFilters({
  records,
  privacy,
  value,
  onChange,
  extra,
}: {
  records: Aircraft[];
  privacy: Privacy;
  value: Filters;
  onChange: (f: Filters) => void;
  extra?: ReactNode;
}) {
  const t = useT();
  const set = (k: keyof Filters, v: string) => onChange({ ...value, [k]: v });
  const unique = (key: 'airline' | 'family' | 'variant') =>
    [
      ...new Set(
        records
          .filter((a) => a.status !== 'Trashed')
          .map((a) => a[key])
          .filter(Boolean),
      ),
    ].sort();
  return (
    <div className="panel filter-panel">
      <div className="filter-top">
        <Field
          label={t('Search records', '搜尋紀錄')}
          placeholder={t('Airline, aircraft or enabled fields…', '航空公司、航機或已啟用欄位…')}
          value={value.query || ''}
          onChange={(e) => set('query', e.target.value)}
        />
        <button onClick={() => onChange({})}>{t('Clear filters', '清除篩選')}</button>
      </div>
      <details>
        <summary>
          {t('Filters', '篩選')}{' '}
          <span>
            {Object.values(value).filter(Boolean).length} {t('active', '項啟用')}
          </span>
        </summary>
        <div className="filters">
          {extra}
          <Select
            label={t('Period', '期間')}
            value=""
            options={[
              { value: '', label: t('Choose a preset…', '選擇期間…') },
              { value: 'all', label: t('Lifetime', '全部') },
              { value: 'year', label: t('2026', '2026 年') },
              { value: 'month', label: t('October 2026', '2026 年 10 月') },
            ]}
            onChange={(e) =>
              onChange({
                ...value,
                from:
                  e.target.value === 'year'
                    ? '2026-01-01'
                    : e.target.value === 'month'
                      ? '2026-10-01'
                      : '',
                to:
                  e.target.value === 'year'
                    ? '2026-12-31'
                    : e.target.value === 'month'
                      ? '2026-10-31'
                      : '',
              })
            }
          />
          <Field
            label={t('From · Handling Date', '由 · 處理日期')}
            type="date"
            value={value.from || ''}
            onChange={(e) => set('from', e.target.value)}
          />
          <Field
            label={t('To · Handling Date', '至 · 處理日期')}
            type="date"
            value={value.to || ''}
            onChange={(e) => set('to', e.target.value)}
          />
          <Select
            label={t('Airline', '航空公司')}
            placeholder={t('All airlines', '所有航空公司')}
            options={unique('airline')}
            value={value.airline || ''}
            onChange={(e) => set('airline', e.target.value)}
          />
          <Select
            label={t('Aircraft family', '航機系列')}
            placeholder={t('All families', '所有系列')}
            options={unique('family')}
            value={value.family || ''}
            onChange={(e) => set('family', e.target.value)}
          />
          <Select
            label={t('Variant', '子型號')}
            placeholder={t('All variants', '所有子型號')}
            options={unique('variant')}
            value={value.variant || ''}
            onChange={(e) => set('variant', e.target.value)}
          />
          <Select
            label={t('My Role', '本人角色')}
            placeholder={t('All roles', '所有角色')}
            options={roles}
            value={value.role || ''}
            onChange={(e) => set('role', e.target.value)}
          />
          <Select
            label={t('Handling Type', '處理類型')}
            placeholder={t('All handling types', '所有處理類型')}
            options={handlingTypes}
            value={value.handling || ''}
            onChange={(e) => set('handling', e.target.value)}
          />
          {privacy.statuses && (
            <>
              <Select
                label={t('Arrival Status', '抵港狀態')}
                placeholder={t('All arrival statuses', '所有抵港狀態')}
                options={flightStatuses}
                value={value.arrival || ''}
                onChange={(e) => set('arrival', e.target.value)}
              />
              <Select
                label={t('Departure Status', '離港狀態')}
                placeholder={t('All departure statuses', '所有離港狀態')}
                options={flightStatuses}
                value={value.departure || ''}
                onChange={(e) => set('departure', e.target.value)}
              />
            </>
          )}
          <Select
            label={t('Disruption', '異常')}
            placeholder={t('All disruption statuses', '所有異常狀態')}
            options={['Unknown', 'Normal', 'Disrupted']}
            value={value.disruption || ''}
            onChange={(e) => set('disruption', e.target.value)}
          />
        </div>
      </details>
      {value.from && value.to && value.from > value.to && (
        <p role="alert">
          {t(
            'Start date is after end date. No records can match.',
            '開始日期遲於結束日期，沒有符合紀錄。',
          )}
        </p>
      )}
    </div>
  );
}
