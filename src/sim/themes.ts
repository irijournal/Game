import { THEME_SEGMENT } from './constants';
import { THEME_ORDER, type ThemeId, type TokenVariant } from './types';

export const THEME_NAMES: Record<ThemeId, string> = {
  expressway: 'Expressway',
  ayodhya: 'Ayodhya Heritage',
  airport: 'Airport',
  kisan: 'Kisan Fields',
  jankalyan: 'Jan Kalyan Town',
  lawandorder: 'Lucknow Streets',
  startup: 'Startup District',
  viksit: 'Viksit UP Skyline',
};

/** Fictionalised settings: inspired by, never documentary depictions of, real places. */
export const THEME_INSPIRATION: Record<ThemeId, string> = {
  expressway: 'Inspired by UP’s expressways (Agra skyline in the distance)',
  ayodhya: 'Inspired by Ayodhya’s festive ghats and temples',
  airport: 'Inspired by UP’s new airports',
  kisan: 'Inspired by the farmlands near Prayagraj',
  jankalyan: 'Inspired by the lanes and ghats of Varanasi',
  lawandorder: 'Inspired by the streets of Lucknow',
  startup: 'Inspired by Noida’s industrial and tech districts',
  viksit: 'An imagined, developed Uttar Pradesh of the future',
};

export const THEME_TOKEN: Record<ThemeId, TokenVariant> = {
  expressway: 'road',
  ayodhya: 'diya',
  airport: 'plane',
  kisan: 'wheat',
  jankalyan: 'welfare',
  lawandorder: 'shield',
  startup: 'gear',
  viksit: 'star',
};

export function themeIndexAt(startTheme: ThemeId, s: number): number {
  const start = THEME_ORDER.indexOf(startTheme);
  return (start + Math.floor(Math.max(0, s) / THEME_SEGMENT)) % THEME_ORDER.length;
}

export function themeAt(startTheme: ThemeId, s: number): ThemeId {
  return THEME_ORDER[themeIndexAt(startTheme, s)];
}
