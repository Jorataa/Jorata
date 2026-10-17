import { useEffect, useRef, useState } from 'react';
import { sounds } from '../game/audio';

interface Props {
  canvas: HTMLCanvasElement | null;
  username: string;
  playerX: number;
  playerY: number;
  onClose: () => void;
}

export function SnapshotModal({ canvas, username, playerX, playerY, onClose }: Props) {
  const [dataUrl, setDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const snapDate = useRef(new Date().toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }));

  useEffect(() => {
    sounds.playShutter();
    if (canvas) {
      try {
        const snap = canvas.toDataURL('image/png');
        setDataUrl(snap);
      } catch (err) {
        console.error('Could not capture canvas snapshot:', err);
      }
    }
  }, [canvas]);

  function downloadSnap() {
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `jorata-snap-${Date.now()}.png`;
    a.click();
    sounds.playUiClick();
  }

  async function copySnap() {
    if (!canvas) return;
    try {
      canvas.toBlob(async blob => {
        if (!blob) return;
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        setCopied(true);
        sounds.playUiClick();
        setTimeout(() => setCopied(false), 2500);
      });
    } catch {
      // Fallback: download
      downloadSnap();
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="snap-title">
      <div className="snap-polaroid-card" onClick={e => e.stopPropagation()}>
        <header className="snap-header">
          <div>
            <span className="eyebrow">JORATA SNAPS · THE MEADOW</span>
            <h2 id="snap-title">Meadow Memory</h2>
          </div>
          <button className="icon-close-btn" onClick={onClose} aria-label="Close snap">✕</button>
        </header>

        <div className="polaroid-frame">
          <div className="polaroid-photo-container">
            {dataUrl ? (
              <img src={dataUrl} alt="Jorata in-game snapshot" className="polaroid-image" />
            ) : (
              <div className="polaroid-placeholder">Capturing the meadow…</div>
            )}
            <div className="polaroid-vignette" />
          </div>

          <div className="polaroid-meta-strip">
            <div className="polaroid-stamp">
              <span className="stamp-symbol">✳</span>
              <span className="stamp-text">MEADOW · #001</span>
            </div>
            <div className="polaroid-caption">
              <strong>Captured by {username}</strong>
              <time>X: {playerX.toFixed(0)}, Y: {playerY.toFixed(0)} · {snapDate.current}</time>
            </div>
          </div>
        </div>

        <div className="snap-actions">
          <button className="action-button primary" onClick={downloadSnap} disabled={!dataUrl}>
            <span>↓</span> Download Photo
          </button>
          <button className="action-button secondary" onClick={copySnap} disabled={!dataUrl}>
            <span>📋</span> {copied ? 'Copied to Clipboard!' : 'Copy Image'}
          </button>
        </div>
      </div>
    </div>
  );
}
