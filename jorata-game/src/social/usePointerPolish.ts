import { useEffect, useRef, type RefObject } from 'react';
import './pointer-polish.css';

const interactive = '.social-room, .social-nav-item, .social-new-chat-btn, .social-composer-send';
const magnetic = '.social-new-chat-btn, .social-composer-send';

/** Small, mouse-only details. Pointer movement never updates React state. */
export function usePointerPolish(): RefObject<HTMLDivElement | null> {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const media = window.matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
    const clicks = new Map<HTMLElement, number>();
    let active: HTMLElement | null = null;
    let frame = 0;
    let pointerX = 0;
    let pointerY = 0;

    function clearActive() {
      if (!active) return;
      active.removeAttribute('data-pointer-lit');
      for (const property of ['--pointer-x', '--pointer-y', '--pointer-shift-x', '--pointer-shift-y']) {
        active.style.removeProperty(property);
      }
      active = null;
    }

    function reset() {
      cancelAnimationFrame(frame);
      frame = 0;
      clearActive();
    }

    function findTarget(event: PointerEvent) {
      if (!media.matches || event.pointerType !== 'mouse' || !(event.target instanceof Element)) return null;
      const target = event.target.closest<HTMLElement>(interactive);
      return target && root!.contains(target) && !target.matches(':disabled, [aria-disabled="true"]') ? target : null;
    }

    function paint() {
      frame = 0;
      if (!active?.isConnected) return;
      const bounds = active.getBoundingClientRect();
      const x = pointerX - bounds.left;
      const y = pointerY - bounds.top;
      active.style.setProperty('--pointer-x', `${x}px`);
      active.style.setProperty('--pointer-y', `${y}px`);
      active.setAttribute('data-pointer-lit', '');
      if (active.matches(magnetic)) {
        // CSS translate composes with existing press/entrance transforms.
        const shiftX = Math.max(-2, Math.min(2, (x / Math.max(1, bounds.width) - 0.5) * 4));
        const shiftY = Math.max(-2, Math.min(2, (y / Math.max(1, bounds.height) - 0.5) * 4));
        active.style.setProperty('--pointer-shift-x', `${shiftX}px`);
        active.style.setProperty('--pointer-shift-y', `${shiftY}px`);
      }
    }

    function move(event: PointerEvent) {
      const target = findTarget(event);
      if (target !== active) {
        clearActive();
        active = target;
      }
      if (!active) return;
      pointerX = event.clientX;
      pointerY = event.clientY;
      if (!frame) frame = requestAnimationFrame(paint);
    }

    function click(event: PointerEvent) {
      if (event.button !== 0 || !findTarget(event)) return;
      const dot = document.createElement('span');
      dot.className = 'social-pointer-click';
      dot.setAttribute('aria-hidden', 'true');
      dot.style.left = `${event.clientX}px`;
      dot.style.top = `${event.clientY}px`;
      document.body.appendChild(dot);
      const remove = () => {
        window.clearTimeout(clicks.get(dot));
        clicks.delete(dot);
        dot.remove();
      };
      dot.addEventListener('animationend', remove, { once: true });
      clicks.set(dot, window.setTimeout(remove, 350));
    }

    function clearEffects() {
      reset();
      for (const [dot, timeout] of clicks) {
        window.clearTimeout(timeout);
        dot.remove();
      }
      clicks.clear();
    }

    root.addEventListener('pointermove', move, { passive: true });
    root.addEventListener('pointerdown', click, { passive: true });
    root.addEventListener('pointerleave', reset);
    root.addEventListener('pointercancel', reset);
    root.addEventListener('scroll', reset, { capture: true, passive: true });
    window.addEventListener('blur', clearEffects);
    media.addEventListener('change', clearEffects);
    return () => {
      clearEffects();
      root.removeEventListener('pointermove', move);
      root.removeEventListener('pointerdown', click);
      root.removeEventListener('pointerleave', reset);
      root.removeEventListener('pointercancel', reset);
      root.removeEventListener('scroll', reset, true);
      window.removeEventListener('blur', clearEffects);
      media.removeEventListener('change', clearEffects);
    };
  }, []);

  return rootRef;
}
