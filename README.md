# Scout Cycle Challenge — ALEZAN 42

Concours de vélo entre patrouilles scoutes pour déterminer qui parcourt le plus de kilomètres chaque semaine, centré autour de la région de **Moustier-sur-Sambre** et **Jemeppe-sur-Sambre**.

## 🚀 Fonctionnalités Clés

- **Authentification & Profils Scouts :** Connexion sécurisée, choix de la patrouille, saisie du totem, de la quali, de l'année scout (1ʳᵉ à 4ᵉ année) ou du statut Staff, ainsi que du profil Strava.
- **Classement par Catégories :** Visualisation des kilomètres parcourus (vélo et course à pied) filtrables par patrouille et par catégorie (Garçons, Filles, Staff / Mixte).
- **Cartographie Interactive & GPX :** 
  - Page dédiée (`/carte`) sécurisée pour les membres connectés.
  - Visualisation en temps réel des traces GPX (sorties réalisées et propositions de sorties).
  - **Confidentialité renforcée :** Masquage automatique des 200 premiers et derniers mètres des traces.
  - Centrage dynamique et zoom automatique sur un parcours au clic.
- **Comptes à Rebours Multiples :** Gestion dynamique de plusieurs échéances de la troupe (grand camp, fin du défi, rassemblements) directement configurables depuis l'interface ou le panneau d'administration et synchronisées via Supabase.
- **Panneau d'Administration (`/admin`) :** 
  - Réservé aux administrateurs (ex: `baudeletgauthier@gmail.com`).
  - Validation ou refus des captures d'écran de preuves de sorties.
  - Gestion des patrouilles et des rôles des membres.

---

## 🛠️ Stack Technique

- **Frontend :** React, TypeScript, Tailwind CSS, TanStack Router (`src/routes/`), Lucide Icons.
- **Backend & Base de Données :** Supabase (Tables : `profiles`, `activities`, `patrols`, `countdowns`, `proposed_routes` + Stockage bucket `proofs`).
- **Cartographie :** Leaflet (chargement dynamique via CDN) et OpenStreetMap.

---

## 💻 Développement Local

Pour travailler en local sur le projet :

1. Cloner le dépôt :
   ```bash
   git clone <url-du-repo>
   cd <nom-du-repo>