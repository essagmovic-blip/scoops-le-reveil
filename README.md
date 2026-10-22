# AgroFlux

SaaS privé de gestion intégrée appartenant à SCOOPS LE REVEIL : élevages, provenderie, unité de fabrication de produits bio, pressoir à huile, magasin, ventes et facturation. Les comptes sont créés uniquement par l’administrateur.

## Phase actuelle

Cette première version est une interface fonctionnelle avec données locales fictives : dashboard, navigation responsive, opérations, stock, factures et création de facture.

## Règle d’architecture métier

Chaque unité possède sa propre gestion : factures, stock, charges, production et résultats. Le seul lien opérationnel entre unités est un mouvement inter-unités, enregistré comme une sortie dans l’unité source et une entrée dans l’unité destinataire.

## Démarrer

```bash
npm install
```

Copier `.env.example` vers `.env.local`, puis renseigner les variables serveur :

```env
ADMIN_USERNAME=votre_identifiant
ADMIN_PASSWORD=votre_mot_de_passe
```

Lancer ensuite :

```bash
npm run dev
```

Puis ouvrir [http://localhost:3000](http://localhost:3000). La page `/` est la landing page et `/connexion` ouvre l’accès administrateur.

## Suite prévue

1. Connecter Supabase (schéma multi-tenant, RLS et Storage).
2. Ajouter l’authentification et les permissions par département.
3. Ajouter les tests unitaires, intégration et E2E.
4. Ajouter la génération PDF et le déploiement Vercel.
