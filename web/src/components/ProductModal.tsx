import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ApiError } from '../api/client';
import type { Product, ProductInput } from '../api/types';
import { IMAGE_TYPES, resolveImageUrl, validateImageFile } from '../lib/image';
import { Modal } from './ui';

export interface ImageChange {
  file: File | null;
  remove: boolean;
}

const NEW_CATEGORY = '__new__';

interface Props {
  product?: Product;
  categories: string[];
  onSubmit: (input: ProductInput, image: ImageChange) => Promise<void>;
  onClose: () => void;
}

export function ProductModal({ product, categories, onSubmit, onClose }: Props) {
  const [form, setForm] = useState({
    name: product?.name ?? '',
    description: product?.description ?? '',
    price: product ? String(product.price) : '',
    category: product?.category ?? categories[0] ?? NEW_CATEGORY,
    newCategory: '',
  });
  const [file, setFile] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const currentImage = removeImage ? null : product?.imageUrl ? resolveImageUrl(product.imageUrl) : null;
  const shownImage = preview ?? currentImage;

  function pickFile(picked: File | undefined) {
    if (!picked) return;
    const problem = validateImageFile(picked);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setFile(picked);
    setRemoveImage(false);
  }

  // Reusing existing categories keeps the catalog consistent ("Velas" vs "velas"); a new one can
  // still be typed. The product's own category is included in case it was filtered out of the list.
  const options = [...new Set([...categories, ...(product ? [product.category] : [])])].sort((a, b) =>
    a.localeCompare(b, 'pt-BR'),
  );
  const creatingCategory = form.category === NEW_CATEGORY;

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setFieldErrors({});
    try {
      await onSubmit({
        name: form.name,
        description: form.description,
        price: Number(form.price.replace(',', '.')),
        category: creatingCategory ? form.newCategory : form.category,
      }, { file, remove: removeImage });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(err.details ?? {});
      } else {
        setError('Erro inesperado');
      }
      setSaving(false);
    }
  }

  const fieldError = (key: string) => fieldErrors[key]?.[0];

  return (
    <Modal title={product ? 'Editar produto' : 'Novo produto'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="form">
        <label className="field">
          <span>Nome</span>
          <input value={form.name} onChange={set('name')} required maxLength={120} autoFocus />
          {fieldError('name') && <small className="field-error">{fieldError('name')}</small>}
        </label>
        <label className="field">
          <span>Descrição</span>
          <textarea value={form.description} onChange={set('description')} required maxLength={2000} rows={3} />
        </label>
        <div className="grid-2">
          <label className="field">
            <span>Preço (R$)</span>
            <input value={form.price} onChange={set('price')} required inputMode="decimal" placeholder="0,00" />
            {fieldError('price') && <small className="field-error">{fieldError('price')}</small>}
          </label>
          <label className="field">
            <span>Categoria</span>
            <select value={form.category} onChange={set('category')} required>
              {options.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              <option value={NEW_CATEGORY}>+ Nova categoria…</option>
            </select>
          </label>
        </div>
        <div className="field">
          <span>Imagem (opcional)</span>
          <div className="image-field">
            <div className="image-preview" aria-hidden={!shownImage}>
              {shownImage ? <img src={shownImage} alt="Pré-visualização" /> : <span className="muted">Sem imagem</span>}
            </div>
            <div className="row-gap">
              <label className="btn btn-ghost file-btn">
                Escolher arquivo
                <input
                  type="file"
                  accept={IMAGE_TYPES.join(',')}
                  aria-label="Arquivo de imagem"
                  onChange={(e) => {
                    pickFile(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
              </label>
              {(shownImage || product?.imageUrl) && !removeImage && (
                <button
                  type="button"
                  className="btn btn-ghost danger"
                  onClick={() => {
                    setFile(null);
                    setRemoveImage(true);
                  }}
                >
                  Remover
                </button>
              )}
            </div>
          </div>
          <small className="muted">PNG, JPEG ou WebP, até 2 MB.</small>
        </div>
        {creatingCategory && (
          <label className="field">
            <span>Nome da nova categoria</span>
            <input
              value={form.newCategory}
              onChange={set('newCategory')}
              required
              maxLength={60}
              autoFocus
            />
          </label>
        )}
        {error && <div className="alert" role="alert">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
