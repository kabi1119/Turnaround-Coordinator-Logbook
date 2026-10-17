import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Radar from '../src/components/Radar';
import { readFileSync } from 'node:fs';
const tokens = readFileSync('src/styles/tokens.css', 'utf8');
const radar = readFileSync('src/styles/radar.css', 'utf8');
const responsive = readFileSync('src/styles/responsive.css', 'utf8');
const base = readFileSync('src/styles.css', 'utf8');

function isStyle(rule: CSSRule): rule is CSSStyleRule {
  return rule.type === CSSRule.STYLE_RULE;
}
function isMedia(rule: CSSRule): rule is CSSMediaRule {
  return rule.type === CSSRule.MEDIA_RULE;
}
function condition(rule: CSSMediaRule) {
  return rule.conditionText || rule.media.mediaText;
}
// Parse the shipped CSS rather than duplicating its palette in a test fixture.
function rules(css: string) {
  const el = document.createElement('style');
  el.textContent = css;
  document.head.appendChild(el);
  const result = [...el.sheet!.cssRules];
  el.remove();
  return result;
}
function declarations(rule: CSSStyleRule) {
  const value: Record<string, string> = {};
  for (let i = 0; i < rule.style.length; i++) {
    const name = rule.style[i];
    value[name] = rule.style.getPropertyValue(name).trim();
  }
  return value;
}
const tokenRules = rules(tokens);
function theme(dark = false) {
  const values: Record<string, string> = {};
  for (const rule of tokenRules) {
    if (isStyle(rule) && rule.selectorText === ':root') Object.assign(values, declarations(rule));
    if (dark && isMedia(rule) && condition(rule) === '(prefers-color-scheme: dark)')
      for (const child of rule.cssRules) Object.assign(values, declarations(child as CSSStyleRule));
  }
  return values;
}
function resolve(value: string, values: Record<string, string>): string {
  if (value.startsWith('var(')) return resolve(values[value.slice(4, -1)], values);
  return value;
}
function contrast(fg: string, bg: string) {
  const luminance = (hex: string) => {
    const rgb = hex
      .replace('#', '')
      .match(/.{2}/g)!
      .map((channel) => {
        const c = parseInt(channel, 16) / 255;
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
    return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  };
  const a = luminance(fg),
    b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
describe('Shipped text contrast roles', () => {
  it.each([false, true])(
    'Selected-hover and disabled button colors survive the stylesheet cascade (dark=%s)',
    (dark) => {
      const values = theme(dark);
      // jsdom cannot resolve CSS custom properties or emulate :hover. Substitute the actual
      // palette and a test state class, while preserving the shipped rule order/selectors.
      const css = base
        .replace(/var\((--[\w-]+)\)/g, (_, key: string) => resolve(values[key], values))
        .replace(/:hover/g, '.test-hover');
      const { container } = render(
        <>
          <style>{css}</style>
          <div className="segmented">
            <button className="selected test-hover">Timeline</button>
          </div>
          <div className="calendar-grid">
            <button className="active test-hover">16</button>
          </div>
          <button disabled className="primary test-hover">
            Unavailable
          </button>
        </>,
      );
      const rgb = (hex: string) =>
        `rgb(${hex
          .slice(1)
          .match(/../g)!
          .map((c) => parseInt(c, 16))
          .join(', ')})`;
      const buttons = container.querySelectorAll('button');
      for (const button of [buttons[0], buttons[1]]) {
        const style = getComputedStyle(button);
        expect(style.color).toBe(rgb(values['--on-action']));
        expect(style.backgroundColor).toBe(rgb(values['--action-hover']));
      }
      const disabled = getComputedStyle(buttons[2]);
      expect(disabled.color).toBe(rgb(values['--disabled-fg']));
      expect(disabled.backgroundColor).toBe(rgb(values['--disabled-bg']));
      expect(disabled.opacity).toBe('1');
    },
  );
  it.each([false, true])(
    'AA normal text in system dark=%s, including normal/selected/disabled/action states',
    (dark) => {
      const values = theme(dark);
      const pairs: [string, string][] = [];
      for (const foreground of ['--text', '--muted', '--teal', '--gold'])
        for (const surface of ['--bg', '--panel', '--teal-light'])
          pairs.push([foreground, surface]);
      pairs.push(['--amber', '--amber-bg'], ['--disabled-fg', '--disabled-bg']);
      for (const action of ['--action-bg', '--action-hover', '--action-active'])
        pairs.push(['--on-action', action]);
      for (const [fg, bg] of pairs)
        expect(
          contrast(resolve(values[fg], values), resolve(values[bg], values)),
          `${dark ? 'dark' : 'light'} ${fg} / ${bg}`,
        ).toBeGreaterThanOrEqual(4.5);
    },
  );
  it('Dark surface primary/secondary/muted/accent all exceed AA in default, raised and hover contexts', () => {
    const values = theme();
    for (const fg of [
      '--on-dark-primary',
      '--on-dark-secondary',
      '--on-dark-muted',
      '--on-dark-accent',
    ])
      for (const bg of ['--dark-surface', '--dark-raised', '--dark-hover'])
        expect(contrast(values[fg], values[bg]), `${fg} / ${bg}`).toBeGreaterThanOrEqual(4.5);
    const darkContext = tokenRules.find(
      (r) => isStyle(r) && r.selectorText === '.surface-dark',
    ) as CSSStyleRule;
    expect(declarations(darkContext)['--text']).toBe('var(--on-dark-primary)');
    const root = rules(base).find((r) => isStyle(r) && r.selectorText === ':root') as CSSStyleRule;
    expect(declarations(root).color).toBe('var(--text)');
  });
  it('Focus indicators reach 3:1 against their light/dark surfaces', () => {
    for (const dark of [false, true]) {
      const values = theme(dark);
      for (const bg of ['--bg', '--panel', '--teal-light'])
        expect(contrast(values['--focus'], values[bg])).toBeGreaterThanOrEqual(3);
    }
    expect(contrast(theme()['--on-dark-focus'], theme()['--dark-surface'])).toBeGreaterThanOrEqual(
      3,
    );
  });
});
describe('Radar and responsive accessibility contracts (not a real layout engine)', () => {
  it('Radar is decorative, clipped, and keeps the aircraft outside the independently rotating sweep', () => {
    const { container } = render(<Radar />);
    const visual = container.querySelector('.flight-visual')!,
      sweep = container.querySelector('.radar-sweep')!;
    expect(visual).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelectorAll('button,a,input')).toHaveLength(0);
    expect(sweep.querySelector('.radar-trail')).not.toBeNull();
    expect(sweep.querySelector('.radar-beam')).not.toBeNull();
    expect(sweep.querySelector('.hero-plane')).toBeNull();
    expect(sweep.querySelector('.radar-ring')).toBeNull();
    const css = rules(radar);
    const motion = css.find(
      (r) => isMedia(r) && condition(r as CSSMediaRule) === '(prefers-reduced-motion: reduce)',
    ) as CSSMediaRule;
    expect(declarations(motion.cssRules[0] as CSSStyleRule).animation).toBe('none');
    expect(radar).toContain('conic-gradient(');
    expect(radar).toContain('radar-scan 6s linear infinite');
  });
  it('Each requested width has exactly one applicable mobile/tablet/desktop CSS presentation', () => {
    const media = rules(responsive)
      .filter((r) => isMedia(r))
      .map((r) => condition(r as CSSMediaRule));
    const presentations = media.filter(
      (text) =>
        text.includes('1023px') ||
        text === 'screen and (min-width:1024px)' ||
        text === 'screen and (min-width: 1024px)' ||
        text === 'screen and (max-width:767px)' ||
        text === 'screen and (max-width: 767px)',
    );
    for (const width of [375, 390, 430, 768, 1024, 1440, 1920]) {
      const matching = presentations.filter((condition) => {
        const min = condition.match(/min-width:\s*(\d+)px/),
          max = condition.match(/max-width:\s*(\d+)px/);
        return (!min || width >= Number(min[1])) && (!max || width <= Number(max[1]));
      });
      expect(matching, `presentation at ${width}px`).toHaveLength(1);
    }
  });
});
