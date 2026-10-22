import type { Metadata } from 'next';
import { LoginView } from '@/components/login-view';

export const metadata: Metadata = {
  title: 'Connexion — SCOOPS LE REVEIL',
  description: 'Accédez à l’espace sécurisé de gestion des unités de SCOOPS LE REVEIL.',
};

export default function LoginPage() {
  return <LoginView />;
}
