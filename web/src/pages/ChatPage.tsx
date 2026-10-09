import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import Markdown from 'react-markdown';
import { ApiError } from '../api/client';
import { streamChat } from '../api/chatStream';
import type { ChatMessage } from '../api/types';
import { Icon } from '../components/ui';

const SUGGESTIONS = [
  'Quais produtos vocês têm?',
  'O que tem até R$ 100?',
  'Quais categorias existem?',
  'Qual é o produto mais caro?',
];

const TOOL_LABELS: Record<string, string> = {
  search_products: 'Consultando o catálogo…',
  list_categories: 'Verificando as categorias…',
};

export function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, status]);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function send(text: string) {
    const message = text.trim();
    if (!message || streaming) return;

    const history = messages.filter((m) => m.content).slice(-20);
    setMessages([...history, { role: 'user', content: message }, { role: 'assistant', content: '' }]);
    setInput('');
    setError(null);
    setStreaming(true);
    setStatus('Pensando…');

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await streamChat(
        message,
        history,
        {
          onText: (chunk) => {
            setStatus(null);
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1]!;
              next[next.length - 1] = { ...last, content: last.content + chunk };
              return next;
            });
          },
          onTool: (name) => setStatus(TOOL_LABELS[name] ?? 'Consultando…'),
        },
        controller.signal,
      );
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(err instanceof ApiError ? err.message : 'Não foi possível obter a resposta.');
      }
    } finally {
      setMessages((prev) => (prev.at(-1)?.content === '' ? prev.slice(0, -1) : prev));
      setStreaming(false);
      setStatus(null);
      abortRef.current = null;
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send(input);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  }

  return (
    <div className="chat">
      <div className="chat-scroll">
        {messages.length === 0 ? (
          <div className="chat-empty">
            <span className="brand-mark brand-mark-lg">
              <Icon name="sparkles" size={22} />
            </span>
            <h1>Como posso ajudar?</h1>
            <p className="muted">Pergunte sobre produtos, preços e categorias. Consulto o catálogo da sua empresa em tempo real.</p>
            <div className="suggestions">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="chip chip-button" onClick={() => void send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <ul className="messages">
            {messages.map((m, i) => (
              <li key={i} className={`bubble bubble-${m.role}`}>
                {m.role === 'assistant' ? (
                  m.content ? (
                    <div className="markdown">
                      <Markdown>{m.content}</Markdown>
                    </div>
                  ) : (
                    <span className="typing" aria-label="Digitando">
                      <i /><i /><i />
                    </span>
                  )
                ) : (
                  m.content
                )}
              </li>
            ))}
          </ul>
        )}
        {status && (
          <div className="chat-status" role="status">
            {status}
          </div>
        )}
        {error && (
          <div className="alert" role="alert">
            {error}
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form className="composer" onSubmit={onSubmit}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Pergunte sobre os produtos…"
          rows={1}
          maxLength={2000}
          aria-label="Mensagem"
        />
        {streaming ? (
          <button type="button" className="btn btn-icon btn-primary" onClick={() => abortRef.current?.abort()} aria-label="Parar">
            <Icon name="stop" />
          </button>
        ) : (
          <button type="submit" className="btn btn-icon btn-primary" disabled={!input.trim()} aria-label="Enviar">
            <Icon name="send" />
          </button>
        )}
      </form>
    </div>
  );
}
