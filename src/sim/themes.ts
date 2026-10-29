import { THEME_SEGMENT } from './constants';
import { THEME_ORDER, type ThemeId } from './types';

export const THEME_NAMES: Record<ThemeId, string> = {
  lucknow: 'Lucknow Streets',
  heritage: 'Heritage Route',
  modern: 'Vikas Corridor',
  festival: 'Festival Route',
};

export function themeIndexAt(startTheme: ThemeId, s: number): number {
  const start = THEME_ORDER.indexOf(startTheme);
  return (start + Math.floor(Math.max(0, s) / THEME_SEGMENT)) % THEME_ORDER.length;
}

export function themeAt(startTheme: ThemeId, s: number): ThemeId {
  return THEME_ORDER[themeIndexAt(startTheme, s)];
}
