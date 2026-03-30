# Mon Budget — Application Web de Gestion de Budget Personnel

## Description
Application web permettant de gérer un budget personnel : suivi des dépenses et des revenus, visualisation par catégorie, et historique filtrable. Interface entièrement en français.

## Fonctionnalités
- Ajouter des **dépenses** et des **revenus** avec :
  - Montant
  - Catégorie
  - Date
  - Description
- **Tableau de bord** affichant :
  - Solde actuel (revenus - dépenses)
  - Graphique de répartition des dépenses par catégorie
  - Historique des transactions filtrable
- Filtres sur l'historique (par catégorie, par type, par période)

## Catégories
- Alimentation
- Logement
- Transport
- Loisirs
- Santé
- Autres

## Interface
- Langue : **français**
- Design : **moderne et épuré**
- Responsive (adapté mobile et desktop)

## Technologies
- **HTML** — structure
- **CSS** — styles (pas de framework externe)
- **JavaScript pur (vanilla)** — logique applicative, pas de bibliothèque
- **localStorage** — persistance des données côté navigateur

## Architecture
- Fichier unique ou séparation minimale : `index.html`, `style.css`, `app.js`
- Pas de backend, pas de base de données externe
- Données stockées en JSON dans `localStorage`
