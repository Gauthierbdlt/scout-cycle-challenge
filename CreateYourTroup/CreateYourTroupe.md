# ⚜️ Créer son propre Défi Vélo Scout (Guide d'adaptation)

Ce projet est conçu pour être facilement réutilisable par n'importe quelle troupe scoute. En quelques minutes, tu peux cloner ce dépôt, le configurer pour ta propre troupe, changer les couleurs, lier ta propre base de données et définir tes administrateurs.

**Ce dont tu as besoin :**

| Outil | Pourquoi | Lien |
|---|---|---|
| Compte GitHub | Forker / cloner le code | [github.com](https://github.com) |
| Node.js (v18 ou plus) | Lancer l'application en local | [nodejs.org](https://nodejs.org) |
| Compte Supabase (gratuit) | Base de données, authentification, stockage | [supabase.com](https://supabase.com) |
| Compte Vercel ou Netlify (gratuit) | Héberger le site | [vercel.com](https://vercel.com) · [netlify.com](https://www.netlify.com) |

> 📚 Documents complémentaires :
> - [`database-schema.md`](./database-schema.md) : tous les scripts SQL pour recréer la base de données.
> - [`code.md`](./code.md) : architecture technique et organisation du code.

---

## Étape 1 : Cloner le dépôt GitHub

1. Crée une copie ([Fork](https://docs.github.com/fr/get-started/quickstart/fork-a-repo)) de ce dépôt sur ton compte GitHub, ou clone-le directement.
2. Télécharge le code sur ton ordinateur et installe les dépendances :

   ```bash
   git clone <url-de-ton-repo>
   cd <nom-du-repo>
   npm install
   ```

---

## Étape 2 : Créer sa propre base de données (Supabase)

L'application fonctionne avec un backend cloud gratuit fourni par [Supabase](https://supabase.com).

1. Crée un compte gratuit sur le [Supabase Dashboard](https://supabase.com/dashboard).
2. Crée un **nouveau projet** (choisis une région proche de chez toi, par exemple *West EU*).
3. Va dans l'onglet **SQL Editor** de ton projet et exécute les scripts de [`database-schema.md`](./database-schema.md), table par table, pour créer : `patrols`, `profiles`, `activities`, `countdowns` et `proposed_routes`, ainsi que leurs politiques de sécurité ([RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)).
4. Crée un **bucket de stockage** nommé `proofs` dans l'onglet [Storage](https://supabase.com/docs/guides/storage) et rends-le **public** (il contient les captures d'écran de preuves et les fichiers GPX).
5. Récupère tes clés d'API : **URL du projet** et **clé `anon` publique**, dans *Project Settings > API* ([documentation](https://supabase.com/docs/guides/api/api-keys)).

> ⚠️ N'utilise **jamais** la clé `service_role` dans le code du site : elle donne tous les droits et ne doit rester que côté serveur.

---

## Étape 3 : Configurer les variables d'environnement

À la racine du projet, duplique le fichier d'exemple (s'il existe, par exemple `.env.example`) en `.env`, ou crée directement un fichier `.env`, puis renseigne tes propres identifiants Supabase :

```env
VITE_SUPABASE_URL=https://ton-projet-supabase.supabase.co
VITE_SUPABASE_ANON_KEY=ta-cle-anon-publique
```

- Le préfixe `VITE_` est obligatoire pour que [Vite](https://vite.dev/guide/env-and-mode) expose ces variables au site.
- Le fichier `.env` ne doit **pas** être commité sur GitHub (vérifie qu'il figure dans `.gitignore`).

---

## Étape 4 : Personnaliser la charte graphique (les couleurs)

La direction artistique (bruns, orange, tons bois et scouts) est centralisée dans les variables de style [Tailwind CSS](https://tailwindcss.com).

1. Ouvre le fichier de style principal (par exemple `src/index.css` ou `src/App.css`).
2. Modifie les variables de couleurs (`--primary`, `--background`, etc.) pour correspondre aux foulards et à la charte graphique de ta troupe.

Pour t'aider à choisir et nommer tes couleurs :
- [Tailwind CSS : personnaliser les couleurs](https://tailwindcss.com/docs/colors)
- [Tailwind CSS : thème et variables](https://tailwindcss.com/docs/theme)

Pense aussi à adapter les textes visibles (nom de la troupe, titre du défi, logo, favicon) dans les fichiers de `src/routes/` (notamment `index.tsx`) et dans `index.html`.

---

## Étape 5 : Configurer son compte Administrateur

1. Lance l'application en local :

   ```bash
   npm run dev
   ```

2. Crée un compte utilisateur directement depuis l'application, sur la page de connexion (`/auth`).
3. Va dans ton tableau de bord Supabase, dans la table `user_roles` (ou attribue les droits d'administration selon le système de rôles de ta version du code), pour lier ton adresse email au rôle `admin`.
4. Connecte-toi : tu as maintenant accès au panneau d'administration (`/admin`) pour :
   - créer tes propres patrouilles (ex : Renards, Faucons, Libellules) ;
   - valider ou refuser les sorties déclarées ;
   - gérer les comptes à rebours de ta troupe.

---

## Étape 6 : Déployer le site

Tu peux déployer ton application gratuitement et en quelques clics sur :

- [Vercel](https://vercel.com) ([guide Vite sur Vercel](https://vercel.com/docs/frameworks/vite))
- [Netlify](https://www.netlify.com) ([guide Vite sur Netlify](https://docs.netlify.com/build/frameworks/framework-setup-guides/vite/))

N'oublie pas d'ajouter tes variables d'environnement (`VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`) dans les paramètres de déploiement de ta plateforme d'hébergement.

Une fois le site en ligne, ajoute son adresse dans Supabase (*Authentication > URL Configuration*) pour que la connexion et les liens de confirmation par email fonctionnent depuis ton domaine.

---

## ✅ Checklist finale

- [ ] Dépôt forké et dépendances installées
- [ ] Projet Supabase créé et scripts SQL exécutés
- [ ] Bucket `proofs` créé et public
- [ ] Fichier `.env` renseigné (et absent de GitHub)
- [ ] Couleurs et textes adaptés à la troupe
- [ ] Compte admin créé et rôle attribué
- [ ] Patrouilles et compte à rebours créés depuis `/admin`
- [ ] Site déployé avec les variables d'environnement
- [ ] URL du site ajoutée dans la configuration d'authentification Supabase

---

## 🆘 Dépannage rapide

| Problème | Piste |
|---|---|
| Page blanche ou erreur de connexion à la base | Vérifie `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`, puis relance `npm run dev` |
| Les images de preuves ou les GPX ne s'affichent pas | Vérifie que le bucket `proofs` existe et est en **Public bucket** |
| Impossible de créer une activité ou un profil | Vérifie que les politiques RLS de [`database-schema.md`](./database-schema.md) ont bien été exécutées |
| Pas d'accès à `/admin` | Vérifie que ton compte a bien le rôle `admin` |
| Le site déployé ne se connecte pas | Vérifie les variables d'environnement sur Vercel/Netlify et l'URL du site dans Supabase |
