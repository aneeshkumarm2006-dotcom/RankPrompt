import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { CONTACT_URL } from '../../lib/config';
import { Footer } from './Footer';
import { Navbar } from './Navbar';

const LAST_UPDATED = 'October 2026';

/** Same shell as the landing page: Navbar + content + Footer. */
function LegalShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white dark:bg-dark-950 flex flex-col">
      <Navbar onLanding={false} />
      <main className="flex-1 pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <article className="max-w-3xl mx-auto">
          <h1 className="text-4xl sm:text-5xl font-black text-gray-800 dark:text-white mb-3">
            {title}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-10">
            Last updated: {LAST_UPDATED}
          </p>
          <div className="space-y-8 text-gray-700 dark:text-gray-300 leading-relaxed">
            {children}
          </div>
        </article>
      </main>
      <Footer onLanding={false} />
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-bold text-gray-800 dark:text-white">{title}</h2>
      {children}
    </section>
  );
}

function List({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc pl-6 space-y-1.5">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

const linkClass =
  'text-action-600 hover:text-action-700 dark:text-action-500 dark:hover:text-action-400 font-medium';

function Contact() {
  return (
    <p>
      Questions? Reach us through our{' '}
      <a href={CONTACT_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>
        contact page
      </a>
      .
    </p>
  );
}

/** `/terms`: plain-language beta terms. No invented legal promises. */
export function TermsPage() {
  return (
    <LegalShell title="Terms of Service">
      <p>
        These terms explain how you can use PromptVerse. They are written to be short and clear. By
        creating an account or using the service you agree to them.
      </p>

      <Section title="PromptVerse is in beta">
        <p>
          PromptVerse is still being built. Features may change, and there may be bugs or
          interruptions. The service is provided as it is, without guarantees that it will always be
          available or error-free.
        </p>
      </Section>

      <Section title="Your account">
        <List
          items={[
            'Give accurate details when you sign up and keep your password private.',
            'You are responsible for what happens under your account.',
            'Tell us if you think someone else has access to your account.',
          ]}
        />
      </Section>

      <Section title="Using the service fairly">
        <p>Please don’t:</p>
        <List
          items={[
            'use PromptVerse for anything unlawful or harmful;',
            'try to break, overload or get around the limits of the service;',
            'share or resell your account access.',
          ]}
        />
        <p>We may suspend accounts that break these terms.</p>
      </Section>

      <Section title="AI answers and results">
        <p>
          Reports show what third-party AI platforms (such as ChatGPT, Gemini, Claude, Perplexity
          and Google AI Overviews) answered at the time of a run. Their answers change, can be
          wrong, and are outside our control. We report what they said; we can’t promise any ranking
          or outcome.
        </p>
      </Section>

      <Section title="Credits, plans and payments">
        <List
          items={[
            'Runs use credits. The cost of a run is shown before you start it.',
            'Plan credits are granted each billing period and reset at the next one. Purchased and bonus credits do not expire.',
            'Payments are processed by Stripe. Subscriptions renew monthly until you cancel.',
            'You can cancel at any time; your plan stays active until the end of the period you paid for.',
          ]}
        />
      </Section>

      <Section title="Your content">
        <p>
          The brands, websites, competitors and prompts you add stay yours. You let us use them to
          run your analyses and show your reports. See the{' '}
          <Link to="/privacy" className={linkClass}>
            Privacy Policy
          </Link>{' '}
          for how we handle data.
        </p>
      </Section>

      <Section title="Changes">
        <p>
          We may update these terms as the product changes. When we do, we’ll update the date at the
          top of this page.
        </p>
      </Section>

      <Contact />
    </LegalShell>
  );
}

/** `/privacy`: what we store and why, in plain language. */
export function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy">
      <p>
        This page explains what PromptVerse stores about you and why. We only keep what we need to
        provide the service.
      </p>

      <Section title="What we store">
        <List
          items={[
            'Account details: your name and email address. Passwords are stored as a secure hash, never in plain text. If you sign in with Google, we receive your name and email from Google.',
            'What you add: brand names, websites, competitors, categories and prompts.',
            'Results: the AI answers, rankings and citations collected when you run an analysis.',
            'Billing records: your plan, credit balance and credit history.',
          ]}
        />
      </Section>

      <Section title="How we use it">
        <List
          items={[
            'To run your analyses and show your reports.',
            'To send account emails, such as email verification, password resets and notices about scheduled runs.',
            'To keep the service secure and working.',
          ]}
        />
        <p>We do not sell your data.</p>
      </Section>

      <Section title="Services we rely on">
        <List
          items={[
            'AI platforms (such as OpenAI, Google, Anthropic and Perplexity) receive the prompts we run for you, so they can answer them.',
            'Stripe processes payments. Your card details go to Stripe; we never see or store them.',
            'Hosting and email delivery providers store and send data on our behalf.',
          ]}
        />
      </Section>

      <Section title="Cookies">
        <p>
          We use cookies only to keep you signed in. We don’t use advertising or tracking cookies.
          Your light/dark theme choice is saved in your browser’s local storage.
        </p>
      </Section>

      <Section title="Shared reports">
        <p>
          If you create a share link for a report, anyone with that link can view the report until
          you revoke it.
        </p>
      </Section>

      <Section title="Keeping and deleting data">
        <p>
          We keep your data while your account exists. You can update your name in Settings. To
          delete your account and its data, contact us and we’ll take care of it.
        </p>
      </Section>

      <Contact />
    </LegalShell>
  );
}
