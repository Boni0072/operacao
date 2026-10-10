import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  CANDIDATE_BUCKETS,
  DEFAULT_TEXTS,
  findLogoUrl,
  loadTexts,
  removeLogoFiles,
  uploadLogo,
  writeTexts,
  type BrandTexts,
} from '@/lib/branding';

interface BrandingContextValue {
  name: string;
  subtitle: string;
  logoUrl: string | null;
  saveLogo: (file: File) => Promise<void>;
  saveTexts: (texts: BrandTexts) => Promise<void>;
  restoreDefaults: () => Promise<void>;
}

const BrandingContext = createContext<BrandingContextValue | undefined>(undefined);

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [name, setName] = useState(DEFAULT_TEXTS.name);
  const [subtitle, setSubtitle] = useState(DEFAULT_TEXTS.subtitle);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [url, texts] = await Promise.all([findLogoUrl(), loadTexts()]);
    setLogoUrl(url);
    setName(texts.name);
    setSubtitle(texts.subtitle);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const saveLogo = useCallback(async (file: File) => {
    await uploadLogo(file);
    setLogoUrl(await findLogoUrl());
  }, []);

  const saveTexts = useCallback(async (texts: BrandTexts) => {
    await writeTexts(texts);
    setName(texts.name);
    setSubtitle(texts.subtitle);
  }, []);

  const restoreDefaults = useCallback(async () => {
    for (const bucket of CANDIDATE_BUCKETS) {
      await removeLogoFiles(bucket);
    }
    await writeTexts(DEFAULT_TEXTS);
    setLogoUrl(null);
    setName(DEFAULT_TEXTS.name);
    setSubtitle(DEFAULT_TEXTS.subtitle);
  }, []);

  return (
    <BrandingContext.Provider value={{ name, subtitle, logoUrl, saveLogo, saveTexts, restoreDefaults }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding(): BrandingContextValue {
  const ctx = useContext(BrandingContext);
  if (!ctx) throw new Error('useBranding must be used within BrandingProvider');
  return ctx;
}
