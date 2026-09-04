'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Composer } from './composers';

export type Language = 'zh' | 'en';

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  text: (zh: string, en: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);
const LANGUAGE_KEY = 'musicup-language';

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('zh');

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('lang');
    const saved = window.localStorage.getItem(LANGUAGE_KEY);
    const detected = navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
    setLanguageState(requested === 'en' || requested === 'zh' ? requested : saved === 'en' || saved === 'zh' ? saved : detected);
  }, []);

  const setLanguage = (next: Language) => {
    setLanguageState(next);
    window.localStorage.setItem(LANGUAGE_KEY, next);
    const url = new URL(window.location.href);
    url.searchParams.set('lang', next);
    window.history.replaceState({}, '', url);
  };

  useEffect(() => {
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
    document.title = language === 'zh'
      ? '大师对位 · MusiCup｜古典作曲家世界杯'
      : 'MusiCup · Classical Composer World Cup';
  }, [language]);

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    setLanguage,
    text: (zh, en) => language === 'zh' ? zh : en,
  }), [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used inside LanguageProvider');
  return context;
}

const regionMap: Record<string, string> = {
  '意大利': 'Italy', '法国': 'France', '英国': 'United Kingdom', '英格兰': 'England',
  '奥地利': 'Austria', '德国': 'Germany', '德意志地区': 'German-speaking lands',
  '俄罗斯': 'Russia', '美国': 'United States', '捷克': 'Czech lands', '芬兰': 'Finland',
  '挪威': 'Norway', '西班牙': 'Spain', '波兰': 'Poland', '日本': 'Japan', '匈牙利': 'Hungary',
  '意大利／法国': 'Italy / France', '意大利／奥地利': 'Italy / Austria',
  '意大利／西班牙': 'Italy / Spain', '德意志／英国': 'Germany / Britain',
  '德意志／奥地利': 'Germany / Austria', '德国／法国': 'Germany / France',
  '波兰／法国': 'Poland / France', '俄罗斯／美国': 'Russia / United States',
  '奥地利／波希米亚': 'Austria / Bohemia', '奥地利／美国': 'Austria / United States',
  '比利时／法国': 'Belgium / France', '捷克／波希米亚': 'Czech lands / Bohemia',
  '俄罗斯／法国／美国': 'Russia / France / United States',
  '俄罗斯／苏联': 'Russia / Soviet Union', '苏联／俄罗斯': 'Soviet Union / Russia',
  '匈牙利／美国': 'Hungary / United States',
  '匈牙利／德语文化圈': 'Hungary / German-speaking Europe',
  '德意志／奥地利／法国': 'Germany / Austria / France',
  '法兰德斯乐派／法国—低地国家': 'Franco-Flemish / France–Low Countries',
};

const periodMap: Record<string, string> = {
  '文艺复兴': 'Renaissance', '巴洛克': 'Baroque', '古典主义': 'Classical',
  '早期浪漫主义': 'Early Romantic', '浪漫主义': 'Romantic',
  '晚期浪漫主义': 'Late Romantic', '中晚期浪漫主义': 'Mid-to-late Romantic',
  '中晚期浪漫主义与民族乐派': 'Mid-to-late Romantic & Nationalist',
  '印象主义与现代主义早期': 'Impressionism & early Modernism',
  '20世纪与现代': '20th century & Modern',
  '巴洛克—古典主义过渡': 'Transition from Baroque to Classical',
  '古典主义—浪漫主义过渡': 'Transition from Classical to Romantic',
  '晚期浪漫主义—现代主义过渡': 'Transition from Late Romanticism to Modernism',
};

export const composerRegion = (composer: Composer, language: Language) =>
  language === 'zh' ? composer.region : regionMap[composer.region] || composer.region;

export const composerPeriod = (composer: Composer, language: Language) =>
  language === 'zh' ? composer.period : periodMap[composer.period] || composer.period;

export const composerBio = (composer: Composer, language: Language) => {
  if (language === 'zh') return composer.bio;
  const works = composer.works.map((work) => work.nameEn).join(', ').replace(/, ([^,]*)$/, ', and $1');
  return `A ${composerPeriod(composer, language)} composer associated with ${composerRegion(composer, language)}, represented here by ${works}.`;
};

export const composerYears = (composer: Composer, language: Language) =>
  language === 'zh' ? composer.years : composer.years.replace(/^约/, 'c. ');

