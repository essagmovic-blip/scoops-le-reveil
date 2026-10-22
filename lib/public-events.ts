export type PublicEventType = 'Actualité' | 'Campagne' | 'Recrutement' | 'Événement' | 'Annonce';
export type PublicEventStatus = 'Brouillon' | 'Publié' | 'Archivé';

export type PublicEvent = {
  id: string;
  title: string;
  type: PublicEventType;
  status: PublicEventStatus;
  date: string;
  location: string;
  excerpt: string;
  body: string;
  images: string[];
  ctaLabel: string;
  ctaUrl: string;
  featured: boolean;
  createdAt: string;
  updatedAt: string;
};
