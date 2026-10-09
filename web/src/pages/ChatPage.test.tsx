import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client';
import { streamChat } from '../api/chatStream';
import { makeSession, renderWithProviders } from '../test/helpers';
import { ChatPage } from './ChatPage';

vi.mock('../api/chatStream', () => ({ streamChat: vi.fn() }));
const streamChatMock = vi.mocked(streamChat);

const renderChat = () => renderWithProviders(<ChatPage />, { session: makeSession('user') });

// Braces matter: a function returned from beforeEach is run as a cleanup hook.
beforeEach(() => {
  streamChatMock.mockReset();
});

describe('ChatPage', () => {
  it('shows suggestions first and sends one as a message', async () => {
    streamChatMock.mockImplementation(async (_m, _h, handlers) => handlers.onText('Temos vários.'));
    renderChat();

    await userEvent.click(screen.getByRole('button', { name: 'Quais produtos vocês têm?' }));

    expect(await screen.findByText('Temos vários.')).toBeInTheDocument();
    expect(screen.getByText('Quais produtos vocês têm?')).toBeInTheDocument();
    expect(streamChatMock.mock.calls[0]![0]).toBe('Quais produtos vocês têm?');
  });

  it('streams the answer, shows the tool status and renders markdown', async () => {
    let finish!: () => void;
    streamChatMock.mockImplementation(
      (_m, _h, handlers) =>
        new Promise<void>((resolve) => {
          handlers.onTool('search_products');
          finish = () => {
            handlers.onText('Preço: **R$ 49,90**');
            resolve();
          };
        }),
    );
    renderChat();

    await userEvent.type(screen.getByLabelText('Mensagem'), 'vela{Enter}');
    expect(await screen.findByText('Consultando o catálogo…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Parar' })).toBeInTheDocument();

    finish();
    const bold = await screen.findByText('R$ 49,90');
    expect(bold.tagName).toBe('STRONG');
    await waitFor(() => expect(screen.queryByText('Consultando o catálogo…')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled();
  });

  it('sends the previous messages as history on the next turn', async () => {
    streamChatMock.mockImplementation(async (_m, _h, handlers) => handlers.onText('ok'));
    renderChat();
    const input = screen.getByLabelText('Mensagem');

    await userEvent.type(input, 'primeira{Enter}');
    await screen.findByText('ok');
    await userEvent.type(input, 'segunda{Enter}');

    await waitFor(() => expect(streamChatMock).toHaveBeenCalledTimes(2));
    expect(streamChatMock.mock.calls[1]![1]).toEqual([
      { role: 'user', content: 'primeira' },
      { role: 'assistant', content: 'ok' },
    ]);
  });

  it('shows the server error message when the request fails', async () => {
    streamChatMock.mockRejectedValue(new ApiError(503, 'Agente de IA indisponível'));
    renderChat();

    await userEvent.type(screen.getByLabelText('Mensagem'), 'oi{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent('Agente de IA indisponível');
  });
});
