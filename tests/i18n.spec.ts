import { describe, expect, it } from 'vitest';
import { createI18n } from 'vue-i18n';
import { describeRule, newGroup } from '@/options/filters';
import { de, en } from '@/i18n/messages';

const translator = (locale: 'en' | 'de') => {
  const i18n = createI18n({ legacy: false, locale, messages: { en, de } });
  return (key: string, named?: Record<string, unknown>) => i18n.global.t(key, named ?? {});
};

describe('describeRule', () => {
  it('should describe a rule tree in the chosen language', () => {
    const rule = { ...newGroup(), rules: [{ ...newGroup().rules[0], id: 'rated', operator: 'equal', value: 1, silent: true }] };

    expect(describeRule(rule, translator('en'))).toBe('All of:\n  • Rated equal Yes (declined silently)');
    expect(describeRule(rule, translator('de'))).toBe('Alle von:\n  • Gewertet gleich Ja (still abgelehnt)');
  });

  it('should translate placeholders', () => {
    expect(translator('de')('profile.copyOf', { name: 'A' })).toBe('A (Kopie)');
  });
});
