export type DelaySeverity =
  'None / Below threshold' | 'Minor' | 'Moderate' | 'Major' | 'Undetermined';

/** Owner-defined personal thresholds; source is user-entered whole disruption-delay minutes.
 * Never inferred from flight status, cancellation, or correlated arrival/departure times.
 */
export function delaySeverity(minutes?: number): DelaySeverity {
  if (minutes === undefined || !Number.isSafeInteger(minutes) || minutes < 0) return 'Undetermined';
  if (minutes < 15) return 'None / Below threshold';
  if (minutes <= 60) return 'Minor';
  if (minutes <= 180) return 'Moderate';
  return 'Major';
}
