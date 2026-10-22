# Cahier des charges fonctionnel — Ferme de poulets de chair

**Produit :** AgroFlux  
**Société propriétaire :** SCOOPS LE REVEIL  
**Périmètre :** unité « Ferme d’élevage de poulets de chair »  
**Version :** 0.1 — cadrage fonctionnel  
**Date :** 12 août 2026

> Ce document décrit le premier module métier à développer dans AgroFlux. Les autres unités de SCOOPS LE REVEIL — provenderie, produits bio, pressoir à huile, magasin central et chèvrerie — restent autonomes. Le seul lien fonctionnel entre elles est le mouvement inter-unités.

## Table des matières

1. [Contexte, objectifs et hypothèses](#1-contexte-objectifs-et-hypothèses)
2. [Périmètre de l’unité ferme](#2-périmètre-de-lunité-ferme)
3. [Utilisateurs et responsabilités](#3-utilisateurs-et-responsabilités)
4. [Modules fonctionnels](#4-modules-fonctionnels)
5. [Liste des écrans](#5-liste-des-écrans)
6. [Modèle de données](#6-modèle-de-données)
7. [Logique de calcul](#7-logique-de-calcul)
8. [Parcours utilisateur de bout en bout](#8-parcours-utilisateur-de-bout-en-bout)
9. [Fonctionnement hors ligne et synchronisation](#9-fonctionnement-hors-ligne-et-synchronisation)
10. [Contraintes techniques et non fonctionnelles](#10-contraintes-techniques-et-non-fonctionnelles)
11. [Phasage de développement](#11-phasage-de-développement)
12. [Questions à confirmer](#12-questions-à-confirmer)

---

## 1. Contexte, objectifs et hypothèses

### 1.1 Contexte métier

SCOOPS LE REVEIL exploite une ferme de poulets de chair organisée par **bâtiments** et par **bandes**. Une bande représente un lot de poussins suivi depuis son arrivée jusqu’à sa vente et sa clôture financière.

L’objectif du module est de remplacer les cahiers, fichiers dispersés et calculs manuels par un outil simple, mobile-first, utilisable par le responsable de ferme et le personnel de terrain.

Le logiciel doit fournir deux niveaux de lecture :

- **vue opérationnelle :** saisie rapide du suivi du jour par bâtiment ;
- **vue de gestion :** indicateurs zootechniques, sanitaires et financiers par bande, bâtiment et période.

### 1.2 Objectifs

Le module doit permettre de :

1. connaître à tout moment l’effectif réel par bâtiment et par bande ;
2. suivre la mortalité, l’aliment, l’eau, le poids et l’ambiance ;
3. comparer le réel à une fiche théorique par souche ;
4. tracer les vaccinations, traitements et délais d’attente ;
5. gérer le stock propre à l’unité ferme ;
6. recevoir des aliments ou produits par mouvements inter-unités ;
7. vendre les poulets et facturer depuis l’unité ferme ;
8. calculer le coût de revient et la rentabilité d’une bande ;
9. fonctionner sans connexion permanente ;
10. produire des rapports exploitables par la direction.

### 1.3 Hypothèses explicites

- **[HYPOTHÈSE]** La première version concerne les poulets de chair uniquement. Les pondeuses ne sont pas incluses dans le MVP.
- **[HYPOTHÈSE]** La société opère au Cameroun et utilise le FCFA. La devise doit rester configurable.
- **[HYPOTHÈSE]** La TVA, les taxes, la CNPS et les règles de paie ne doivent pas être codées en dur. Elles devront être validées par le responsable administratif ou le comptable de SCOOPS LE REVEIL.
- **[HYPOTHÈSE]** La ferme peut comporter plusieurs bâtiments et plusieurs sites à terme, même si le MVP peut démarrer sur un seul site.
- **[HYPOTHÈSE]** Le mode de valorisation du stock sera le CUMP dans le MVP, sous réserve de validation comptable. FIFO pourra être ajouté ensuite.
- **[HYPOTHÈSE]** Les ventes peuvent concerner des poulets vivants. La vente de poulets abattus sera prévue comme extension activable.
- **[HYPOTHÈSE]** Le calcul de paie sera développé après la mise en place fiable du pointage et des données RH. Il ne doit pas bloquer le démarrage de la gestion avicole.

---

## 2. Périmètre de l’unité ferme

### 2.1 Autonomie de l’unité

L’unité ferme possède ses propres :

- bandes ;
- bâtiments ;
- stocks ;
- consommations ;
- dépenses ;
- ventes ;
- factures ;
- utilisateurs autorisés ;
- rapports ;
- coûts et résultats.

Toutes les tables opérationnelles de la ferme portent un `unit_id` identifiant l’unité « Ferme poulets ».

### 2.2 Lien avec les autres unités

Aucune unité ne modifie directement le stock ou les factures de la ferme.

Les échanges se font uniquement par **mouvement inter-unités** :

- Provenderie → Ferme : aliment ;
- Produits bio → Ferme : complément ou produit naturel ;
- Magasin central → Ferme : matériel, médicaments, consommables ;
- Ferme → Magasin central : poulets disponibles pour la vente, si ce flux est retenu ;
- Ferme → autre unité : uniquement si une décision de gestion le prévoit.

Un mouvement produit au minimum :

1. une sortie dans l’unité source ;
2. une entrée dans l’unité destinataire ;
3. une référence de transfert commune ;
4. une quantité et une unité de mesure ;
5. une date et un responsable ;
6. un statut `EN TRANSIT`, `RÉCEPTIONNÉ` ou `ANNULÉ`.

---

## 3. Utilisateurs et responsabilités

La création de comptes est privée. Aucun utilisateur ne s’inscrit seul.

L’administrateur de SCOOPS LE REVEIL crée les comptes et attribue l’unité ainsi que les accès.

### 3.1 Rôles concernés

- **Administrateur :** accès complet à la société et à toutes les unités ;
- **Directeur / Gérant :** supervision, validation et rapports ;
- **Responsable de ferme :** gestion des bâtiments, bandes, suivi quotidien et clôture ;
- **Chef d’équipe :** saisie quotidienne et validation terrain ;
- **Agent d’élevage :** saisie limitée aux données opérationnelles autorisées ;
- **Vétérinaire / responsable sanitaire :** vaccinations, traitements et carnet sanitaire ;
- **Magasinier :** stocks de la ferme et mouvements ;
- **Commercial :** ventes et factures de l’unité ferme ;
- **RH / paie :** employés, pointage, absences et paie ;
- **Lecteur :** consultation des informations autorisées.

La matrice détaillée des droits par rôle sera définie dans un document d’habilitation séparé. Le module doit néanmoins prévoir les contrôles d’accès dès la conception.

---

## 4. Modules fonctionnels

### 4.1 Tableau de bord de la ferme

**Objectif métier :** donner au responsable une lecture immédiate de l’état des bâtiments, bandes, stocks, alertes et performances.

#### Règles détaillées

- Afficher les bandes en cours et leur âge en jours.
- Afficher l’effectif initial, l’effectif restant, les morts, les ventes et les transferts.
- Afficher les bâtiments occupés, vides et en vide sanitaire.
- Afficher les alertes sanitaires, d’ambiance et de stock.
- Afficher la consommation d’aliment et d’eau du jour et du cumul de bande.
- Afficher le poids moyen, le GMQ, l’IC et la mortalité cumulée.
- Afficher les commandes en attente et mouvements non réceptionnés.
- Afficher les ventes et dépenses de l’unité ferme uniquement.
- Permettre un filtre par date, bande et bâtiment.

#### Critères d’acceptation

- Le responsable voit en moins de 5 secondes les bandes actives et les alertes importantes.
- Les indicateurs du dashboard sont calculés uniquement à partir des données de l’unité ferme.
- Un clic sur une alerte ouvre directement l’écran concerné.

### 4.2 Gestion des bâtiments

**Objectif métier :** connaître l’état, la capacité et l’historique sanitaire de chaque bâtiment.

#### Règles détaillées

- Les bâtiments sont créés librement : A, B, C, ou un autre code.
- Chaque bâtiment possède un nom, une capacité, une localisation et un statut.
- Statuts : `VIDE`, `OCCUPÉ`, `EN VIDE SANITAIRE`, `HORS SERVICE`.
- Un bâtiment occupé est lié à une ou plusieurs allocations de bande.
- Un bâtiment ne peut recevoir une nouvelle bande pendant le vide sanitaire.
- La durée du vide sanitaire est paramétrable par l’administrateur ou le responsable.
- Chaque nettoyage et désinfection est enregistré avec date, opérateur, produit et observation.
- Le logiciel calcule la date théorique de fin de vide sanitaire.

#### Critères d’acceptation

- Il est impossible d’affecter une bande à un bâtiment en vide sanitaire non terminé.
- Le statut d’un bâtiment passe automatiquement à `VIDE` lorsque le dernier effectif est à zéro.
- L’historique des bandes et désinfections est consultable depuis la fiche bâtiment.

### 4.3 Gestion des bandes

**Objectif métier :** gérer un lot de poussins du démarrage à la clôture.

#### Règles détaillées

- Une bande possède une référence unique.
- Champs de démarrage : date, nombre de poussins, souche, type de cycle, couvoir et numéro de lot d’incubation.
- Types de cycle paramétrables : préchauffé 21 jours, poulet table 45 jours, poulet 60 jours ou autre.
- Une bande peut être répartie dans plusieurs bâtiments.
- Une bande possède un statut : `PLANIFIÉE`, `EN COURS`, `PRÊTE À VENDRE`, `CLÔTURÉE`, `ANNULÉE`.
- Le transfert de sujets entre bâtiments conserve la même bande et le même âge.
- La clôture est autorisée lorsque l’effectif est nul ou lorsqu’un responsable force la clôture avec justification.
- La clôture fige les indicateurs zootechniques et financiers de la bande.

#### Critères d’acceptation

- Une bande peut être créée puis répartie dans plusieurs bâtiments.
- Le système refuse une répartition supérieure à l’effectif disponible.
- Une bande clôturée reste consultable et ne peut plus recevoir de saisie quotidienne sans réouverture autorisée.

### 4.4 Transferts de sujets entre bâtiments

**Objectif métier :** tracer les changements de bâtiment sans perdre l’âge, la bande ou l’effectif réel.

#### Règles détaillées

- Le transfert indique la bande, le bâtiment source, le bâtiment destination, la quantité, la date et le motif.
- La destination reprend l’âge de la bande à la date du transfert.
- Le nombre disponible dans le bâtiment source est contrôlé.
- Si la quantité transférée correspond à l’effectif source, le bâtiment source devient vide.
- Un transfert ne peut pas être supprimé après validation ; il est annulé par une opération inverse tracée.

#### Critères d’acceptation

- Après transfert, les effectifs source et destination sont recalculés immédiatement.
- La bande reste unique et son historique contient le transfert.
- Une modification d’un transfert validé exige une justification et laisse une trace d’audit.

### 4.5 Saisie quotidienne par bâtiment

**Objectif métier :** permettre une saisie terrain rapide, même avec un téléphone et une connexion instable.

#### Règles détaillées

Pour chaque bâtiment actif, saisir :

- date ;
- mortalité du jour et cause : maladie, écrasement, chaleur, accident, autre ;
- aliment consommé en kg ;
- eau consommée en litres ;
- sujets vendus et poids moyen vendu ;
- température minimale et maximale ;
- humidité ;
- observation libre ;
- agent ayant effectué la saisie.

Le système calcule :

- effectif restant ;
- mortalité cumulée ;
- poids total vendu ;
- biomasse estimée ;
- GMQ ;
- IC ;
- écarts par rapport à la fiche théorique.

#### Critères d’acceptation

- Un agent peut saisir le suivi d’un bâtiment en moins de deux minutes sur mobile.
- L’effectif restant ne peut jamais devenir négatif.
- Une saisie dupliquée pour la même bande, le même bâtiment et la même date est bloquée ou proposée en modification.

### 4.6 Fiche théorique versus réel

**Objectif métier :** comparer la performance réelle à une référence par souche et par âge.

#### Règles détaillées

- Créer des fiches théoriques par souche et type de cycle.
- Les fiches couvrent au minimum J1 à J60.
- Paramètres : poids théorique, aliment/jour, eau/jour, mortalité cible et seuils d’ambiance.
- Les valeurs sont modifiables par un utilisateur autorisé.
- Afficher réel, théorique, écart absolu et écart en pourcentage.
- Déclencher une alerte si l’écart dépasse le seuil configuré.

#### Critères d’acceptation

- Le responsable peut comparer une bande réelle à la fiche de sa souche.
- Un changement de fiche théorique ne modifie pas l’historique déjà clôturé.
- Le graphique affiche clairement les écarts de poids, d’aliment et d’eau.

### 4.7 Module sanitaire et vétérinaire

**Objectif métier :** assurer la traçabilité sanitaire de chaque bande et éviter une vente interdite pendant un délai d’attente.

#### Règles détaillées

- Créer un programme de vaccination par souche ou type de cycle.
- Prévoir une planification par âge : par exemple Newcastle ou Gumboro, à valider avec le vétérinaire.
- Enregistrer date, produit, dose, voie, opérateur et observation.
- Enregistrer les traitements et ordonnances.
- Chaque produit sanitaire peut avoir un délai d’attente configurable.
- Calculer la date minimale autorisée de vente.
- Bloquer ou soumettre à validation toute vente réalisée avant la fin du délai d’attente.
- Tenir un carnet sanitaire par bande, bâtiment et période.
- Enregistrer les visiteurs et les opérations de biosécurité.

#### Critères d’acceptation

- Une vaccination planifiée apparaît comme `À faire`, `Réalisée`, `En retard` ou `Annulée`.
- Une vente avant la date autorisée affiche une alerte bloquante.
- Le carnet sanitaire exporté conserve l’historique des traitements et opérateurs.

### 4.8 Stock propre à la ferme

**Objectif métier :** gérer le stock consommé par l’unité ferme sans mélanger celui de la provenderie ou du magasin central.

#### Règles détaillées

- Le catalogue d’articles est évolutif.
- Catégories initiales : aliment, matériel élevage, médicament, consommable.
- Un article possède un nom, une unité, un seuil d’alerte, un prix moyen et un statut actif.
- Une entrée reçue par mouvement inter-unités augmente le stock ferme.
- Une sortie liée à une bande et un bâtiment diminue le stock ferme.
- Les sorties d’aliment doivent être rattachées à une bande et un bâtiment.
- Les inventaires et ajustements exigent un motif.
- Les produits avec lot ou date d’expiration doivent être traçables.
- La valorisation MVP utilise le CUMP **[HYPOTHÈSE]**.

#### Critères d’acceptation

- Le stock ferme ne diminue jamais lors d’une simple consultation d’une autre unité.
- Toute sortie de stock affiche la bande et le bâtiment concernés.
- Un seuil atteint déclenche une alerte dans le dashboard ferme.

### 4.9 Commandes et approvisionnement

**Objectif métier :** suivre les commandes passées à la provenderie, au magasin central ou à des fournisseurs externes.

#### Règles détaillées

- Une commande possède un numéro automatique, une date, un fournisseur et une unité source.
- Fournisseurs catégorisés : provenderie, matériel, vétérinaire, autre.
- Statuts : `BROUILLON`, `ENVOYÉE`, `PARTIELLEMENT REÇUE`, `REÇUE TOTALE`, `ANNULÉE`.
- La réception est saisie selon les quantités réellement reçues.
- L’écart commandé/reçu est conservé.
- Une réception met à jour le stock de la ferme ou crée un mouvement inter-unités en attente de réception.
- Une commande peut être rattachée à une bande pour le coût de revient.

#### Critères d’acceptation

- Une réception partielle ne clôture pas automatiquement la commande.
- Une réception validée génère le mouvement stock correspondant.
- L’historique est filtrable par fournisseur, bande, période et statut.

### 4.10 Ventes et facturation de la ferme

**Objectif métier :** vendre les produits de la ferme et suivre les paiements dans le périmètre de l’unité ferme.

#### Règles détaillées

- MVP : vente de poulets vivants par tête, lot ou poids selon le mode choisi.
- Extension : poulets abattus par kg, caisse ou unité.
- Une facture possède `unit_id = ferme_poulets`.
- Statuts : `BROUILLON`, `ENVOYÉE`, `PAYÉE`, `ACOMPTE`, `IMPAYÉE`, `EN RETARD`, `ANNULÉE`.
- Plusieurs acomptes peuvent être enregistrés.
- Modes de paiement : espèces, virement, Mobile Money **[HYPOTHÈSE À CONFIRMER]**.
- Une vente diminue l’effectif de la bande concernée.
- Une vente est bloquée si l’effectif disponible ou le délai sanitaire ne le permet pas.
- La TVA reste configurable et ne doit pas être imposée sans validation fiscale.

#### Critères d’acceptation

- Une facture de la ferme ne peut pas modifier directement la facturation d’une autre unité.
- Le solde est recalculé après chaque acompte.
- Une vente validée met à jour l’effectif de la bande et les indicateurs de rendement.

### 4.11 Dépenses de l’unité ferme

**Objectif métier :** connaître le coût réel de l’élevage par bande et par bâtiment.

#### Règles détaillées

- Saisir date, libellé, catégorie, montant, mode de paiement et justificatif.
- Catégories initiales : carburant, vétérinaire, électricité, eau, transport, maintenance, main-d’œuvre, autre.
- Une dépense peut être rattachée à une bande et/ou un bâtiment.
- Les dépenses non affectées restent au niveau de l’unité ferme et sont réparties selon une règle validée.
- Les dépenses supprimées sont annulées et non effacées lorsque la période est clôturée.

#### Critères d’acceptation

- Une dépense saisie pour la ferme n’apparaît pas dans le résultat d’une autre unité.
- Une dépense affectée à une bande entre dans son coût de revient.
- Un justificatif peut être ajouté depuis un téléphone.

### 4.12 RH, pointage et paie

**Objectif métier :** suivre les personnes affectées à la ferme et préparer une paie calculée à partir du pointage.

#### Règles détaillées

- Une fiche employé comprend matricule, identité, téléphone, photo, date d’embauche, poste, statut, salaire et type de paiement.
- Le bâtiment d’affectation est facultatif et historisé.
- Les documents CNI et contrat sont stockés avec accès restreint.
- Le pointage QR génère des événements d’entrée et de sortie.
- Les mouvements multiples de la journée sont autorisés.
- Les statuts incluent présent, absent, retard, permission, congé, férié et maladie.
- La clôture mensuelle calcule gains, retenues, avances, CNPS et salaire net.
- Les règles légales de paie doivent être validées avant mise en production.

#### Critères d’acceptation

- Les heures travaillées sont calculées à partir des scans enregistrés.
- Une absence validée impacte le calcul de paie selon la règle configurée.
- Une paie clôturée devient non modifiable sans réouverture autorisée.

### 4.13 Coût de revient et rentabilité

**Objectif métier :** mesurer la rentabilité réelle d’une bande, et pas seulement son chiffre d’affaires.

#### Règles détaillées

Le coût de revient d’une bande comprend :

- aliment consommé ;
- eau ;
- médicaments et vaccins ;
- main-d’œuvre affectée ;
- quote-part du bâtiment et du matériel ;
- transport ;
- énergie ;
- autres dépenses affectées.

Le système calcule :

- coût total de bande ;
- coût par sujet vendu ;
- coût par kg vendu ;
- chiffre d’affaires ;
- marge brute ;
- marge nette estimée ;
- comparaison avec les autres bandes et bâtiments.

#### Critères d’acceptation

- Le responsable peut ouvrir une clôture de bande avec une synthèse zootechnique et financière.
- Les coûts rattachés à une autre unité sont exclus, sauf mouvement inter-unités enregistré.
- Le coût au kg est recalculé après chaque nouvelle dépense ou vente validée.

### 4.14 Reporting et exports

**Objectif métier :** fournir à la direction des informations fiables et exportables.

#### Règles détaillées

Rapports MVP :

- bandes en cours ;
- bâtiments et vide sanitaire ;
- suivi quotidien ;
- mortalité ;
- aliment et eau ;
- stock ferme ;
- ventes et paiements ;
- dépenses ;
- coût de revient ;
- clôture de bande.

Rapports avancés :

- carnet sanitaire PDF ;
- rapport CAP journalier ;
- rapport RH ;
- paie mensuelle ;
- comparatif de bandes ;
- export Excel.

#### Critères d’acceptation

- Les rapports sont filtrables par bande, bâtiment, période et unité ferme.
- Un export contient la date de génération et l’utilisateur générateur.
- Les données exportées correspondent aux données visibles à l’écran.

---

## 5. Liste des écrans

Chaque écran suit le gabarit : **Nom / Objectif / Champs / Actions / Règles de validation**.

### 5.1 Écrans de navigation

| Écran | Objectif | Actions principales |
|---|---|---|
| Dashboard ferme | Voir l’état global de l’unité | Filtrer, ouvrir une alerte, accéder à une bande |
| Liste des bâtiments | Voir les capacités et états | Créer, modifier, ouvrir, lancer vide sanitaire |
| Fiche bâtiment | Consulter l’historique d’un bâtiment | Affecter, transférer, enregistrer nettoyage |
| Liste des bandes | Suivre les bandes actives et archivées | Créer, filtrer, comparer, clôturer |
| Fiche bande | Consulter tout le cycle d’une bande | Saisir, vendre, transférer, exporter |
| Saisie du jour | Saisir les données terrain | Enregistrer, modifier, synchroniser |
| Santé animale | Gérer vaccinations et traitements | Planifier, réaliser, exporter carnet |
| Stock ferme | Gérer les articles et niveaux | Entrée, sortie, inventaire, transfert |
| Commandes | Suivre les approvisionnements | Créer, envoyer, réceptionner, annuler |
| Ventes et factures | Facturer les ventes de la ferme | Créer, encaisser, imprimer, annuler |
| Dépenses | Suivre les charges | Créer, rattacher, joindre justificatif |
| RH ferme | Gérer les employés | Créer, affecter, consulter |
| Pointage | Saisir ou scanner les présences | Entrée, sortie, correction autorisée |
| Paie | Préparer la paie | Prévisualiser, clôturer, exporter |
| Rapports ferme | Analyser les performances | Filtrer, exporter PDF/Excel |
| Mouvements reçus/envoyés | Suivre les flux entre unités | Créer, réceptionner, annuler |

### 5.2 Formulaire de démarrage de bande

- Référence de bande ;
- date de démarrage ;
- nombre initial de poussins ;
- souche ;
- type de cycle ;
- couvoir ;
- numéro de lot d’incubation ;
- bâtiment(s) de répartition ;
- quantité par bâtiment ;
- coût d’achat ;
- observation.

**Validation :** la somme des quantités réparties doit être égale ou inférieure au nombre initial. Les quantités restantes doivent être explicitement indiquées.

### 5.3 Formulaire de saisie quotidienne

- date ;
- bâtiment ;
- bande ;
- mortalité ;
- cause ;
- aliment kg ;
- eau litres ;
- sujets vendus ;
- poids moyen ;
- température min/max ;
- humidité ;
- observation ;
- pièce jointe facultative.

**Validation :** date non clôturée, effectif disponible suffisant, aucune duplication silencieuse.

### 5.4 Formulaire de sortie stock

- article ;
- quantité ;
- unité ;
- bande ;
- bâtiment ;
- date ;
- motif ;
- responsable.

**Validation :** stock disponible suffisant sauf ajustement autorisé et justifié.

### 5.5 Formulaire de vente

- client ;
- bande ;
- bâtiment ;
- produit ;
- nombre de sujets ou poids ;
- prix unitaire ;
- remise éventuelle ;
- taxe configurable ;
- paiement initial ;
- mode de paiement ;
- échéance ;
- notes.

**Validation :** effectif, délai sanitaire, prix et mode de paiement contrôlés.

---

## 6. Modèle de données

### 6.1 Principes de séparation

Toutes les données opérationnelles portent :

- `organization_id` : société SCOOPS LE REVEIL ;
- `unit_id` : unité ferme ;
- `created_by` ;
- `created_at` ;
- `updated_at` ;
- `deleted_at` lorsque la suppression logique est nécessaire.

### 6.2 Tables principales

#### Organisation et accès

- `organizations(id, name, currency, timezone)`
- `units(id, organization_id, code, name, type, active)`
- `profiles(id, auth_user_id, organization_id, full_name, username, role, active)`
- `user_unit_access(id, profile_id, unit_id, access_scope)`
- `audit_logs(id, organization_id, unit_id, actor_id, action, entity_type, entity_id, payload, created_at)`

#### Ferme et bâtiments

- `farms(id, organization_id, unit_id, name, site, active)`
- `buildings(id, farm_id, code, name, capacity, status, biosecurity_status)`
- `sanitary_downtime_periods(id, building_id, start_date, end_date, reason, cleaning_done, disinfection_done, validated_by)`
- `biosecurity_operations(id, building_id, operation_type, product, operator_id, performed_at, notes)`
- `visitors(id, farm_id, name, phone, visit_date, buildings_visited, reason)`

#### Bandes et effectifs

- `batches(id, farm_id, unit_id, reference, start_date, initial_count, strain, cycle_type, hatchery, incubation_lot, status, closed_at)`
- `batch_building_allocations(id, batch_id, building_id, quantity, start_date, end_date)`
- `bird_transfers(id, batch_id, source_building_id, destination_building_id, quantity, transfer_date, reason, status)`
- `batch_closures(id, batch_id, closed_by, closed_at, zootechnical_snapshot, financial_snapshot, notes)`

#### Suivi quotidien

- `daily_farm_records(id, batch_id, building_id, record_date, mortality_count, mortality_cause, feed_kg, water_liters, birds_sold, average_sold_weight_kg, temp_min, temp_max, humidity, notes, recorded_by)`
- `weight_records(id, batch_id, building_id, measured_at, sample_count, average_weight_kg, method, recorded_by)`
- `mortality_events(id, batch_id, building_id, event_date, quantity, cause, notes, recorded_by)`
- `environment_records(id, batch_id, building_id, record_date, temp_min, temp_max, humidity, alerts_generated)`

#### Fiches théoriques

- `strain_reference_profiles(id, organization_id, strain, cycle_type, day_number, theoretical_weight_kg, feed_kg, water_liters, mortality_target_percent, temp_min, temp_max, humidity_min, humidity_max)`

#### Sanitaire

- `vaccination_programs(id, organization_id, strain, cycle_type, name, active)`
- `vaccination_plan_items(id, program_id, target_day, product, dose, notes)`
- `vaccination_events(id, batch_id, building_id, event_date, product, dose, operator_id, status, notes)`
- `treatments(id, batch_id, building_id, prescribed_at, product, active_ingredient, dosage, duration_days, withdrawal_days, end_date, sale_allowed_date, prescribed_by, notes)`
- `sanitary_documents(id, batch_id, document_type, storage_path, uploaded_by, created_at)`

#### Stock et approvisionnement

- `stock_items(id, organization_id, unit_id, sku, name, category, measurement_unit, alert_threshold, average_purchase_price, active)`
- `stock_lots(id, stock_item_id, lot_number, expiry_date, quantity, unit_cost)`
- `stock_movements(id, organization_id, unit_id, stock_item_id, movement_type, quantity, source_type, source_id, batch_id, building_id, reason, created_by, created_at)`
- `inter_unit_transfers(id, organization_id, source_unit_id, destination_unit_id, status, requested_by, requested_at, received_by, received_at)`
- `inter_unit_transfer_lines(id, transfer_id, stock_item_id, quantity, measurement_unit, source_movement_id, destination_movement_id)`
- `suppliers(id, organization_id, name, supplier_type, phone, email, address, active)`
- `purchase_orders(id, organization_id, unit_id, supplier_id, reference, order_date, status, batch_id, total_estimated)`
- `purchase_order_lines(id, purchase_order_id, stock_item_id, quantity_ordered, quantity_received, unit_price)`
- `purchase_receipts(id, purchase_order_id, received_at, received_by, notes)`

#### Ventes et dépenses

- `customers(id, organization_id, name, email, phone, address, active)`
- `sales_invoices(id, organization_id, unit_id, customer_id, invoice_number, issue_date, due_date, status, subtotal, tax_rate, tax_amount, total, batch_id, building_id)`
- `sales_invoice_lines(id, invoice_id, product_type, product_id, description, quantity, measurement_unit, unit_price, total)`
- `payments(id, invoice_id, amount, payment_date, method, reference, recorded_by)`
- `expenses(id, organization_id, unit_id, expense_date, category, label, amount, payment_method, batch_id, building_id, receipt_path, created_by)`

#### RH et paie

- `employees(id, organization_id, unit_id, employee_number, first_name, last_name, phone, hire_date, position, contract_type, base_salary, hourly_rate, cnps_rate, payment_type, active)`
- `employee_documents(id, employee_id, document_type, storage_path, uploaded_at)`
- `attendance_events(id, employee_id, event_time, event_type, source, device_id, recorded_by)`
- `attendance_daily_summaries(id, employee_id, work_date, total_worked_minutes, normal_minutes, overtime_minutes, status, validated_by)`
- `leave_requests(id, employee_id, leave_type, start_date, end_date, status, approved_by)`
- `payroll_runs(id, organization_id, unit_id, month, year, status, closed_by, closed_at)`
- `payslips(id, payroll_run_id, employee_id, gross_salary, deductions, advances, cnps, net_salary, pdf_path)`

#### Synchronisation

- `sync_events(id, device_id, organization_id, unit_id, client_event_id, entity_type, entity_id, operation, payload, occurred_at, synced_at, conflict_status)`

### 6.3 Cardinalités principales

- Une ferme possède plusieurs bâtiments.
- Une bande possède une ou plusieurs allocations de bâtiment.
- Un bâtiment reçoit plusieurs bandes dans le temps, mais une seule période d’occupation active par capacité configurée.
- Une bande possède plusieurs suivis quotidiens, événements sanitaires, consommations, ventes et dépenses.
- Un article possède plusieurs lots et mouvements stock.
- Une sortie stock peut être liée à une bande et à un bâtiment.
- Une commande possède plusieurs lignes et peut avoir plusieurs réceptions.
- Une facture possède plusieurs lignes et plusieurs paiements.
- Un transfert inter-unités possède plusieurs lignes, chaque ligne générant un mouvement source et un mouvement destination.

---

## 7. Logique de calcul

### 7.1 Effectif restant

Pour une bande et un bâtiment :

```text
Effectif restant
= Effectif précédent
- Mortalité du jour
- Sujets vendus
- Transferts sortants
+ Transferts entrants
```

Le résultat doit être supérieur ou égal à zéro.

### 7.2 Taux de mortalité cumulé

```text
Taux de mortalité (%)
= Mortalité cumulée / Effectif initial de la bande × 100
```

Une mortalité transférée avec la bande reste rattachée à la bande et est ventilée par bâtiment selon le lieu d’enregistrement.

### 7.3 Poids total vendu

```text
Poids total vendu (kg)
= Nombre de sujets vendus × Poids moyen vendu (kg)
```

Lorsque le poids réel de chaque sujet est disponible, le système utilise la somme des poids individuels à la place de l’estimation.

### 7.4 Biomasse estimée

```text
Biomasse vivante (kg)
= Effectif restant × Poids moyen du dernier relevé
```

La date du dernier relevé doit être affichée pour éviter de présenter une estimation comme une mesure du jour.

### 7.5 GMQ — Gain moyen quotidien

```text
GMQ (g/jour)
= (Poids moyen actuel - Poids moyen de référence) × 1 000
  / Nombre de jours entre les deux mesures
```

Le logiciel doit afficher `Non calculable` lorsqu’il manque une pesée de référence ou lorsque l’intervalle est nul.

### 7.6 IC — Indice de consommation

Version MVP :

```text
IC
= Aliment cumulé consommé (kg)
  / Gain de biomasse cumulé (kg)
```

Pour le calcul de clôture :

```text
Gain de biomasse
= Poids total vendu + Biomasse finale - Biomasse initiale estimée
```

Le système doit afficher une alerte si le dénominateur est nul ou négatif.

### 7.7 Écart au théorique

```text
Écart (%)
= (Valeur réelle - Valeur théorique) / Valeur théorique × 100
```

Les seuils d’alerte sont paramétrables. Valeur proposée pour les maquettes : `10 %`, à confirmer.

### 7.8 Coût de revient

```text
Coût total de bande
= Aliment
+ Eau
+ Médicaments et vaccins
+ Main-d’œuvre affectée
+ Énergie et transport
+ Quote-part bâtiment et matériel
+ Autres dépenses affectées
```

```text
Coût de revient au kg
= Coût total de bande / Poids total vendu
```

```text
Marge brute
= Chiffre d’affaires de la bande - Coût total de bande
```

La marge nette exige la définition préalable des amortissements et frais indirects par la direction.

### 7.9 Paie

```text
Salaire brut
= Salaire de base
+ Heures normales
+ Heures supplémentaires
+ Primes
+ Congés payés
```

```text
Salaire net
= Salaire brut
- Retards et manques
- Absences non justifiées
- Avances
- CNPS
- Autres retenues validées
```

Les taux et règles doivent être paramétrables et validés par le responsable administratif.

---

## 8. Parcours utilisateur de bout en bout

### 8.1 Préparation du bâtiment

1. Le responsable crée le bâtiment.
2. Il renseigne la capacité et le statut.
3. Après une ancienne bande, il enregistre nettoyage et désinfection.
4. Le système calcule la fin du vide sanitaire.
5. Le bâtiment devient disponible après validation.

### 8.2 Réception et démarrage des poussins

1. Le responsable crée la bande.
2. Il renseigne couvoir, souche, date et quantité.
3. Il répartit les poussins dans les bâtiments.
4. Le système crée l’effectif initial par allocation.
5. Le programme sanitaire est proposé selon la souche et le type de cycle.

### 8.3 Suivi quotidien

1. L’agent ouvre la tâche du jour.
2. Il sélectionne son bâtiment.
3. Il saisit mortalité, aliment, eau, poids et ambiance.
4. Le système vérifie les valeurs et calcule les indicateurs.
5. Les alertes sont générées immédiatement.
6. La saisie est stockée localement si le réseau est indisponible.

### 8.4 Approvisionnement

1. Le responsable crée une commande.
2. Le fournisseur ou l’unité source est sélectionné.
3. La réception est saisie selon les quantités réelles.
4. Si la source est une autre unité, un transfert inter-unités est généré.
5. La ferme réceptionne le transfert.
6. Le stock ferme est mis à jour.

### 8.5 Santé et traitement

1. Le vaccin ou traitement est planifié.
2. L’agent saisit la réalisation et le produit utilisé.
3. Le délai d’attente est calculé.
4. Les ventes interdites sont bloquées ou soumises à validation.
5. Le carnet sanitaire est disponible pour consultation et export.

### 8.6 Vente

1. Le commercial sélectionne la bande et le bâtiment.
2. Il saisit le nombre de sujets, le poids ou le mode de vente.
3. Le système vérifie l’effectif et le délai sanitaire.
4. La facture est générée avec l’unité ferme.
5. Les acomptes et paiements sont enregistrés.
6. L’effectif et la rentabilité sont recalculés.

### 8.7 Clôture de bande

1. Le responsable vérifie les saisies manquantes.
2. Il vérifie stock, ventes, dépenses et sanitaire.
3. Il lance la clôture.
4. Le système calcule les indicateurs zootechniques et financiers.
5. Un rapport de clôture est généré.
6. Les bâtiments concernés passent en vide sanitaire.

---

## 9. Fonctionnement hors ligne et synchronisation

### 9.1 Principe

L’application mobile doit rester utilisable sans connexion pour les opérations terrain : suivi quotidien, mortalité, aliment, eau, température, vaccination et réception simple.

Les écrans de gestion lourde — rapports avancés, configuration et exports — peuvent exiger une connexion dans le MVP.

### 9.2 Stockage local

- PWA installable sur Android et iOS ;
- IndexedDB pour les données de travail ;
- files d’événements locales ;
- identifiants UUID générés côté appareil ;
- affichage clair de l’état `Hors ligne`, `À synchroniser` ou `Synchronisé`.

### 9.3 Synchronisation

Chaque création ou modification produit un événement :

```text
client_event_id
entity_type
entity_id
operation
payload
occurred_at
user_id
unit_id
```

Le serveur traite les événements de manière idempotente : un même `client_event_id` ne doit pas être appliqué deux fois.

### 9.4 Conflits

Proposition MVP :

- les saisies quotidiennes sont considérées comme des événements immuables ;
- deux saisies du même bâtiment et de la même date déclenchent une résolution ;
- une correction ne supprime pas l’ancienne valeur, elle crée un événement de correction ;
- en cas de conflit, la dernière modification validée ne remplace pas silencieusement l’autre ;
- le responsable voit une file `Conflits à résoudre`.

La stratégie exacte — dernière modification gagnante, fusion ou validation manuelle — doit être validée avant le développement hors ligne complet.

---

## 10. Contraintes techniques et non fonctionnelles

### 10.1 Stack retenue

- Next.js 14 avec App Router ;
- TypeScript ;
- Tailwind CSS ;
- Supabase PostgreSQL ;
- Supabase Auth ;
- Supabase Storage ;
- Vercel ;
- PWA et IndexedDB pour le hors-ligne ;
- Playwright pour les parcours E2E ;
- Vitest ou Jest pour les calculs.

### 10.2 Mobile-first

- boutons et champs utilisables au doigt ;
- saisie du jour accessible en moins de trois actions ;
- tableaux transformés en cartes sur petit écran ;
- chargement léger sur réseau mobile ;
- feedback visuel après chaque enregistrement ;
- possibilité de travailler en mode portrait.

### 10.3 Sécurité

- comptes créés uniquement par l’administrateur ;
- aucune inscription publique ;
- RLS Supabase par `organization_id` et `unit_id` ;
- vérification serveur des rôles ;
- journal d’audit ;
- accès restreint aux documents RH et sanitaires ;
- aucune clé secrète dans le navigateur ;
- sauvegardes et restauration testées.

### 10.4 Volumétrie de dimensionnement

- **[HYPOTHÈSE]** 20 bâtiments par site ;
- **[HYPOTHÈSE]** 100 bandes actives ou archivées par an ;
- **[HYPOTHÈSE]** 10 saisies quotidiennes par bâtiment actif ;
- **[HYPOTHÈSE]** 30 utilisateurs pour la société au démarrage ;
- **[HYPOTHÈSE]** 5 ans d’historique conservé en ligne.

Ces valeurs devront être confirmées pour dimensionner les index, la synchronisation et les exports.

---

## 11. Phasage de développement

### Phase 0 — Fondations

- unités, utilisateurs et accès ;
- unité ferme isolée ;
- bâtiments ;
- rôles de base ;
- navigation et mobile-first ;
- schéma Supabase initial ;
- audit et RLS.

### Phase 1 — MVP indispensable

1. Dashboard ferme ;
2. bâtiments et vide sanitaire ;
3. création et répartition des bandes ;
4. saisie quotidienne ;
5. mortalité, aliment, eau, poids et ambiance ;
6. calcul effectif, mortalité, GMQ et IC ;
7. stock propre à la ferme ;
8. mouvements inter-unités reçus ;
9. ventes de poulets vivants ;
10. dépenses ;
11. rapports de base ;
12. fonctionnement local avec synchronisation simple.

**Justification :** ces éléments permettent à la ferme de travailler et de mesurer ses résultats avant d’ajouter la paie et les fonctions avancées.

### Phase 2 — Sanitaire et performance avancée

- fiches théoriques par souche ;
- programmes de vaccination ;
- traitements et délais d’attente ;
- carnet sanitaire PDF ;
- biosécurité ;
- comparaison de bandes ;
- coût de revient complet ;
- clôture de bande avancée.

### Phase 3 — Approvisionnement et commercial avancés

- commandes fournisseurs ;
- réceptions partielles ;
- acomptes et paiements multiples ;
- ventes par poids ;
- exports Excel ;
- tableaux de rentabilité détaillés.

### Phase 4 — RH, pointage et paie

- fiches employés ;
- QR Code ;
- présence et absences ;
- avances ;
- clôture de paie ;
- bulletins PDF ;
- rapports RH.

**Justification :** la paie exige une validation réglementaire, des règles CNPS et une qualité de pointage suffisante. Elle ne doit pas retarder le démarrage opérationnel de la ferme.

### Phase 5 — Hors ligne avancé et industrialisation

- synchronisation multi-appareils ;
- résolution de conflits ;
- mode hors ligne complet ;
- notifications ;
- optimisation volumétrique ;
- sauvegardes automatiques ;
- tests de reprise après incident.

---

## 12. Questions à confirmer

1. La ferme est-elle exclusivement dédiée aux poulets de chair ?
2. Combien de bâtiments existent aujourd’hui et quelles sont leurs capacités ?
3. La ferme possède-t-elle un seul site ou plusieurs sites ?
4. Les ventes se font-elles par tête, par poids, par lot ou selon plusieurs modes ?
5. Les poulets abattus font-ils partie du périmètre immédiat ?
6. Quelles souches sont réellement utilisées ?
7. Quelle fiche théorique est actuellement utilisée par souche ?
8. Qui valide une saisie quotidienne corrigée ?
9. Quels vaccins et traitements sont réellement utilisés et quels sont leurs délais d’attente ?
10. Quel est le seuil de mortalité considéré comme critique ?
11. Quelle méthode de valorisation du stock doit être retenue : CUMP ou FIFO ?
12. Quels sont les paramètres de paie et les règles CNPS validés par le comptable ?
13. Quel fournisseur de Mobile Money sera utilisé, si la fonctionnalité est retenue ?
14. Quelle est la durée officielle du vide sanitaire par bâtiment ?
15. Quels formats PDF et Excel sont exigés par la direction de SCOOPS LE REVEIL ?

---

## Conclusion

Le premier livrable à construire est le **MVP de la ferme de poulets de chair** : bâtiments, bandes, saisie quotidienne, effectifs, stock propre à la ferme, mouvements inter-unités, ventes et rapports de base.

Les fonctionnalités sanitaires avancées, le coût complet, le hors-ligne multi-appareils et la paie seront développés progressivement après validation des règles métier par SCOOPS LE REVEIL.
