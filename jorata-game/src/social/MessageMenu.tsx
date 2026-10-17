import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { ChatMessage } from './types';

type MessageMenuProps = {
  message: ChatMessage;
  x: number;
  y: number;
  userId: string;
  close: () => void;
  reply: (message: ChatMessage) => void;
  edit: (message: ChatMessage) => void;
  mutate: (action: string, payload: Record<string, unknown>) => Promise<unknown>;
  fail: (error: string) => void;
};

function MenuIcon({ path }: { path: string }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={path} />
    </svg>
  );
}

export function MessageMenu({ message, x, y, userId, close, reply, edit, mutate, fail }: MessageMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(close);
  const [position, setPosition] = useState({ left: x, top: y, maxHeight: window.innerHeight - 16 });

  useLayoutEffect(() => { closeRef.current = close; }, [close]);

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const trigger = document.querySelector<HTMLElement>(
      `[data-message-id="${CSS.escape(message.id)}"] .social-message-menu-trigger`
    );
    menu.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus({ preventScroll: true });
    return () => {
      // Reply and edit can deliberately move focus into their text input.
      if (menu.contains(document.activeElement)) {
        const target = trigger?.isConnected ? trigger : previousFocus;
        if (target?.isConnected) target.focus({ preventScroll: true });
      }
    };
  }, [message.id]);

  useLayoutEffect(() => {
    const reposition = () => {
      const menu = menuRef.current;
      if (!menu) return;
      const viewport = window.visualViewport;
      const insetX = viewport?.offsetLeft ?? 0;
      const insetY = viewport?.offsetTop ?? 0;
      const width = viewport?.width ?? window.innerWidth;
      const height = viewport?.height ?? window.innerHeight;
      const maxHeight = Math.max(40, height - 16);
      setPosition({
        left: Math.max(insetX + 8, Math.min(x, insetX + width - menu.offsetWidth - 8)),
        top: Math.max(insetY + 8, Math.min(y, insetY + height - Math.min(menu.scrollHeight, maxHeight) - 8)),
        maxHeight,
      });
    };
    reposition();
    window.addEventListener('resize', reposition);
    window.visualViewport?.addEventListener('resize', reposition);
    window.visualViewport?.addEventListener('scroll', reposition);
    return () => {
      window.removeEventListener('resize', reposition);
      window.visualViewport?.removeEventListener('resize', reposition);
      window.visualViewport?.removeEventListener('scroll', reposition);
    };
  }, [x, y, message.id]);

  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) closeRef.current();
    };
    // Allow the pointer event that opened the menu to finish before listening.
    const frame = requestAnimationFrame(() => document.addEventListener('pointerdown', dismiss, true));
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('pointerdown', dismiss, true);
    };
  }, []);

  function navigate(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    if (event.key === 'Tab') {
      close();
      return;
    }
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []);
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    let next: number;
    switch (event.key) {
      case 'ArrowDown': case 'ArrowRight': next = (index + 1) % items.length; break;
      case 'ArrowUp': case 'ArrowLeft': next = (index - 1 + items.length) % items.length; break;
      case 'Home': next = 0; break;
      case 'End': next = items.length - 1; break;
      default: return;
    }
    event.preventDefault();
    items[next]?.focus();
  }

  async function perform(operation: () => Promise<unknown>) {
    fail('');
    close();
    try {
      await operation();
    } catch (error) {
      fail(error instanceof Error ? error.message : 'Unable to complete this action. Please try again.');
    }
  }

  return (
    <div
      ref={menuRef}
      className="social-context-menu"
      style={{ ...position, maxWidth: 'calc(100vw - 16px)', overflowY: 'auto' }}
      role="menu"
      aria-label="Message options"
      onKeyDown={navigate}
      onContextMenu={event => event.preventDefault()}
    >
      <div className="social-context-emojis" role="group" aria-label="Quick reactions">
        {['👍', '❤️', '😂', '🎉', '👀', '👋'].map(emoji => (
          <button key={emoji} type="button" role="menuitem" tabIndex={-1} aria-label={`React ${emoji}`}
            onClick={() => void perform(() => mutate('react', { message_id: message.id, emoji }))}>
            {emoji}
          </button>
        ))}
      </div>
      <button type="button" role="menuitem" tabIndex={-1} className="social-context-item" onClick={() => { reply(message); close(); }}>
        <MenuIcon path="m9 5-7 7 7 7M2 12h12a7 7 0 0 1 7 7" /> Reply
      </button>
      {message.body && (
        <button type="button" role="menuitem" tabIndex={-1} className="social-context-item" onClick={() => void perform(async () => {
          if (!navigator.clipboard) throw new Error('Clipboard is unavailable. Select the message text to copy it.');
          await navigator.clipboard.writeText(message.body);
        })}>
          <MenuIcon path="M9 9h12v12H9zM15 5V3H3v12h2" /> Copy text
        </button>
      )}
      {message.sender_id === userId ? (
        <>
          <button type="button" role="menuitem" tabIndex={-1} className="social-context-item" onClick={() => { edit(message); close(); }}>
            <MenuIcon path="m16 3 5 5M3 21l5-1L21 7a3.5 3.5 0 0 0-5-5L3 15z" /> Edit message
          </button>
          <button type="button" role="menuitem" tabIndex={-1} className="social-context-item social-context-danger"
            onClick={() => void perform(() => mutate('delete_message', { message_id: message.id }))}>
            <MenuIcon path="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" /> Delete message
          </button>
        </>
      ) : (
        <button type="button" role="menuitem" tabIndex={-1} className="social-context-item" onClick={() => {
          const reason = window.prompt('Why are you reporting this message? (3–1000 characters)');
          if (reason) void perform(() => mutate('report', { user_id: message.sender_id, message_id: message.id, reason }));
          else close();
        }}>
          <MenuIcon path="M5 21V3c5-4 9 4 14 0v12c-5 4-9-4-14 0" /> Report message
        </button>
      )}
    </div>
  );
}
