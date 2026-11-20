import React, { useEffect, useState } from 'react';
import { ProposedStudio } from './components/ProposedStudio.tsx';
import { PrivateInvoiceStudio } from './components/PrivateInvoiceStudio.tsx';
import { MobileBusinessCard } from './components/MobileBusinessCard.tsx';
import { AuthProvider } from './context/AuthContext.tsx';

function getCurrentRoute() {
  if (typeof window === 'undefined') {
    return { path: '/', hash: '' };
  }
  return {
    path: window.location.pathname,
    hash: window.location.hash,
  };
}

export default function App() {
  const [route, setRoute] = useState(getCurrentRoute);

  useEffect(() => {
    const syncRoute = () => setRoute(getCurrentRoute());

    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        if (window.location.pathname !== '/invoice-studio') {
          window.history.pushState({}, '', '/invoice-studio');
          syncRoute();
        }
      }
    };

    window.addEventListener('popstate', syncRoute);
    window.addEventListener('hashchange', syncRoute);
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('popstate', syncRoute);
      window.removeEventListener('hashchange', syncRoute);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const isPrivateInvoiceRoute =
    route.path.startsWith('/invoice-studio') || route.hash === '#invoice-studio';
  const isMobileCardRoute =
    route.path.startsWith('/card') ||
    route.path.startsWith('/mobile-card') ||
    route.hash === '#card';

  return (
    <AuthProvider>
      <div className="relative min-h-screen bg-white text-black font-nexa antialiased">
        {isPrivateInvoiceRoute ? (
          <PrivateInvoiceStudio />
        ) : isMobileCardRoute ? (
          <MobileBusinessCard />
        ) : (
          <ProposedStudio />
        )}
      </div>
    </AuthProvider>
  );
}

