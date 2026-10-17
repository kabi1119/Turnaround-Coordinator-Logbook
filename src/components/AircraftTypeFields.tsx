import type { Aircraft } from '../domain/model';
import { aircraftCatalogue, aircraftModel, knownIcao } from '../data/aircraftCatalogue';
import { Field, Select } from './ui';
import { useT } from '../i18n';

export default function AircraftTypeFields({
  a,
  onChange,
}: {
  a: Aircraft;
  onChange: (part: Partial<Aircraft>) => void;
}) {
  const t = useT(),
    model = aircraftModel(a),
    type = aircraftCatalogue.find((x) => x.model === model);
  const legacy = a.aircraftType === undefined && !!a.variant;
  const options = type ? ([...type.variants] as string[]) : [];
  if (legacy && a.variant && !options.includes(a.variant)) options.push(a.variant);
  return (
    <div className="aircraft-type-fields">
      <Select
        label={t('Aircraft Type *', '航機型號 *')}
        placeholder={t('Select aircraft type', '選擇航機型號')}
        value={type ? model : legacy ? 'legacy' : ''}
        options={[
          ...aircraftCatalogue.map((x) => ({
            value: x.model,
            label: `${x.model.startsWith('A') ? 'Airbus' : 'Boeing'} ${x.model}`,
          })),
          ...(!type && legacy
            ? [{ value: 'legacy', label: t('Historical / custom aircraft', '歷史／自訂航機') }]
            : []),
        ]}
        onChange={(e) => {
          const chosen = aircraftCatalogue.find((x) => x.model === e.target.value);
          onChange({
            aircraftType: chosen?.model || '',
            variant: '',
            family: chosen?.family || '',
            icao: '',
          });
        }}
      />
      {!type && legacy ? (
        <Field
          label={t('Aircraft Variant · historical/custom', '航機子型號 · 歷史／自訂')}
          value={a.variant}
          onChange={(e) => onChange({ variant: e.target.value })}
        />
      ) : (
        <Select
          label={t('Aircraft Variant *', '航機子型號 *')}
          disabled={!type}
          placeholder={t('Select variant', '選擇子型號')}
          options={options}
          value={a.variant}
          onChange={(e) =>
            onChange({
              variant: e.target.value,
              aircraftType: e.target.value === a.variant && legacy ? undefined : type?.model,
              family: type?.family || '',
              icao: knownIcao[e.target.value] || '',
            })
          }
        />
      )}
      {legacy && (
        <small>
          {t(
            'Historical aircraft values remain unchanged until you choose a replacement.',
            '歷史航機資料會保留，直至你選擇替代值。',
          )}
        </small>
      )}
    </div>
  );
}
