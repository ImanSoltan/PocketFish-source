import fs from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { LANGUAGES, detectLanguage, language, setLanguage, t } from '../../src/i18n';
import { de } from '../../src/i18n/de';
import { en } from '../../src/i18n/en';
import { es } from '../../src/i18n/es';
import { fr } from '../../src/i18n/fr';
import { rich } from '../../src/i18n/rich';
import { parseFen, validate } from '../../src/chess/position';

const TRANSLATIONS = { de, es, fr } as const;
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const markup = (s: string) => [...s.matchAll(/<\/?[bmvk]>/g)].map((m) => m[0]).join('');

afterEach(() => {
  setLanguage('en');
});

describe('translations', () => {
  for (const [lang, messages] of Object.entries(TRANSLATIONS)) {
    describe(lang, () => {
      it('has exactly the English keys', () => {
        expect(Object.keys(messages).sort()).toEqual(Object.keys(en).sort());
      });

      it('keeps every {placeholder} and every <b>/<m>/<v>/<k> tag', () => {
        for (const [key, text] of Object.entries(en)) {
          const translated = messages[key as keyof typeof en];
          expect(placeholders(translated), key).toEqual(placeholders(text));
          expect(markup(translated), key).toEqual(markup(text));
        }
      });

      it('has no empty or untrimmed texts', () => {
        for (const [key, text] of Object.entries(messages)) {
          expect(text.trim(), key).not.toBe('');
          expect(text, key).toBe(text.trim());
        }
      });
    });
  }

  it('French puts a non-breaking space before : ; ? and !', () => {
    for (const [key, text] of Object.entries(fr)) expect(text, key).not.toMatch(/ [:;?!]/);
  });

  it('the languages declared to iOS are the app’s languages', () => {
    const plist = fs.readFileSync('ios/App/App/Info.plist', 'utf8');
    const declared = /<key>CFBundleLocalizations<\/key>\s*<array>([\s\S]*?)<\/array>/.exec(plist)![1];
    expect([...declared.matchAll(/<string>(\w+)<\/string>/g)].map((m) => m[1]).sort()).toEqual([...LANGUAGES].sort());
    for (const lang of LANGUAGES) {
      const strings = fs.readFileSync(`ios/App/App/${lang}.lproj/InfoPlist.strings`, 'utf8');
      expect(strings).toContain('NSCameraUsageDescription = "');
    }
  });
});

describe('detectLanguage', () => {
  it('takes the first preferred language the app speaks', () => {
    expect(detectLanguage(['de-DE'])).toBe('de');
    expect(detectLanguage(['de-CH', 'en-US'])).toBe('de');
    expect(detectLanguage(['pt-BR', 'es-419', 'en'])).toBe('es');
    expect(detectLanguage(['fr_CA'])).toBe('fr');
    expect(detectLanguage(['EN-gb', 'de'])).toBe('en');
  });

  it('falls back to English', () => {
    expect(detectLanguage(['ja-JP', 'zh-Hans'])).toBe('en');
    expect(detectLanguage([])).toBe('en');
  });
});

describe('t', () => {
  it('fills in placeholders and leaves unknown ones', () => {
    expect(t('common.engineError', { error: 'oops' })).toBe('Engine error: oops');
    expect(t('common.engineError')).toBe('Engine error: {error}');
  });

  it('switches language', () => {
    expect(setLanguage('de')).toBe('de');
    expect(language()).toBe('de');
    expect(t('common.white')).toBe('Weiß');
    expect(t('common.engineError', { error: 'x' })).toBe('Engine-Fehler: x');
    setLanguage('fr');
    expect(t('common.engineError', { error: 'x' })).toBe('Erreur du moteur : x');
  });

  it('problems with a position come in the current language', () => {
    setLanguage('de');
    const problems = validate(parseFen('8/8/8/8/8/8/8/4k3 w - - 0 1')!).map((p) => p.message);
    expect(problems).toContain('Der weiße König fehlt');
  });
});

describe('rich', () => {
  it('turns <b>, <m> and <v> into elements', () => {
    expect(renderToStaticMarkup(rich('Streak <b>3</b> <m>(+0.5)</m> <v>Qh5</v>'))).toBe(
      'Streak <b>3</b> <span class="muted">(+0.5)</span> <span class="solve-move">Qh5</span>',
    );
  });

  it('turns <k> into a chip of an app button, with its icon', () => {
    expect(renderToStaticMarkup(rich('Tap <k>Board</k> twice', createElement('i', null, 'icon')))).toBe(
      'Tap <span class="ui-chip"><i>icon</i>Board</span> twice',
    );
  });

  it('leaves anything else as text', () => {
    expect(renderToStaticMarkup(rich('<i>x</i> <script>y</script>'))).toBe(
      '&lt;i&gt;x&lt;/i&gt; &lt;script&gt;y&lt;/script&gt;',
    );
  });
});
