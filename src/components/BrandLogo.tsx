import { ChangeEvent, useEffect, useState } from 'react';
import { HardHat, Pencil, Trash2, Upload } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useBranding } from '@/context/BrandingContext';
import { Modal, Button, Input } from '@/components/ui';
import { ALLOWED_LOGO_TYPES, DEFAULT_TEXTS, MAX_LOGO_BYTES } from '@/lib/branding';

export function BrandLogo({ variant = 'md', fluid = false }: { variant?: 'md' | 'sm'; fluid?: boolean }) {
  const { profile } = useAuth();
  const canEdit = profile?.role === 'admin';
  const { name, subtitle, logoUrl, saveLogo, saveTexts, restoreDefaults } = useBranding();

  const [imgFailed, setImgFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [draftName, setDraftName] = useState(name);
  const [draftSubtitle, setDraftSubtitle] = useState(subtitle);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  /* logo trocado/removido => tenta exibir a nova imagem */
  useEffect(() => {
    setImgFailed(false);
  }, [logoUrl]);

  const boxSize = variant === 'sm' ? 'h-8 w-8 rounded-lg' : 'h-10 w-10 rounded-xl';
  const iconSize = variant === 'sm' ? 18 : 22;
  const hasCustomLogo = Boolean(logoUrl) && !imgFailed;

  const closeEditor = () => {
    if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    setOpen(false);
    setPreviewUrl(null);
    setSelectedFile(null);
    setError('');
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setError('');
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
      setError('Formato inválido. Use JPG, PNG ou WebP.');
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setError('A imagem deve ter no máximo 2 MB.');
      return;
    }
    if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    const nextName = draftName.trim();
    if (!nextName) {
      setError('Informe um nome para exibir no menu.');
      return;
    }
    const textsChanged = nextName !== name || draftSubtitle !== subtitle;
    if (!selectedFile && !textsChanged) {
      closeEditor();
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (selectedFile) await saveLogo(selectedFile);
      if (textsChanged) await saveTexts({ name: nextName, subtitle: draftSubtitle });
      closeEditor();
    } catch (err) {
      const detail = err instanceof Error ? err.message : '';
      setError(
        detail
          ? `Não foi possível salvar. Detalhe: ${detail}`
          : 'Não foi possível salvar. Apenas administradores podem alterar a marca.',
      );
    }
    setSaving(false);
  };

  const handleRestore = async () => {
    setSaving(true);
    setError('');
    try {
      await restoreDefaults();
      setDraftName(DEFAULT_TEXTS.name);
      setDraftSubtitle(DEFAULT_TEXTS.subtitle);
      closeEditor();
    } catch {
      setError('Não foi possível restaurar o padrão.');
    }
    setSaving(false);
  };

  /* `fluid`: imagem ocupa a largura toda e a altura acompanha a proporção */
  const containerClass = fluid
    ? `group relative w-full${hasCustomLogo ? '' : ' flex justify-center'}`
    : `group relative shrink-0 overflow-hidden bg-amber-500 text-white ${boxSize}`;

  return (
    <>
      <div className={containerClass}>
        {hasCustomLogo ? (
          <img
            src={logoUrl ?? ''}
            alt="Logo do sistema"
            className={
              fluid
                /* ocupa a largura toda; a altura segue a proporção da imagem */
                ? 'block h-auto w-full object-contain'
                : 'h-full w-full object-contain'
            }
            onError={() => setImgFailed(true)}
          />
        ) : fluid ? (
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-white">
            <HardHat size={22} />
          </span>
        ) : (
          <span className="flex h-full w-full items-center justify-center">
            <HardHat size={iconSize} />
          </span>
        )}
        {canEdit && (
          <button
            type="button"
            onClick={() => { setError(''); setPreviewUrl(null); setSelectedFile(null); setDraftName(name); setDraftSubtitle(subtitle); setOpen(true); }}
            title="Editar marca"
            aria-label="Editar marca"
            className="absolute inset-0 flex items-center justify-center bg-slate-900/55 text-white opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
          >
            <Pencil size={Math.max(14, Math.round(iconSize * 0.7))} />
          </button>
        )}
      </div>

      {canEdit && (
        <Modal open={open} onClose={closeEditor} title="Editar marca do sistema" size="sm">
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-4">
              <div className="flex w-48 items-center justify-center overflow-hidden rounded-xl bg-white ring-1 ring-slate-200 dark:ring-slate-700">
                {previewUrl ? (
                  <img src={previewUrl} alt="Pré-visualização" className="block h-auto w-full object-contain" />
                ) : hasCustomLogo ? (
                  <img src={logoUrl ?? ''} alt="Logo atual" className="block h-auto w-full object-contain" />
                ) : (
                  <span className="my-4 flex h-20 w-20 items-center justify-center rounded-xl bg-amber-500 text-white">
                    <HardHat size={32} />
                  </span>
                )}
              </div>
              <div className="min-w-0 space-y-2 text-center">
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  {previewUrl
                    ? 'Nova imagem selecionada'
                    : hasCustomLogo
                      ? 'Logo personalizado'
                      : 'Logo padrão do sistema'}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500">JPG, PNG ou WebP de até 2 MB.</p>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
                  <Upload size={16} />
                  {previewUrl ? 'Trocar imagem' : 'Escolher imagem'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            <div className="space-y-3">
              <Input label="Nome" value={draftName} onChange={setDraftName} placeholder="FieldControl" required />
              <Input
                label="Descrição"
                value={draftSubtitle}
                onChange={setDraftSubtitle}
                placeholder="Controle de campo"
              />
            </div>

            {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button variant="ghost" onClick={handleRestore} disabled={saving}>
                <Trash2 size={16} /> Restaurar padrão
              </Button>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={closeEditor} disabled={saving}>
                  Cancelar
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? 'Salvando…' : 'Salvar'}
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
