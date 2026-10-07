# 🛠️ Architecture et Documentation Technique — ALEZAN 42

Ce document présente l'architecture technique, l'arborescence et les choix technologiques du projet **ALEZAN 42** (Scout Cycle Challenge). Il s'adresse à un nouveau développeur ou à une autre troupe souhaitant comprendre le code source.

> 📚 Voir aussi : [`database-schema.md`](./database-schema.md) (scripts SQL) et [`CreateYourTroupe.md`](./CreateYourTroupe.md) (guide d'adaptation pour une autre troupe).

---

## 🏗️ Stack Technique

- **Framework Frontend :** [React](https://react.dev) avec [TypeScript](https://www.typescriptlang.org) et [TanStack Router](https://tanstack.com/router) (routage basé sur les fichiers dans `src/routes/`).
- **Build :** [Vite](https://vite.dev)
- **UI & Style :** [Tailwind CSS](https://tailwindcss.com), composants personnalisés et icônes [Lucide React](https://lucide.dev).
- **Backend & Base de Données :** [Supabase](https://supabase.com) (PostgreSQL) gérant l'authentification, le stockage des fichiers de preuves/GPX et les tables relationnelles.
- **Cartographie :** [Leaflet](https://leafletjs.com) (chargement dynamique via CDN) et [OpenStreetMap](https://www.openstreetmap.org) pour le rendu interactif des tracés GPX.

---

## 🚀 Démarrage rapide

```bash
git clone <url-de-ton-repo>
cd <nom-du-repo>
npm install
npm run dev
```

Variables d'environnement requises (fichier `.env` à la racine) :

```env
VITE_SUPABASE_URL=https://ton-projet-supabase.supabase.co
VITE_SUPABASE_ANON_KEY=ta-cle-anon-publique
```

Pour la configuration complète (Supabase, administrateur, déploiement), voir [`CreateYourTroupe.md`](./CreateYourTroupe.md).

---

## 📂 Arborescence du Projet (`src/`)

```text
src/
├── components/          # Composants UI réutilisables (Modals, AdminUserList, etc.)
├── integrations/
│   └── supabase/        # Client Supabase généré et configuré
├── lib/
│   ├── database.ts      # Logique de cache local et utilitaires de données
│   ├── supabase.ts      # Instance du client Supabase
│   └── useAuth.tsx      # Hook personnalisé de gestion de l'authentification
└── routes/              # Pages et routage (TanStack Router)
    ├── index.tsx        # Page d'accueil et classement principal
    ├── carte.tsx        # Page de cartographie interactive et upload GPX
    ├── auth.tsx         # Page de connexion / inscription
    └── _authenticated/  # Routes protégées nécessitant une authentification
        ├── admin.tsx    # Panneau d'administration (validations, patrouilles, countdowns)
        ├── profil.tsx   # Configuration du profil scout (totem, quali, patrouille)
        └── mes-km.tsx   # Saisie et suivi des kilomètres
```

---

## 🧭 Routes de l'application

| Route | Fichier | Accès | Rôle |
|---|---|---|---|
| `/` | `routes/index.tsx` | Public | Accueil, compte à rebours actif et classement principal |
| `/carte` | `routes/carte.tsx` | Public / connecté selon la version | Carte interactive, tracés GPX, upload GPX |
| `/auth` | `routes/auth.tsx` | Public | Connexion et inscription |
| `/profil` | `routes/_authenticated/profil.tsx` | Connecté | Totem, quali, année scout, téléphone, lien Strava, patrouille |
| `/mes-km` | `routes/_authenticated/mes-km.tsx` | Connecté | Saisie et suivi des kilomètres, envoi des preuves |
| `/admin` | `routes/_authenticated/admin.tsx` | Admin | Validation des sorties, gestion des patrouilles et des comptes à rebours |

---

## 🗄️ Schéma de la Base de Données (Supabase)

L'application repose sur plusieurs tables principales sous PostgreSQL (scripts complets dans [`database-schema.md`](./database-schema.md)) :

- **`profiles`** : informations des membres (liées à `auth.users`). Contient le nom, totem, quali, année scout, téléphone, lien Strava et la patrouille associée.
- **`patrols`** : gestion des patrouilles de la troupe (nom, catégorie : `homme`, `femme`, `mixte`).
- **`activities`** : enregistrement des sorties des scouts (kilomètres, date, statut `pending` / `approved` / `rejected`, chemin de preuve et fichier GPX, note).
- **`countdowns`** : gestion multi-échéances pour les comptes à rebours de la troupe (titre, sous-titre, date cible, statut actif).
- **`proposed_routes`** : itinéraires GPX proposés par les membres pour de futures balades (titre, description, URL du fichier).
- **Stockage (`proofs`)** : bucket Supabase public stockant les captures d'écran de preuves et les fichiers `.gpx`.

Relations principales :

```text
auth.users 1──1 profiles  N──1 patrols
auth.users 1──N activities
auth.users 1──N proposed_routes
countdowns (indépendante)
```

---

## ⚙️ Logiques Clés du Code

- **Confidentialité GPX :** les traces GPX téléchargées peuvent être traitées pour masquer les premiers et derniers mètres (protection de la vie privée des scouts, typiquement autour du domicile).
- **Routage dynamique :** utilisation de TanStack Router avec des layouts protégés (`_authenticated`) pour restreindre l'accès à certaines pages (carte, profil, admin) aux utilisateurs connectés.
- **Authentification :** gérée par Supabase Auth et exposée à l'application via le hook `useAuth` (`src/lib/useAuth.tsx`).
- **Cache local :** `src/lib/database.ts` regroupe la logique de cache et les utilitaires de données pour limiter les appels à Supabase.
- **Sécurité RLS (Row Level Security) :** les politiques de la base de données Supabase garantissent que chaque utilisateur ne peut modifier que son propre profil et que seuls les administrateurs peuvent valider les sorties ou gérer les structures de patrouilles. Voir la [documentation Supabase sur le RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

---

## 🔗 Liens utiles

- [Documentation TanStack Router](https://tanstack.com/router/latest/docs/framework/react/overview)
- [Documentation Supabase](https://supabase.com/docs)
- [Documentation Tailwind CSS](https://tailwindcss.com/docs)
- [Documentation Leaflet](https://leafletjs.com/reference.html)
- [Icônes Lucide](https://lucide.dev/icons)
