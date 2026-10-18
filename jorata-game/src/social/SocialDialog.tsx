import { useEffect, useRef, useState, type ReactNode } from 'react';

/** Shared dialog behavior: keyboard containment, Escape, and focus restoration. */
export function SocialDialog({ title, close, children, preventClose = false }: { title: string; close: () => void; children: ReactNode; preventClose?: boolean }) {
  const [closing, setClosing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const preventCloseRef = useRef(preventClose);
  preventCloseRef.current = preventClose;
  function dismiss() {
    if (timer.current || preventCloseRef.current) return;
    setClosing(true);
    timer.current = setTimeout(() => closeRef.current(), matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180);
  }
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const ref = useRef<HTMLElement>(null);
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() => {
      (ref.current?.querySelector<HTMLElement>('[autofocus]') || ref.current?.querySelector<HTMLElement>('input, textarea, select') || ref.current?.querySelector<HTMLElement>('button') || ref.current)?.focus();
    });
    function keydown(event: KeyboardEvent) {
      if (event.key === 'Escape') { event.stopPropagation(); dismiss(); }
      if (event.key !== 'Tab') return;
      const items = Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]') || []).filter(el => el.getClientRects().length > 0);
      const first = items[0], last = items.at(-1);
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || !ref.current?.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', keydown);
    return () => { cancelAnimationFrame(frame); document.removeEventListener('keydown', keydown); if (previous?.isConnected) previous.focus(); };
  }, []);
  return <div className="social-modal" onMouseDown={event => { if (event.target === event.currentTarget) dismiss(); }}>
    <section data-closing={closing || undefined} ref={ref} className="social-dialog" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}>
      <div className="social-dialog-heading"><h2>{title}</h2><button disabled={preventClose} className="social-icon-button" onClick={dismiss} aria-label="Close dialog">×</button></div>
      {children}
    </section>
  </div>;
}
