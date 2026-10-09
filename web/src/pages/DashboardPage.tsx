import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { productsApi } from '../api/endpoints';
import type { Product, ProductInput } from '../api/types';
import { useAuth } from '../auth/useAuth';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ProductCard } from '../components/ProductCard';
import { ProductModal } from '../components/ProductModal';
import { Icon, Spinner } from '../components/ui';

type Dialog = { type: 'create' } | { type: 'edit'; product: Product } | { type: 'delete'; product: Product } | null;

export function DashboardPage() {
  const { session } = useAuth();
  const isAdmin = session?.user.role === 'admin';
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => {
      setDebounced(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(id);
  }, [search]);

  const products = useQuery({
    queryKey: ['products', { q: debounced, category, page }],
    queryFn: () => productsApi.list({ q: debounced || undefined, category: category || undefined, page }),
    placeholderData: keepPreviousData,
  });
  const categories = useQuery({ queryKey: ['categories'], queryFn: productsApi.categories });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['products'] });
    queryClient.invalidateQueries({ queryKey: ['categories'] });
  };

  const save = useMutation({
    mutationFn: (input: ProductInput) =>
      dialog?.type === 'edit' ? productsApi.update(dialog.product.id, input) : productsApi.create(input),
    onSuccess: () => {
      refresh();
      setDialog(null);
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => productsApi.remove(id),
    onSuccess: () => {
      refresh();
      setDialog(null);
    },
  });

  async function copyInvite() {
    if (!session?.company.inviteCode) return;
    try {
      await navigator.clipboard.writeText(session.company.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable: the code is visible on screen anyway */
    }
  }

  const data = products.data;

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Produtos</h1>
          <p className="muted">
            {data ? `${data.total} ${data.total === 1 ? 'produto' : 'produtos'}` : ' '}
            {isAdmin ? '' : ' · modo de visualização'}
          </p>
        </div>
        {isAdmin && (
          <button className="btn btn-primary" onClick={() => setDialog({ type: 'create' })}>
            <Icon name="plus" /> Novo produto
          </button>
        )}
      </div>

      {isAdmin && session?.company.inviteCode && (
        <div className="card invite">
          <div>
            <strong>Convide sua equipe</strong>
            <p className="muted">Quem se cadastrar com este código entra na sua empresa com acesso de visualização.</p>
          </div>
          <button className="btn" onClick={copyInvite} title="Copiar código">
            <code>{session.company.inviteCode}</code>
            <Icon name="copy" size={16} /> {copied ? 'Copiado!' : 'Copiar'}
          </button>
        </div>
      )}

      <div className="filters">
        <label className="search">
          <Icon name="search" size={18} />
          <input
            type="search"
            placeholder="Buscar por nome ou descrição"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar produtos"
          />
        </label>
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setPage(1);
          }}
          aria-label="Filtrar por categoria"
        >
          <option value="">Todas as categorias</option>
          {categories.data?.items.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {products.isLoading && <Spinner />}
      {products.isError && (
        <div className="alert" role="alert">
          {products.error.message}{' '}
          <button className="link" onClick={() => products.refetch()}>
            Tentar novamente
          </button>
        </div>
      )}

      {data && data.items.length === 0 && (
        <div className="empty card">
          <Icon name="box" size={32} />
          <h3>Nenhum produto encontrado</h3>
          <p className="muted">
            {debounced || category
              ? 'Tente ajustar a busca ou o filtro.'
              : isAdmin
                ? 'Cadastre o primeiro produto para começar.'
                : 'Ainda não há produtos cadastrados.'}
          </p>
        </div>
      )}

      {data && data.items.length > 0 && (
        <div className={`grid ${products.isPlaceholderData ? 'is-stale' : ''}`}>
          {data.items.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              canEdit={isAdmin}
              onEdit={(product) => setDialog({ type: 'edit', product })}
              onDelete={(product) => setDialog({ type: 'delete', product })}
            />
          ))}
        </div>
      )}

      {data && data.totalPages > 1 && (
        <div className="pager">
          <button className="btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Anterior
          </button>
          <span className="muted">
            Página {data.page} de {data.totalPages}
          </span>
          <button className="btn" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>
            Próxima
          </button>
        </div>
      )}

      {(dialog?.type === 'create' || dialog?.type === 'edit') && (
        <ProductModal
          product={dialog.type === 'edit' ? dialog.product : undefined}
          onClose={() => setDialog(null)}
          onSubmit={(input) => save.mutateAsync(input).then(() => undefined)}
        />
      )}
      {dialog?.type === 'delete' && (
        <ConfirmDialog
          title="Excluir produto"
          message={`Tem certeza de que deseja excluir "${dialog.product.name}"? Essa ação não pode ser desfeita.`}
          confirmLabel="Excluir"
          onClose={() => setDialog(null)}
          onConfirm={() => remove.mutateAsync(dialog.product.id)}
        />
      )}
    </div>
  );
}
