import { supabase } from '@/lib/supabase';

/* Ordem de preferência: `branding` (migration própria) e, enquanto ele não
   existir, `receipts` — bucket público que já está em uso no projeto. */
export const PREFERRED_BUCKET = 'branding';
export const FALLBACK_BUCKET = 'receipts';
export const CANDIDATE_BUCKETS = [PREFERRED_BUCKET, FALLBACK_BUCKET];
export const FOLDER = 'app';
export const SETTINGS_FILE = `${FOLDER}/settings.json`;
export const MAX_LOGO_BYTES = 2 * 1024 * 1024;
export const ALLOWED_LOGO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const EXTENSION_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const LOGO_PREFIX = 'logo';

export interface BrandTexts {
  name: string;
  subtitle: string;
}

export const DEFAULT_TEXTS: BrandTexts = {
  name: 'FieldControl',
  subtitle: 'Controle de campo',
};

export function isMissingBucket(message: string): boolean {
  return /bucket not found|nosuchbucket/i.test(message);
}

export async function findLogoUrl(): Promise<string | null> {
  for (const bucket of CANDIDATE_BUCKETS) {
    const { data, error } = await supabase.storage.from(bucket).list(FOLDER);
    if (error || !data) continue;
    const logo = data.find((entry) => entry.name.startsWith(LOGO_PREFIX));
    if (!logo) continue;
    const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(`${FOLDER}/${logo.name}`);
    const stamp = String(logo.updated_at ?? logo.created_at ?? Date.now());
    return `${publicData.publicUrl}?t=${encodeURIComponent(stamp)}`;
  }
  return null;
}

export async function removeLogoFiles(bucket: string, keepPath?: string): Promise<void> {
  const { data, error } = await supabase.storage.from(bucket).list(FOLDER);
  if (error || !data) return;
  const files = data
    .filter((entry) => entry.name.startsWith(LOGO_PREFIX))
    .map((entry) => `${FOLDER}/${entry.name}`)
    .filter((path) => path !== keepPath);
  if (files.length > 0) {
    await supabase.storage.from(bucket).remove(files);
  }
}

export async function uploadLogo(file: File): Promise<void> {
  const extension = EXTENSION_BY_TYPE[file.type] ?? 'png';
  const path = `${FOLDER}/${LOGO_PREFIX}.${extension}`;
  let lastError: Error | null = null;

  for (const bucket of CANDIDATE_BUCKETS) {
    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, file, { upsert: true, contentType: file.type });
    if (!error) {
      /* limpa logos antigos gravados em outro bucket ou com outra extensão */
      for (const other of CANDIDATE_BUCKETS) {
        await removeLogoFiles(other, other === bucket ? path : undefined);
      }
      return;
    }
    lastError = error;
    /* só tenta o bucket seguinte se ele não existir; permissão/tamanho/tipo
       são erros reais e devem ser mostrados ao usuário */
    if (!isMissingBucket(error.message)) throw error;
  }

  throw lastError ?? new Error('Não foi possível enviar a imagem');
}

export async function loadTexts(): Promise<BrandTexts> {
  for (const bucket of CANDIDATE_BUCKETS) {
    const { data, error } = await supabase.storage.from(bucket).download(SETTINGS_FILE);
    if (error || !data) continue;
    try {
      const parsed = JSON.parse(await data.text()) as Partial<BrandTexts>;
      const name = typeof parsed.name === 'string' ? parsed.name.trim() : '';
      return {
        name: name || DEFAULT_TEXTS.name,
        subtitle: typeof parsed.subtitle === 'string' ? parsed.subtitle : DEFAULT_TEXTS.subtitle,
      };
    } catch {
      /* arquivo inválido: tenta o próximo bucket */
    }
  }
  return DEFAULT_TEXTS;
}

export async function writeTexts(texts: BrandTexts): Promise<void> {
  const blob = new Blob([JSON.stringify(texts, null, 2)], { type: 'application/json' });
  let lastError: Error | null = null;

  for (const bucket of CANDIDATE_BUCKETS) {
    const { error } = await supabase.storage.from(bucket).upload(SETTINGS_FILE, blob, {
      upsert: true,
      contentType: 'application/json',
    });
    if (!error) return;
    lastError = error;
  }

  throw lastError ?? new Error('Não foi possível salvar os textos');
}
