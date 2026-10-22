import { redirect } from 'next/navigation';

/** Ancienne adresse conservée pour les favoris historiques. */
export default function LegacyCratesPage() {
  redirect('/stocks/ferme');
}
