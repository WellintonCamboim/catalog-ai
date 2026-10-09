import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '../api/types';
import { ProductModal } from './ProductModal';

const product: Product = {
  id: 'p1',
  name: 'Vela',
  description: 'Aroma suave',
  price: 10,
  category: 'Velas',
  imageUrl: '/uploads/c1/a.png',
};

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  URL.revokeObjectURL = vi.fn();
});

const png = (size = 10, type = 'image/png') =>
  new File([new Uint8Array(size)], 'foto.png', { type });

describe('ProductModal image field', () => {
  it('submits the chosen file together with the product data', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ProductModal product={product} onSubmit={onSubmit} onClose={() => {}} />);

    const file = png();
    await user.upload(screen.getByLabelText('Arquivo de imagem'), file);
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(onSubmit).toHaveBeenCalledOnce();
    const [input, image] = onSubmit.mock.calls[0];
    expect(input).not.toHaveProperty('imageUrl');
    expect(image).toEqual({ file, remove: false });
  });

  it('rejects unsupported types and files over 2 MB before sending anything', async () => {
    const user = userEvent.setup({ applyAccept: false });
    const onSubmit = vi.fn();
    render(<ProductModal onSubmit={onSubmit} onClose={() => {}} />);
    const input = screen.getByLabelText('Arquivo de imagem');

    await user.upload(input, png(10, 'image/svg+xml'));
    expect(await screen.findByRole('alert')).toHaveTextContent('PNG, JPEG ou WebP');

    await user.upload(input, png(2 * 1024 * 1024 + 1));
    expect(screen.getByRole('alert')).toHaveTextContent('2 MB');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('flags the removal of the current image and never resends the /uploads path as a URL', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ProductModal product={product} onSubmit={onSubmit} onClose={() => {}} />);

    await user.click(screen.getByRole('button', { name: 'Remover' }));
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    const [input, image] = onSubmit.mock.calls[0];
    expect(input).not.toHaveProperty('imageUrl');
    expect(image).toEqual({ file: null, remove: true });
  });
});
