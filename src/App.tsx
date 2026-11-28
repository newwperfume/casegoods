import React, { useEffect, useState } from 'react';
import { ProposedStudio } from './components/ProposedStudio.tsx';
import { PrivateInvoiceStudio } from './components/PrivateInvoiceStudio.tsx';
import { MobileBusinessCard } from './components/MobileBusinessCard.tsx';
import { SconceConceptsModal } from './components/SconceConceptsModal.tsx';
import { KitchenDrawingsViewer } from './components/KitchenDrawingsViewer.tsx';
import { FamilyRoomDrawingsViewer } from './components/FamilyRoomDrawingsViewer.tsx';
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

    window.addEventListener('popstate', syncRoute);
    window.addEventListener('hashchange', syncRoute);

    return () => {
      window.removeEventListener('popstate', syncRoute);
      window.removeEventListener('hashchange', syncRoute);
    };
  }, []);

  const isPrivateInvoiceRoute =
    route.path.startsWith('/invoice-studio') || route.hash === '#invoice-studio';
  const isMobileCardRoute =
    route.path.startsWith('/card') ||
    route.path.startsWith('/mobile-card') ||
    route.hash === '#card';
  const isSconceConceptsRoute =
    route.path.startsWith('/sconce-concepts') || route.hash === '#sconce-concepts';
  const isKitchenDrawingsRoute =
    route.path.startsWith('/kitchen-drawings') || route.hash === '#kitchen-drawings';
  const isFamilyRoomDrawingsRoute =
    route.path.startsWith('/family-room-drawings') || route.hash === '#family-room-drawings';

  return (
    <AuthProvider>
      <div className="relative min-h-screen bg-white text-black font-nexa antialiased">
        {isPrivateInvoiceRoute ? (
          <PrivateInvoiceStudio />
        ) : isMobileCardRoute ? (
          <MobileBusinessCard />
        ) : isSconceConceptsRoute ? (
          <SconceConceptsModal standalone />
        ) : isKitchenDrawingsRoute ? (
          <KitchenDrawingsViewer />
        ) : isFamilyRoomDrawingsRoute ? (
          <FamilyRoomDrawingsViewer />
        ) : (
          <ProposedStudio />
        )}
      </div>
    </AuthProvider>
  );
}

