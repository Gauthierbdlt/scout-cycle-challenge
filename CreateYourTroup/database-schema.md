# 🗄️ Schéma de la Base de Données — ALEZAN 42

Ce fichier contient l'intégralité des scripts SQL nécessaires pour recréer l'architecture de la base de données dans un nouveau projet Supabase (tables, politiques RLS et configuration).

**Comment l'utiliser :** ouvre ton projet sur le [Supabase Dashboard](https://supabase.com/dashboard), va dans **SQL Editor**, puis exécute les scripts dans l'ordre (les tables `profiles` et `activities` dépendent de `patrols` et de `auth.users`). Voir aussi [`CreateYourTroupe.md`](./CreateYourTroupe.md) et [`code.md`](./code.md).

---

## 1. Table des Patrouilles (`patrols`)

Gère les équipes de la troupe (garçons, filles, staff/mixte).

```sql
CREATE TABLE IF NOT EXISTS public.patrols (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT CHECK (category IN ('homme', 'femme', 'mixte')) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.patrols ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read for everyone" ON public.patrols
FOR SELECT USING (true);

CREATE POLICY "Enable write for authenticated users" ON public.patrols
FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

## 2. Table des Profils (`profiles`)

Stocke les informations des membres, liées à l'authentification Supabase.

```sql
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT,
    full_name TEXT NOT NULL,
    totem TEXT,
    quali TEXT,
    scout_year INTEGER CHECK (scout_year BETWEEN 1 AND 4),
    phone TEXT,
    strava_url TEXT,
    patrol_id UUID REFERENCES public.patrols(id) ON DELETE SET NULL,
    onboarded BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read for everyone" ON public.profiles
FOR SELECT USING (true);

CREATE POLICY "Enable insert for users based on id" ON public.profiles
FOR INSERT TO authenticated 
WITH CHECK (auth.uid() = id);

CREATE POLICY "Enable update for users based on id" ON public.profiles
FOR UPDATE TO authenticated 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);
```

## 3. Table des Activités & Sorties (`activities`)

Enregistre les kilomètres, les dates, les fichiers GPX et les preuves en attente de validation (`pending`, `approved`, `rejected`).

```sql
CREATE TABLE IF NOT EXISTS public.activities (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    km NUMERIC(6,2) NOT NULL,
    ride_date DATE NOT NULL,
    status TEXT CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending' NOT NULL,
    proof_path TEXT,
    gpx_path TEXT,
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read for everyone" ON public.activities
FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON public.activities
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Enable update for owner or authenticated" ON public.activities
FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Enable delete for owner or admin" ON public.activities
FOR DELETE TO authenticated USING (true);
```

## 4. Table des Comptes à Rebours (`countdowns`)

Permet de gérer plusieurs échéances et d'afficher le compte à rebours actif sur le site.

```sql
CREATE TABLE IF NOT EXISTS public.countdowns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    subtitle TEXT,
    target_date TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.countdowns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read for everyone" ON public.countdowns
FOR SELECT USING (true);

CREATE POLICY "Enable write for authenticated users" ON public.countdowns
FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

## 5. Table des Itinéraires Proposés (`proposed_routes`)

Stocke les suggestions de balades GPX partagées par les scouts.

```sql
CREATE TABLE IF NOT EXISTS public.proposed_routes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    gpx_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.proposed_routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read for all authenticated users" ON public.proposed_routes
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable insert for authenticated users" ON public.proposed_routes
FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Enable delete for owner or admin" ON public.proposed_routes
FOR DELETE TO authenticated USING (true);
```

## 6. Configuration du Stockage (Bucket `proofs`)

Rendez-vous dans l'onglet **Storage** de votre tableau de bord Supabase, créez un nouveau bucket nommé `proofs` et activez l'option **Public bucket**, pour que les images de preuves et les fichiers GPX puissent être lus et affichés correctement. Documentation : [Supabase Storage](https://supabase.com/docs/guides/storage).
