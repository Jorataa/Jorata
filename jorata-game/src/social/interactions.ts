import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

/** Keep a closing surface mounted just long enough for its exit transition. */
export function usePresence<T>(value: T, duration = 180) {
  const [retained, setRetained] = useState(value);
  useEffect(() => {
    if (value) { setRetained(value); return; }
    const timer = window.setTimeout(() => setRetained(value), matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : duration);
    return () => clearTimeout(timer);
  }, [value, duration]);
  return { value: value || retained, closing: !value || undefined };
}

export function useSidebarResize() {
  const [width, setWidth] = useState(() => {
    try { const saved = Number(localStorage.getItem('jorata-sidebar-width-v1')); return saved ? Math.max(250, Math.min(420, saved)) : 288; }
    catch { return 288; }
  });
  const [resizing, setResizing] = useState(false);
  const start = useRef<{ x: number; width: number } | null>(null);
  function save(value: number) {
    const next = Math.max(250, Math.min(420, value));
    setWidth(next);
    try { localStorage.setItem('jorata-sidebar-width-v1', String(next)); } catch { /* Optional preference. */ }
  }
  return { width, resizing, separator: {
    onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
      if (event.button !== 0) return;
      event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
      start.current = { x: event.clientX, width }; setResizing(true);
    },
    onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
      if (start.current) setWidth(Math.max(250, Math.min(420, start.current.width + event.clientX - start.current.x)));
    },
    onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
      if (!start.current) return;
      save(width); start.current = null; setResizing(false); event.currentTarget.releasePointerCapture(event.pointerId);
    },
    onLostPointerCapture() { start.current = null; setResizing(false); },
    onPointerCancel() { if (start.current) setWidth(start.current.width); start.current = null; setResizing(false); },
    onDoubleClick() { save(288); },
    onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Enter'].includes(event.key)) return;
      event.preventDefault(); save(event.key === 'Home' ? 250 : event.key === 'End' ? 420 : event.key === 'Enter' ? 288 : width + (event.key === 'ArrowRight' ? 10 : -10));
    },
  } };
}

/** Horizontal intent locks after 10px; native vertical panning stays available. */
export function useSwipeReply(onReply: (id: string) => void) {
  const gesture = useRef<{ id: string; pointer: number; x: number; y: number; offset: number; locked: boolean } | null>(null);
  function reset(node: HTMLElement, commit = false) {
    const current = gesture.current;
    gesture.current = null;
    node.style.removeProperty('--reply-drag'); node.removeAttribute('data-swiping'); node.removeAttribute('data-reply-ready');
    if (current && node.hasPointerCapture(current.pointer)) node.releasePointerCapture(current.pointer);
    if (commit && current && current.offset >= 56) onReply(current.id);
  }
  return {
    onPointerDown(event: ReactPointerEvent<HTMLElement>) {
      if (event.pointerType === 'mouse' || !event.isPrimary || (event.target as HTMLElement).closest('button,a,input,textarea')) return;
      gesture.current = { id: event.currentTarget.dataset.messageId!, pointer: event.pointerId, x: event.clientX, y: event.clientY, offset: 0, locked: false };
    },
    onPointerMove(event: ReactPointerEvent<HTMLElement>) {
      const current = gesture.current;
      if (!current || current.pointer !== event.pointerId) return;
      const dx = event.clientX - current.x, dy = event.clientY - current.y;
      if (!current.locked) {
        if (Math.abs(dy) > 10 && Math.abs(dy) >= Math.abs(dx)) { reset(event.currentTarget); return; }
        if (Math.abs(dx) < 10) return;
        if (dx < 0 || Math.abs(dx) < Math.abs(dy) * 1.5) { reset(event.currentTarget); return; }
        current.locked = true; event.currentTarget.setPointerCapture(event.pointerId);
      }
      current.offset = Math.min(82, Math.max(0, dx * .7));
      event.currentTarget.dataset.swiping = 'true';
      event.currentTarget.dataset.replyReady = String(current.offset >= 56);
      event.currentTarget.style.setProperty('--reply-drag', `${current.offset}px`);
    },
    onPointerUp(event: ReactPointerEvent<HTMLElement>) { reset(event.currentTarget, true); },
    onPointerCancel(event: ReactPointerEvent<HTMLElement>) { reset(event.currentTarget); },
    onLostPointerCapture(event: ReactPointerEvent<HTMLElement>) {
      // Touch starts with implicit capture on the text/image child. Moving
      // capture to the message emits a bubbling lost event from that child.
      if (event.target === event.currentTarget) reset(event.currentTarget);
    },
  };
}
