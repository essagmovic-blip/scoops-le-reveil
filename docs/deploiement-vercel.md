# Guide de Déploiement Vercel — SCOOPS LE REVEIL & AgroFlux

Ce projet unique héberge à la fois :
1. **La vitrine publique** : `scoopslereveil.com` (et `www.scoopslereveil.com`)
2. **L'application interne AgroFlux** : `scoopslereveil.app` (et `www.scoopslereveil.app`)

Le `middleware.ts` détecte automatiquement le nom de domaine appelé et affiche la vitrine ou redirige directement vers l'espace de connexion AgroFlux.

---

## Étape 1 : Importer le projet sur Vercel

1. Rendez-vous sur [vercel.com](https://vercel.com) et connectez-vous.
2. Cliquez sur **Add New...** → **Project**.
3. Importez votre dépôt GitHub / GitLab lié à ce code.
4. Framework Preset : **Next.js** (détecté automatiquement).
5. Root Directory : `./` (la racine).

---

## Étape 2 : Renseigner les Variables d'Environnement sur Vercel

Dans la section **Environment Variables** du projet sur Vercel, ajoutez les variables suivantes :

| Clé | Valeur | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://ktlumornhwfuftoqrhxe.supabase.co` | URL de votre projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_6EhYLUCWgCZ6OjDxMHit2A_0-dj0pEW` | Clé publique anonyme Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | *(copiez la valeur présente dans votre .env.local)* | Clé secrète d'administration (serveur) |
| `ADMIN_USERNAME` | `MOVIC` | Identifiant administrateur |
| `ADMIN_PASSWORD` | `1358` | Mot de passe administrateur |
| `PROVENDERIE_DELETE_PASSWORD` | `1385` | Mot de passe de confirmation suppression provenderie |
| `PUBLIC_SITE_URL` | `https://scoopslereveil.com` | URL de la vitrine pour les redirections |
| `PUBLIC_SITE_HOSTS` | `scoopslereveil.com,www.scoopslereveil.com` | Domaines associés à la vitrine |
| `APP_SITE_HOSTS` | `scoopslereveil.app,www.scoopslereveil.app` | Domaines associés à AgroFlux |

Cliquez ensuite sur **Deploy**.

---

## Étape 3 : Associer les Deux Domaines au même Projet Vercel

Une fois le déploiement terminé :

1. Allez dans **Settings** → **Domains** de votre projet Vercel.
2. Ajoutez le domaine de la vitrine :
   - `scoopslereveil.com`
   - `www.scoopslereveil.com` (redirige vers `scoopslereveil.com` ou inversement)
3. Ajoutez le domaine de l'application AgroFlux :
   - `scoopslereveil.app`
   - `www.scoopslereveil.app`
4. Configurez vos enregistrements DNS chez votre registrar (GoDaddy, Namecheap, OVH, Hostinger, etc.) selon les instructions fournies par Vercel (enregistrements A et CNAME).

---

## Résultat final en production

- Tout visiteur qui tape **`https://scoopslereveil.com`** arrive sur la vitrine commerciale moderne (activités, commandes, suivi, contact). Aucun bouton d'accès AgroFlux n'est visible.
- Tout membre qui tape **`https://scoopslereveil.app`** arrive instantanément sur la page de connexion sécurisée d'AgroFlux.
- Les deux partagent la même base de données **Supabase** en temps réel.
