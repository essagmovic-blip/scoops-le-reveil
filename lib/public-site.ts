export type PublicPromoVideo = { id: string; title: string; description: string; youtubeUrl: string; active: boolean; order: number };
export type PublicSiteActivity = { id: string; number: string; title: string; text: string; image: string; iconKey: string; tone: string };

const YOUTUBE_HOSTS = new Set(['youtube.com', 'm.youtube.com', 'youtu.be', 'youtube-nocookie.com']);

function cleanYouTubeVideoId(value: string) {
  return /^[A-Za-z0-9_-]{6,}$/.test(value) ? value : '';
}

export function getYouTubeVideoId(value: string) {
  const raw = value.trim();
  if (!raw) return '';
  const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(candidate);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (!YOUTUBE_HOSTS.has(host)) return '';
    if (host === 'youtu.be') return cleanYouTubeVideoId(url.pathname.split('/').filter(Boolean)[0] ?? '');
    const queryId = cleanYouTubeVideoId(url.searchParams.get('v') ?? '');
    if (queryId) return queryId;
    const pathMatch = url.pathname.match(/^\/(?:embed|shorts|live)\/([^/?#]+)/i);
    return cleanYouTubeVideoId(pathMatch?.[1] ?? '');
  } catch {
    return '';
  }
}

export function getYouTubeEmbedUrl(value: string) {
  const videoId = getYouTubeVideoId(value);
  return videoId ? `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1` : '';
}
export type PublicSiteCommitment = { id: string; title: string; text: string; iconKey: string };
export type PublicSiteContent = { heroImages: string[]; logo: string; heroEyebrow: string; heroTitle: string; heroSubtitle: string; heroIntro: string; city: string; activities: PublicSiteActivity[]; commitments: PublicSiteCommitment[]; footer: { email: string; addresses: string[]; phones: string[]; hours: string; mapEmbedUrl: string; facebook: string; whatsapp: string; address?: string; phone?: string } };

export const DEFAULT_PUBLIC_SITE_CONTENT: PublicSiteContent = {
  heroImages: ['/unit-poulets-bio.jpg', '/unit-provenderie.jpg', '/unit-produits-bio.jpg', '/unit-pressoir.jpg', '/unit-magasin-central.jpg', '/unit-chevrerie.jpg'], 
  logo: '/scoops-le-reveil-logo.jpg',
  heroEyebrow: 'SCOOPS LE REVEIL · Obala, Cameroun',
  heroTitle: 'Produire localement.',
  heroSubtitle: 'Transformer avec exigence.',
  heroIntro: 'SCOOPS LE REVEIL développe une agriculture intégrée, fondée sur l’élevage de poulets bio, la chèvrerie, la transformation, la valorisation des produits locaux et le travail collectif.',
  city: 'Obala, Cameroun',
  activities: [
    { id: 'poulets', number: '01', title: 'Élevage de poulets bio', text: 'Une conduite attentive des bandes, de l’alimentation, de la santé et de la commercialisation en filière bio.', image: '/unit-poulets-bio.jpg', iconKey: 'PawPrint', tone: 'green' },
    { id: 'chevrerie', number: '02', title: 'Chèvrerie', text: 'Un cheptel caprin suivi avec soin : animaux, reproduction, santé, alimentation et productions.', image: '/unit-chevrerie.jpg', iconKey: 'Sprout', tone: 'blue' },
    { id: 'provenderie', number: '03', title: 'Provenderie', text: 'La fabrication d’aliments adaptés aux élevages, à partir de matières premières suivies.', image: '/unit-provenderie.jpg', iconKey: 'Wheat', tone: 'orange' },
    { id: 'bio', number: '04', title: 'Produits bio', text: 'La transformation de matières naturelles en préparations utiles aux élevages et à l’agriculture.', image: '/unit-produits-bio.jpg', iconKey: 'FlaskConical', tone: 'purple' },
    { id: 'pressoir', number: '05', title: 'Pressoir à huile', text: 'La valorisation des graines locales en huiles et tourteaux, avec une attention portée aux rendements.', image: '/unit-pressoir.jpg', iconKey: 'Droplets', tone: 'yellow' },
    { id: 'stocks', number: '06', title: 'Magasin central', text: 'Un espace principalement consacré aux produits et machines agricoles, avec une gestion rigoureuse des stocks.', image: '/unit-magasin-central.jpg', iconKey: 'Package', tone: 'blue' },
  ],
  commitments: [
    { id: 'quality', title: 'Qualité et traçabilité', text: 'Chaque activité est suivie avec méthode, de l’approvisionnement jusqu’au produit ou service livré.', iconKey: 'ShieldCheck' },
    { id: 'cooperation', title: 'Des activités qui se complètent', text: 'Les unités coopèrent sans perdre leur autonomie, pour mieux valoriser les ressources de la société.', iconKey: 'ArrowLeftRight' },
    { id: 'responsibility', title: 'Une gestion responsable', text: 'Les coûts, les stocks et les résultats sont suivis pour soutenir des décisions durables.', iconKey: 'CircleDollarSign' },
  ],
  footer: { email: '', addresses: ['Obala, Centre, Cameroun'], phones: ['+237 6 70 00 12 45'], hours: 'Lundi - Vendredi : 8h00 - 17h30', mapEmbedUrl: '', facebook: '', whatsapp: '' },
};
