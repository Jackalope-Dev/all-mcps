'use client';

import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Maximize2,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { trackFeatureUse } from '../../lib/gtag';

interface ScreenshotViewerProps {
  src: string | string[];
  alt: string;
  title?: string;
}

export function ScreenshotViewer({ src, alt, title }: ScreenshotViewerProps) {
  const images = Array.isArray(src)
    ? src.filter(Boolean)
    : [src].filter(Boolean);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  const activeSrc = images[currentIndex] || images[0] || '';
  const hasMultiple = images.length > 1;

  const handleOpen = () => {
    trackFeatureUse('screenshot_viewer', { title, count: images.length });
    setIsOpen(true);
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      } else if (e.key === 'ArrowLeft' && hasMultiple) {
        setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
      } else if (e.key === 'ArrowRight' && hasMultiple) {
        setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, hasMultiple, images.length]);

  if (!activeSrc) return null;

  return (
    <>
      <div
        onClick={handleOpen}
        className="screenshot-preview-container"
        style={{
          margin: '0 0 1.5rem',
          borderRadius: '16px',
          overflow: 'hidden',
          border: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
          background: 'var(--bg-muted, rgba(15, 23, 42, 0.6))',
          position: 'relative',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '0.75rem',
          backdropFilter: 'blur(8px)',
          transition: 'all 0.2s ease',
        }}
        title="Click to expand screenshot"
        role="button"
        tabIndex={0}
        aria-label="Expand screenshot"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen(true);
          }
        }}
      >
        {/* Main image - natural aspect ratio, contain fit */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={activeSrc}
          alt={alt}
          style={{
            maxWidth: '100%',
            maxHeight: '420px',
            width: 'auto',
            height: 'auto',
            objectFit: 'contain',
            borderRadius: '10px',
            display: 'block',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)',
          }}
        />

        {/* Multi-image thumbnail bar below main preview if multiple exist */}
        {hasMultiple && (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginTop: '0.75rem',
              overflowX: 'auto',
              maxWidth: '100%',
              padding: '0.25rem',
            }}
          >
            {images.map((imgUrl, idx) => (
              <button
                key={imgUrl + idx}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                style={{
                  padding: 0,
                  border:
                    idx === currentIndex
                      ? '2px solid var(--accent-color, #00E5FF)'
                      : '1px solid var(--border-color)',
                  borderRadius: '6px',
                  overflow: 'hidden',
                  background: 'none',
                  cursor: 'pointer',
                  opacity: idx === currentIndex ? 1 : 0.6,
                  transition: 'all 0.2s ease',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imgUrl}
                  alt={`Thumbnail ${idx + 1}`}
                  style={{
                    width: '60px',
                    height: '40px',
                    objectFit: 'cover',
                    display: 'block',
                  }}
                />
              </button>
            ))}
          </div>
        )}

        {/* Hover / Expand Badge - explicit white text on dark glass pill */}
        <div
          className="screenshot-expand-badge"
          style={{
            position: 'absolute',
            bottom: '1rem',
            right: '1rem',
            background: 'rgba(2, 6, 23, 0.88)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '20px',
            padding: '0.35rem 0.75rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            color: '#ffffff',
            fontSize: '0.78rem',
            fontWeight: 600,
            backdropFilter: 'blur(6px)',
            pointerEvents: 'none',
            boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
            transition: 'all 0.2s ease',
          }}
        >
          <Maximize2 size={13} style={{ color: '#00E5FF' }} />
          <span>
            {hasMultiple
              ? `Expand (${currentIndex + 1}/${images.length})`
              : 'Expand screenshot'}
          </span>
        </div>
      </div>

      {/* Lightbox Modal */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          aria-modal="true"
          role="dialog"
          aria-label={title || alt}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            background: 'rgba(2, 6, 23, 0.94)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            animation: 'fadeIn 0.2s ease-out forwards',
          }}
        >
          {/* Top Bar Controls */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              top: '1.25rem',
              left: '1.5rem',
              right: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              zIndex: 100000,
              gap: '1rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                minWidth: 0,
              }}
            >
              <span
                style={{
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {title || alt}{' '}
                {hasMultiple ? `(${currentIndex + 1} of ${images.length})` : ''}
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                flexShrink: 0,
              }}
            >
              <a
                href={activeSrc}
                target="_blank"
                rel="noopener noreferrer"
                title="Open original high-res image in new tab"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.45rem 0.85rem',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#ffffff',
                  fontSize: '0.82rem',
                  fontWeight: 500,
                  textDecoration: 'none',
                  transition: 'background 0.2s ease',
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background =
                    'rgba(255, 255, 255, 0.22)')
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background =
                    'rgba(255, 255, 255, 0.1)')
                }
              >
                <ExternalLink size={14} />
                <span>Original</span>
              </a>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Close (Esc)"
                aria-label="Close modal"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.12)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#ffffff',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background =
                    'rgba(255, 255, 255, 0.25)';
                  e.currentTarget.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background =
                    'rgba(255, 255, 255, 0.12)';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Lightbox Image Box with Prev/Next Controls */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              maxWidth: '94vw',
              maxHeight: '82vh',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: 'auto',
            }}
          >
            {hasMultiple && (
              <button
                type="button"
                onClick={() =>
                  setCurrentIndex((prev) =>
                    prev > 0 ? prev - 1 : images.length - 1,
                  )
                }
                title="Previous image (Left Arrow)"
                aria-label="Previous image"
                style={{
                  position: 'absolute',
                  left: '-1.5rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  zIndex: 10,
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  background: 'rgba(2, 6, 23, 0.85)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = 'rgba(0, 229, 255, 0.3)')
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = 'rgba(2, 6, 23, 0.85)')
                }
              >
                <ChevronLeft size={22} />
              </button>
            )}

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activeSrc}
              alt={alt}
              style={{
                maxWidth: '92vw',
                maxHeight: '82vh',
                width: 'auto',
                height: 'auto',
                objectFit: 'contain',
                borderRadius: '12px',
                boxShadow:
                  '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.1)',
                display: 'block',
              }}
            />

            {hasMultiple && (
              <button
                type="button"
                onClick={() =>
                  setCurrentIndex((prev) =>
                    prev < images.length - 1 ? prev + 1 : 0,
                  )
                }
                title="Next image (Right Arrow)"
                aria-label="Next image"
                style={{
                  position: 'absolute',
                  right: '-1.5rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  zIndex: 10,
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  background: 'rgba(2, 6, 23, 0.85)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = 'rgba(0, 229, 255, 0.3)')
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = 'rgba(2, 6, 23, 0.85)')
                }
              >
                <ChevronRight size={22} />
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
