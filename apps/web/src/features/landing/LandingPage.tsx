import { CTA } from './CTA';
import { Features } from './Features';
import { Footer } from './Footer';
import { Hero } from './Hero';
import { HowItWorks } from './HowItWorks';
import { Navbar } from './Navbar';
import { Pricing } from './Pricing';

/** `/` (F-01): the v1 landing page, composed from its sections. */
export function LandingPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-dark-950">
      <Navbar />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <Pricing />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
