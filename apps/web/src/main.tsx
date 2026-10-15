import { Analytics } from '@vercel/analytics/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import { Providers } from './app/providers';
import { router } from './app/router';
import { maskSecretUrl } from './lib/maskSecretUrl';
import './index.css';

const root = document.getElementById('root');
if (!root) throw new Error('#root element missing from index.html');

createRoot(root).render(
  <StrictMode>
    <Providers>
      <RouterProvider router={router} />
    </Providers>
    {/* F-34: Vercel Analytics, as in v1. Sends nothing in local dev. Share links and one-time
        `?token=` values are credentials, so they are masked before anything is sent (8.3). */}
    <Analytics beforeSend={(event) => ({ ...event, url: maskSecretUrl(event.url) })} />
  </StrictMode>,
);
