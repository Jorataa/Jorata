import { useEffect, useRef, useState } from 'react';
import { sounds } from '../game/audio';

interface Props {
  canvas: HTMLCanvasElement | null;
  username: string;
  onSendToChat: (caption: string, dataUrl: string) => void;
  onClose: () => void;
}

const FILTERS = [
  { id: 'normal', name: 'Original', css: 'none' },
  { id: 'warmth', name: '🌿 Meadow', css: 'contrast(1.08) saturate(1.25) hue-rotate(-8deg)' },
  { id: 'golden', name: '🌅 Golden', css: 'sepia(0.3) saturate(1.3) brightness(1.05)' },
  { id: 'twilight', name: '💜 Twilight', css: 'hue-rotate(210deg) saturate(1.2) contrast(1.1)' },
  { id: 'vintage', name: '🎞️ Vintage', css: 'sepia(0.2) contrast(1.15) brightness(0.95)' },
  { id: 'noir', name: '🖤 Noir', css: 'grayscale(1) contrast(1.4)' },
  { id: 'pop', name: '✨ Pop', css: 'saturate(1.6) contrast(1.15)' },
];

const STICKERS = ['🌸', '⭐', '🎉', '🔥', '👑', '👀', '🌿', '💎', '☕', '❤️'];

export function CameraStudioModal({ canvas, username, onSendToChat, onClose }: Props) {
  const [sourceMode, setSourceMode] = useState<'canvas' | 'webcam'>('canvas');
  const [activeFilter, setActiveFilter] = useState('normal');
  const [caption, setCaption] = useState('');
  const [stampedStickers, setStampedStickers] = useState<{ id: string; emoji: string; x: number; y: number }[]>([]);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const [copied, setCopied] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stageCanvasRef = useRef<HTMLCanvasElement>(null);

  // Initialize webcam if mode selected
  useEffect(() => {
    if (sourceMode === 'webcam') {
      navigator.mediaDevices
        ?.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } })
        .then(stream => {
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(() => {});
          }
        })
        .catch(err => {
          console.warn('Webcam unavailable or permission denied:', err);
          setSourceMode('canvas');
        });
    } else {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    }

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, [sourceMode]);

  function takeSnapshot() {
    sounds.playShutter();
    setFlash(true);
    setTimeout(() => setFlash(false), 200);

    const offscreen = document.createElement('canvas');
    const ctx = offscreen.getContext('2d')!;

    if (sourceMode === 'webcam' && videoRef.current && videoRef.current.videoWidth > 0) {
      offscreen.width = videoRef.current.videoWidth;
      offscreen.height = videoRef.current.videoHeight;
      const selectedCss = FILTERS.find(f => f.id === activeFilter)?.css || 'none';
      ctx.filter = selectedCss;
      ctx.drawImage(videoRef.current, 0, 0);
    } else if (canvas) {
      offscreen.width = canvas.width;
      offscreen.height = canvas.height;
      const selectedCss = FILTERS.find(f => f.id === activeFilter)?.css || 'none';
      ctx.filter = selectedCss;
      ctx.drawImage(canvas, 0, 0);
    } else {
      return;
    }

    // Reset filter for stickers & caption
    ctx.filter = 'none';

    // Draw stamped stickers
    ctx.font = '48px system-ui, "Apple Color Emoji"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const s of stampedStickers) {
      const rx = (s.x / 100) * offscreen.width;
      const ry = (s.y / 100) * offscreen.height;
      ctx.fillText(s.emoji, rx, ry);
    }

    // Draw caption if entered
    if (caption.trim()) {
      ctx.font = 'bold 28px "Space Grotesk", system-ui, sans-serif';
      const textWidth = ctx.measureText(caption.trim()).width;
      const bannerHeight = 52;
      const bannerY = offscreen.height - 90;

      ctx.fillStyle = 'rgba(18, 36, 30, 0.78)';
      ctx.fillRect(0, bannerY, offscreen.width, bannerHeight);

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(caption.trim(), offscreen.width / 2, bannerY + bannerHeight / 2);
    }

    // Watermark
    ctx.font = '600 16px "Space Grotesk", system-ui';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.textAlign = 'right';
    ctx.fillText(`JORATA · @${username}`, offscreen.width - 24, offscreen.height - 24);

    const dataUrl = offscreen.toDataURL('image/png');
    setCapturedImage(dataUrl);
  }

  function addSticker(emoji: string) {
    sounds.playUiClick();
    setStampedStickers(prev => [
      ...prev,
      {
        id: `stk-${Date.now()}-${Math.random()}`,
        emoji,
        x: 30 + Math.random() * 40,
        y: 30 + Math.random() * 40,
      },
    ]);
  }

  function sendToChat(channelName: string) {
    if (!capturedImage) return;
    sounds.playChatPop();
    const messageText = caption.trim()
      ? `📸 Shared a Snap to #${channelName}: "${caption.trim()}"`
      : `📸 Shared a new Snap to #${channelName}!`;
    onSendToChat(messageText, capturedImage);
    onClose();
  }

  function downloadPhoto() {
    if (!capturedImage) return;
    const a = document.createElement('a');
    a.href = capturedImage;
    a.download = `jorata-snap-${Date.now()}.png`;
    a.click();
    sounds.playUiClick();
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="camera-title">
      <div className="camera-studio-card" onClick={e => e.stopPropagation()}>
        <header className="camera-header">
          <div>
            <span className="eyebrow">JORATA CAMERA STUDIO</span>
            <h2 id="camera-title">Snap & Create</h2>
          </div>
          <button className="icon-close-btn" onClick={onClose} aria-label="Close camera">✕</button>
        </header>

        {/* Viewport / Stage */}
        <div className="camera-viewport-frame">
          {flash && <div className="camera-flash-overlay" />}

          {capturedImage ? (
            <img src={capturedImage} alt="Captured snap" className="captured-preview-img" />
          ) : (
            <>
              {sourceMode === 'webcam' ? (
                <video
                  ref={videoRef}
                  className="camera-video-feed"
                  style={{ filter: FILTERS.find(f => f.id === activeFilter)?.css }}
                  playsInline
                  muted
                />
              ) : (
                <div
                  className="camera-canvas-preview"
                  style={{ filter: FILTERS.find(f => f.id === activeFilter)?.css }}
                >
                  {canvas ? (
                    <img src={canvas.toDataURL()} alt="Meadow world preview" className="canvas-snapshot-img" />
                  ) : (
                    <div className="camera-placeholder">Live Meadow View</div>
                  )}
                </div>
              )}

              {/* Live Stickers Stamped */}
              <div className="stamped-stickers-layer">
                {stampedStickers.map(stk => (
                  <span
                    key={stk.id}
                    className="stamped-emoji"
                    style={{ left: `${stk.x}%`, top: `${stk.y}%` }}
                  >
                    {stk.emoji}
                  </span>
                ))}
              </div>

              {/* Caption Preview Overlay */}
              {caption && (
                <div className="live-caption-pill">
                  <span>{caption}</span>
                </div>
              )}
            </>
          )}

          {/* Source Toggle Pills (Top Right inside frame) */}
          {!capturedImage && (
            <div className="source-toggle-chips">
              <button
                className={`source-chip ${sourceMode === 'canvas' ? 'active-source' : ''}`}
                onClick={() => {
                  sounds.playUiClick();
                  setSourceMode('canvas');
                }}
              >
                🎮 World
              </button>
              <button
                className={`source-chip ${sourceMode === 'webcam' ? 'active-source' : ''}`}
                onClick={() => {
                  sounds.playUiClick();
                  setSourceMode('webcam');
                }}
              >
                📸 Webcam
              </button>
            </div>
          )}
        </div>

        {/* Editing Controls (Before Capture) */}
        {!capturedImage && (
          <div className="camera-creative-controls">
            {/* Filter Slider */}
            <div className="filter-carousel-row">
              <span className="control-label">FILTER:</span>
              <div className="filter-list">
                {FILTERS.map(f => (
                  <button
                    key={f.id}
                    className={`filter-bubble-btn ${activeFilter === f.id ? 'active-filter' : ''}`}
                    onClick={() => {
                      sounds.playUiClick();
                      setActiveFilter(f.id);
                    }}
                  >
                    {f.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Sticker Bar */}
            <div className="sticker-palette-row">
              <span className="control-label">STICKERS:</span>
              <div className="sticker-list">
                {STICKERS.map(s => (
                  <button
                    key={s}
                    className="sticker-stamp-btn"
                    onClick={() => addSticker(s)}
                    title={`Add ${s}`}
                  >
                    {s}
                  </button>
                ))}
                {stampedStickers.length > 0 && (
                  <button
                    className="clear-stickers-btn"
                    onClick={() => setStampedStickers([])}
                    title="Clear stickers"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Caption Input */}
            <div className="caption-input-row">
              <input
                type="text"
                placeholder="Add a snappy caption…"
                value={caption}
                onChange={e => setCaption(e.target.value)}
                maxLength={60}
              />
            </div>

            {/* Shutter Button */}
            <div className="shutter-action-row">
              <button className="shutter-ring-btn" onClick={takeSnapshot} aria-label="Take snap">
                <div className="shutter-inner-core" />
              </button>
            </div>
          </div>
        )}

        {/* Post-Capture Actions */}
        {capturedImage && (
          <div className="post-capture-actions">
            <div className="share-buttons-row">
              <button
                className="action-button primary"
                onClick={() => sendToChat('general')}
              >
                💬 Send to #general
              </button>
              <button
                className="action-button secondary"
                onClick={() => sendToChat('creations')}
              >
                ✨ Send to #creations
              </button>
              <button
                className="action-button tertiary"
                onClick={downloadPhoto}
              >
                ↓ Download
              </button>
            </div>

            <button
              className="retake-snap-btn"
              onClick={() => {
                sounds.playUiClick();
                setCapturedImage(null);
              }}
            >
              ↺ Retake Photo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
