export function formatFCFA(value: number, compact = false) {
  if (compact && Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1).replace('.', ',')} M FCFA`;
  }
  if (compact && Math.abs(value) >= 1_000) {
    return `${Math.round(value / 1_000)} k FCFA`;
  }
  return `${new Intl.NumberFormat('fr-FR').format(Math.round(value))} FCFA`;
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat('fr-FR').format(value);
}

export function formatDate(value: string) {
  const parts = value.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return value;
}

export function formatPercent(value: number) {
  return `${value.toFixed(1).replace('.', ',')} %`;
}
