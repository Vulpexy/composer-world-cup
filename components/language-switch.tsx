'use client';

import { Languages } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';

export function LanguageSwitch({ compact = false }: { compact?: boolean }) {
  const { language, setLanguage } = useLanguage();
  return (
    <div className={`language-switch ${compact ? 'is-compact' : ''}`} role="group" aria-label="Language">
      <Languages aria-hidden="true" />
      <button type="button" className={language === 'zh' ? 'active' : ''} onClick={() => setLanguage('zh')} aria-pressed={language === 'zh'}>中文</button>
      <span>/</span>
      <button type="button" className={language === 'en' ? 'active' : ''} onClick={() => setLanguage('en')} aria-pressed={language === 'en'}>EN</button>
    </div>
  );
}

