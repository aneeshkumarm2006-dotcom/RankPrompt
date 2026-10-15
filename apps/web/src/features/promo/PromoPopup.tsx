import { X } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { PROMO_URL } from '../../lib/config';

/** v1 PromoPopup (F-33): Davnoot's "we handle AI visibility for you" offer. */
export function PromoPopup({ onClose }: { onClose: () => void }) {
  const titleId = useId();
  const ctaRef = useRef<HTMLAnchorElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ctaRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus();
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <button
        type="button"
        aria-label="Close promotional popup"
        tabIndex={-1}
        className="absolute inset-0 bg-black/85 backdrop-blur-md cursor-default"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative rounded-2xl shadow-2xl w-full max-w-[580px] overflow-hidden bg-white border border-slate-200"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-10 text-slate-400 hover:text-slate-600 transition-colors"
          aria-label="Close promotional popup"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="px-8 pt-10 pb-10 sm:px-10 sm:pt-12 sm:pb-12">
          <img
            src="/davnoot-logo.png"
            alt="Davnoot Digital"
            className="h-8 w-auto object-contain mb-6"
          />

          <h2
            id={titleId}
            className="pr-8 font-extrabold uppercase text-slate-900 tracking-tight leading-tight text-[clamp(1.25rem,4vw,1.6rem)]"
          >
            Your competitors are already fixing this.
          </h2>

          <div className="h-px bg-slate-200 my-7" />

          <p className="leading-relaxed text-slate-600 text-base">
            If you want your brand showing up first when your clients or potential clients search
            AI, we handle that for you.
          </p>

          <div className="mt-10 flex flex-col gap-3">
            <a
              ref={ctaRef}
              href={PROMO_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClose}
              className="w-full inline-flex items-center justify-center px-4 py-3.5 rounded-xl font-bold text-white text-base bg-gradient-to-r from-blue-500 to-indigo-500 shadow-[0_4px_18px_rgba(59,130,246,0.25)] hover:shadow-[0_6px_26px_rgba(59,130,246,0.45)] transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            >
              Book a Free Call
            </a>
            <p className="w-full text-center text-xs text-slate-400">
              or email david@davnoot.com directly
            </p>
            <button
              type="button"
              onClick={onClose}
              className="w-full text-center text-sm text-slate-400 hover:text-slate-600 transition-colors"
            >
              Maybe later
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
