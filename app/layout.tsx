import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SCOOPS LE REVEIL — Agriculture intégrée',
  description: 'SCOOPS LE REVEIL développe des activités d’élevage, de transformation et de valorisation des produits agricoles locaux. AgroFlux est son espace interne de pilotage.'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
