export function resolveLocalizedValue(value, locale, fallbackLocale = 'ja') {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return '';
  return value[locale] ?? value[fallbackLocale] ?? value.ja ?? Object.values(value).find(Boolean) ?? '';
}
