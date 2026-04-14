import { X } from 'lucide-react';

const PromoPopup = ({ onClose }) => {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 p-4 animate-fade-in"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="relative rounded-2xl shadow-2xl w-full max-w-[580px] animate-slide-up overflow-hidden"
        style={{ background: '#ffffff', border: '1px solid #e2e8f0' }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 transition-colors"
          style={{ color: '#94a3b8' }}
          onMouseEnter={e => e.currentTarget.style.color = '#475569'}
          onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
          aria-label="Close promotional popup"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="px-8 pt-10 pb-10 sm:px-10 sm:pt-12 sm:pb-12">
          <div className="mb-6">
            <img
              src="/davnoot-logo.png"
              alt="Davnoot Digital"
              style={{ height: '32px', width: 'auto', objectFit: 'contain' }}
            />
          </div>

          <h2
            className="leading-tight pr-8"
            style={{
              fontSize: 'clamp(1.25rem, 4vw, 1.6rem)',
              fontWeight: 800,
              color: '#0f172a',
              textTransform: 'uppercase',
              fontFamily: 'Inter, sans-serif',
              letterSpacing: '-0.01em',
              lineHeight: 1.18,
            }}
          >
            Your competitors are already fixing this.
          </h2>

          <div style={{ height: '1px', background: '#e2e8f0', margin: '28px 0' }} />

          <p className="leading-relaxed" style={{ color: '#475569', fontSize: '1rem' }}>
            If you want your brand showing up first when your clients or potential clients search AI we handle that for you.
          </p>

          <div className="mt-10 flex flex-col gap-3">
            <a
              href="https://www.davnoot.com/contact"
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClose}
              className="w-full inline-flex items-center justify-center px-4 py-3.5 rounded-xl font-bold transition-all duration-200"
              style={{
                background: 'linear-gradient(to right, #3b82f6 0%, #6366f1 100%)',
                color: '#ffffff',
                boxShadow: '0 4px 18px rgba(59,130,246,0.25)',
                fontSize: '1rem',
              }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = '0 6px 26px rgba(59,130,246,0.45), 0 4px 12px rgba(99,102,241,0.3)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = '0 4px 18px rgba(59,130,246,0.25)'}
            >
              Book a Free Call
            </a>
            <p className="w-full text-center text-xs" style={{ color: '#94a3b8' }}>
              or email david@davnoot.com directly
            </p>
            <button
              onClick={onClose}
              className="w-full text-center text-sm transition-colors"
              style={{ color: '#94a3b8' }}
              onMouseEnter={e => e.currentTarget.style.color = '#475569'}
              onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
            >
              Maybe later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PromoPopup;
