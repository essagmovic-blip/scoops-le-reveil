import type jsPDF from 'jspdf';

export const PDF_COMPANY = {
  name: 'SCOOPS LE REVEIL',
  product: 'AgroFlux · Gestion intégrée',
  address: 'Nkolbisson, Yaoundé · Cameroun',
  phone: '+237 6 70 00 12 45',
  logoPath: '/scoops-le-reveil-logo.jpg',
} as const;

type PdfLetterheadOptions = {
  title: string;
  reference?: string;
  context?: string[];
};

let logoPromise: Promise<string | undefined> | undefined;

async function loadLogoDataUrl() {
  if (!logoPromise) {
    logoPromise = fetch(PDF_COMPANY.logoPath)
      .then((response) => response.ok ? response.blob() : Promise.reject(new Error('Logo indisponible')))
      .then(blobToDataUrl)
      .catch(() => undefined);
  }
  return logoPromise;
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Logo illisible'));
    reader.onerror = () => reject(reader.error ?? new Error('Logo illisible'));
    reader.readAsDataURL(blob);
  });
}

/** En-tête commun des PDF jsPDF. Retourne la première ligne disponible pour le corps. */
export async function addPdfLetterhead(doc: jsPDF, options: PdfLetterheadOptions) {
  const logo = await loadLogoDataUrl();
  if (logo) doc.addImage(logo, 'JPEG', 14, 10, 28, 22);
  doc.setTextColor(25, 56, 46);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(PDF_COMPANY.name, 48, 16);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(PDF_COMPANY.product, 48, 22);
  doc.text(PDF_COMPANY.address, 48, 27);
  doc.text(PDF_COMPANY.phone, 48, 32);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(options.title.toUpperCase(), 196, 16, { align: 'right' });
  if (options.reference) {
    doc.setFontSize(10);
    doc.text(options.reference, 196, 23, { align: 'right' });
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  (options.context ?? []).slice(0, 3).forEach((line, index) => doc.text(line, 196, 30 + index * 5, { align: 'right' }));

  doc.setDrawColor(155, 231, 137);
  doc.setLineWidth(1);
  doc.line(14, 42, 196, 42);
  doc.setTextColor(29, 46, 39);
  return 52;
}

/** Pied de page commun, appliqué à toutes les pages après les tableaux. */
export function addPdfFooter(doc: jsPDF, text = 'Document généré par AgroFlux · SCOOPS LE REVEIL') {
  const pageCount = doc.getNumberOfPages();
  const pageHeight = doc.internal.pageSize.getHeight();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(220, 230, 220);
    doc.setLineWidth(0.3);
    doc.line(14, pageHeight - 17, 196, pageHeight - 17);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(105, 125, 113);
    doc.text(text, 14, pageHeight - 10);
    doc.text(`Page ${page} / ${pageCount}`, 196, pageHeight - 10, { align: 'right' });
  }
}

export type PrintLetterheadOptions = { title: string; reference?: string; context?: string[] };

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[char] ?? char));
}

/** Variante HTML du même en-tête pour les bulletins et bons imprimables. */
export function printLetterheadMarkup(options: PrintLetterheadOptions) {
  const context = (options.context ?? []).map((line) => `<div class="muted">${escapeHtml(line)}</div>`).join('');
  return `<header class="agroflux-letterhead"><div class="agroflux-brand"><img src="${PDF_COMPANY.logoPath}" alt="${PDF_COMPANY.name}"><div><div class="brand-name">${PDF_COMPANY.name}</div><div class="muted">${PDF_COMPANY.product}<br>${PDF_COMPANY.address}<br>${PDF_COMPANY.phone}</div></div></div><div class="right"><h1>${escapeHtml(options.title)}</h1>${options.reference ? `<strong>${escapeHtml(options.reference)}</strong>` : ''}${context}</div></header>`;
}

export const printLetterheadStyles = `.agroflux-letterhead{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #9be789;padding-bottom:16px;margin-bottom:22px}.agroflux-brand{display:flex;align-items:flex-start;gap:12px}.agroflux-brand img{width:58px;height:44px;object-fit:contain}.brand-name{font-size:20px;font-weight:800;letter-spacing:-.8px;color:#19382e}.right{text-align:right}.right h1{font-size:22px;margin:0 0 5px;color:#19382e}.muted{color:#738179;font-size:10px;line-height:1.55}`;

export function printFooterMarkup(text = 'Document généré par AgroFlux · SCOOPS LE REVEIL') {
  return `<footer class="agroflux-print-footer"><span>${escapeHtml(text)}</span><span>Page <span class="page-number"></span></span></footer>`;
}

export const printFooterStyles = `.agroflux-print-footer{display:flex;justify-content:space-between;border-top:1px solid #e5ece4;margin-top:55px;padding-top:10px;color:#89968f;font-size:10px}.page-number:after{content:counter(page)}@page{size:A4;margin:15mm}`;
