import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const SIZES = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' } as const;

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** Optional icon shown left of the title (v1 modal header). */
  icon?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: keyof typeof SIZES;
}

/** v1 modal look (`bg-black/50` overlay, rounded card), with Escape, focus and scroll lock. */
export function Modal({ open, onClose, title, icon, children, footer, size = 'md' }: ModalProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close dialog"
        tabIndex={-1}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm cursor-default"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`relative w-full ${SIZES[size]} max-h-[90dvh] flex flex-col bg-white dark:bg-dark-900 rounded-2xl border border-gray-200 dark:border-dark-700 shadow-2xl outline-none animate-fade-in`}
      >
        <div className="flex items-center justify-between gap-3 px-6 pt-6 pb-4">
          <div className="flex items-center gap-3 min-w-0">
            {icon}
            <h2 id={titleId} className="text-xl font-bold text-gray-800 dark:text-white truncate">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 pb-6 overflow-y-auto min-h-0">{children}</div>
        {footer && (
          <div className="px-6 py-4 border-t border-gray-200 dark:border-dark-700 flex gap-3 justify-end">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
