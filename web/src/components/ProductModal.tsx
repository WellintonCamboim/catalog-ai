import { useState, type FormEvent } from 'react';
import { ApiError } from '../api/client';
import type { Product, ProductInput } from '../api/types';
import { Modal } from './ui';

interface Props {
  product?: Product;
  onSubmit: (input: ProductInput) => Promise<void>;
  onClose: () => void;
}

export function ProductModal({ product, onSubmit, onClose }: Props) {
  const [form, setForm] = useState({
    name: product?.name ?? '',
    description: product?.description ?? '',
    price: product ? String(product.price) : '',
    category: product?.category ?? '',
    imageUrl: product?.imageUrl ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

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
        category: form.category,
        ...(form.imageUrl.trim() && { imageUrl: form.imageUrl.trim() }),
      });
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
            <input value={form.category} onChange={set('category')} required maxLength={60} />
          </label>
        </div>
        <label className="field">
          <span>URL da imagem (opcional)</span>
          <input value={form.imageUrl} onChange={set('imageUrl')} type="url" placeholder="https://..." />
          {fieldError('imageUrl') && <small className="field-error">{fieldError('imageUrl')}</small>}
        </label>
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
