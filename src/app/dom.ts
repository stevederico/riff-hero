const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const STAR_PATH = 'M12 1.8l3.1 6.5 7.1.9-5.2 4.9 1.3 7-6.3-3.4-6.3 3.4 1.3-7L1.8 9.2l7.1-.9z';

type ElementClass<T extends Element> = new () => T;

/** Find an element by id and check its type. Throws when the page is missing it. */
export function byId<T extends Element>(id: string, type: ElementClass<T>): T {
  const element = document.getElementById(id);
  if (!(element instanceof type)) throw new Error(`Missing element #${id}`);
  return element;
}

/** Create an element with a class and text. */
export function make<K extends keyof HTMLElementTagNameMap>(
  tag: K, className = '', text = '',
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

/** A star icon. */
export function makeStar(isEarned: boolean, index = 0): SVGSVGElement {
  const svg = document.createElementNS(SVG_NAMESPACE, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  if (isEarned) {
    svg.classList.add('is-earned');
    svg.style.animationDelay = `${index * 0.12}s`;
  }
  const path = document.createElementNS(SVG_NAMESPACE, 'path');
  path.setAttribute('d', STAR_PATH);
  svg.append(path);
  return svg;
}

/** Whole number with thousands separators. */
export function formatNumber(value: number): string {
  return Math.round(value).toLocaleString('en-US');
}

/** Seconds as m:ss. */
export function formatDuration(seconds: number): string {
  const SECONDS_PER_MINUTE = 60;
  const whole = Math.round(seconds);
  const rest = String(whole % SECONDS_PER_MINUTE).padStart(2, '0');
  return `${Math.floor(whole / SECONDS_PER_MINUTE)}:${rest}`;
}
