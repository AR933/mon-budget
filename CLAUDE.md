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
  - Graphique de répartition des dépenses par catégorie (donut chart canvas)
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
- **localStorage** — persistance des données côté navigateur (`clé : mon_budget_transactions`)

## Architecture
- Séparation minimale : `index.html`, `style.css`, `app.js`
- Pas de backend, pas de base de données externe
- Données stockées en JSON dans `localStorage`

## Déploiement
- **Dépôt GitHub** : https://github.com/AR933/mon-budget
- **Site en ligne** : https://ar933.github.io/mon-budget/
- Hébergé via **GitHub Pages** depuis la branche `main`
- Serveur de développement local : `python -m http.server 3456` (configuré dans `.claude/launch.json`)

## SEO
Balises meta présentes dans `index.html` :
- `description` — résumé de l'application
- `og:title`, `og:description`, `og:type` — Open Graph pour le partage social
- `canonical` — URL canonique pointant vers GitHub Pages
- `robots: index, follow`
