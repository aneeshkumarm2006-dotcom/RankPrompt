import { Zap } from 'lucide-react';
import { Link } from 'react-router';

/** The large v1 landing/auth logo (Navbar, Footer, auth cards), linking home. */
export function BrandLogo({ className = '' }: { className?: string }) {
  return (
    <Link to="/" className={`flex items-center space-x-3 group ${className}`}>
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-primary-500 to-accent-500 rounded-xl blur-lg opacity-50 group-hover:opacity-75 transition-opacity" />
        <div className="relative bg-gradient-to-r from-primary-500 to-accent-500 p-2.5 rounded-xl">
          <Zap className="w-6 h-6 text-white" aria-hidden />
        </div>
      </div>
      <span className="text-2xl font-bold gradient-text">PromptVerse</span>
    </Link>
  );
}
