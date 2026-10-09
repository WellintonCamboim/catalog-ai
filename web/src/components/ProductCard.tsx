import { useState } from 'react';
import type { Product } from '../api/types';
import { formatPrice } from '../lib/format';
import { resolveImageUrl } from '../lib/image';
import { Icon } from './ui';

interface Props {
  product: Product;
  canEdit: boolean;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
}

export function ProductCard({ product, canEdit, onEdit, onDelete }: Props) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = product.imageUrl && !imageFailed;

  return (
    <article className="card product">
      <div className="product-media">
        {showImage ? (
          <img src={resolveImageUrl(product.imageUrl)} alt={product.name} loading="lazy" onError={() => setImageFailed(true)} />
        ) : (
          <div className="product-fallback" aria-hidden="true">
            {product.name.charAt(0).toUpperCase()}
          </div>
        )}
        <span className="chip">{product.category}</span>
      </div>
      <div className="product-body">
        <h3>{product.name}</h3>
        <p className="muted clamp-3">{product.description}</p>
        <div className="product-foot">
          <strong className="price">{formatPrice(product.price)}</strong>
          {canEdit && (
            <div className="row-gap">
              <button className="btn btn-icon btn-ghost" onClick={() => onEdit(product)} aria-label={`Editar ${product.name}`}>
                <Icon name="edit" />
              </button>
              <button className="btn btn-icon btn-ghost danger" onClick={() => onDelete(product)} aria-label={`Excluir ${product.name}`}>
                <Icon name="trash" />
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
