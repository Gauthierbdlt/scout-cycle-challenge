// Standalone Autonomous Database for ALEZAN 42
// 100% independent of Lovable and external cloud dependencies.
// Persists in localStorage with high-fidelity seed data and real-time subscriber events.

export type PatrolCategory = "homme" | "femme" | "mixte";

export interface Patrol {
  id: string;
  name: string;
  category: PatrolCategory;
  created_at: string;
}

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  totem: string | null;
  quali: string | null;
  scout_year: number | null; // 1 to 4, or null for Chefs
  phone: string | null;
  strava_url: string | null;
  patrol_id: string | null;
  is_chef?: boolean | undefined;
  onboarded: boolean;
  created_at: string;
}

export interface Activity {
  id: string;
  user_id: string;
  ride_date: string;
  km: number;
  proof_path: string | null;
  strava_link: string | null;
  status: "pending" | "approved" | "rejected";
  note: string | null;
  created_at: string;
}

export interface TimelineEvent {
  id: string;
  year: number;
  date_str: string;
  title: string;
  description: string;
  image_url: string | null;
  drive_url: string | null;
  tag: string;
  created_at: string;
}

export interface CountdownConfig {
  id: string;
  title: string;
  target_date: string; // ISO date string
  is_active: boolean;
  subtitle?: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: "admin" | "user";
}

const STORAGE_KEY = "alezan_standalone_db_v2";

const SEED_PATROLS: Patrol[] = [
  {
    id: "patrol-staff",
    name: "Staff",
    category: "mixte",
    created_at: "2026-09-01T00:00:00Z",
  },
  { id: "patrol-lynx", name: "Lynx", category: "femme", created_at: "2026-09-01T00:00:00Z" },
  {
    id: "patrol-gazelles",
    name: "Gazelles",
    category: "femme",
    created_at: "2026-09-01T00:00:00Z",
  },
  { id: "patrol-girafes", name: "Girafes", category: "femme", created_at: "2026-09-01T00:00:00Z" },
  {
    id: "patrol-marmottes",
    name: "Marmottes",
    category: "femme",
    created_at: "2026-09-01T00:00:00Z",
  },
  { id: "patrol-cougars", name: "Cougars", category: "homme", created_at: "2026-09-01T00:00:00Z" },
  { id: "patrol-condors", name: "Condors", category: "homme", created_at: "2026-09-01T00:00:00Z" },
  { id: "patrol-jaguars", name: "Jaguars", category: "homme", created_at: "2026-09-01T00:00:00Z" },
  { id: "patrol-bisons", name: "Bisons", category: "homme", created_at: "2026-09-01T00:00:00Z" },
  { id: "patrol-faucons", name: "Faucons", category: "homme", created_at: "2026-09-01T00:00:00Z" },
];

const SEED_PROFILES: Profile[] = [
  {
    id: "usr-gauthier",
    email: "baudeletgauthier@gmail.com",
    full_name: "Gauthier Baudelet",
    totem: "Aigle",
    quali: "Visionnaire",
    scout_year: null,
    phone: "06 12 34 56 78",
    strava_url: "https://strava.com/athletes/gauthier",
    patrol_id: "patrol-staff",
    is_chef: true,
    onboarded: true,
    created_at: "2026-09-01T00:00:00Z",
  },
  {
    id: "usr-baudouin",
    email: "baudouin@scout.fr",
    full_name: "Baudouin Martin",
    totem: "Élan",
    quali: "Généreux",
    scout_year: 4,
    phone: "06 01 02 03 04",
    strava_url: "https://strava.com/athletes/baudouin",
    patrol_id: "patrol-cougars",
    is_chef: false,
    onboarded: true,
    created_at: "2026-09-01T00:00:00Z",
  },
  {
    id: "usr-clemence",
    email: "clemence@scout.fr",
    full_name: "Clémence Dupont",
    totem: "Gazelle",
    quali: "Agile",
    scout_year: 3,
    phone: "06 02 03 04 05",
    strava_url: "https://strava.com/athletes/clemence",
    patrol_id: "patrol-gazelles",
    is_chef: false,
    onboarded: true,
    created_at: "2026-09-01T00:00:00Z",
  },
  {
    id: "usr-antoine",
    email: "antoine@scout.fr",
    full_name: "Antoine Thomas",
    totem: "Condor",
    quali: "Persévérant",
    scout_year: 2,
    phone: "06 03 04 05 06",
    strava_url: "https://strava.com/athletes/antoine",
    patrol_id: "patrol-condors",
    is_chef: false,
    onboarded: true,
    created_at: "2026-09-01T00:00:00Z",
  },
  {
    id: "usr-eleonore",
    email: "eleonore@scout.fr",
    full_name: "Éléonore Bernard",
    totem: "Lynx",
    quali: "Vif",
    scout_year: 1,
    phone: "06 04 05 06 07",
    strava_url: null,
    patrol_id: "patrol-lynx",
    is_chef: false,
    onboarded: true,
    created_at: "2026-09-01T00:00:00Z",
  },
  {
    id: "usr-gregoire",
    email: "gregoire@scout.fr",
    full_name: "Grégoire Vincent",
    totem: "Bison",
    quali: "Tenace",
    scout_year: 3,
    phone: "06 05 06 07 08",
    strava_url: "https://strava.com/athletes/gregoire",
    patrol_id: "patrol-bisons",
    is_chef: false,
    onboarded: true,
    created_at: "2026-09-01T00:00:00Z",
  },
  {
    id: "usr-mathilde",
    email: "mathilde@scout.fr",
    full_name: "Mathilde Laurent",
    totem: "Girafe",
    quali: "Avisée",
    scout_year: 2,
    phone: "06 06 07 08 09",
    strava_url: null,
    patrol_id: "patrol-girafes",
    is_chef: false,
    onboarded: true,
    created_at: "2026-09-01T00:00:00Z",
  },
  {
    id: "usr-augustin",
    email: "augustin@scout.fr",
    full_name: "Augustin Renaud",
    totem: "Jaguar",
    quali: "Furtif",
    scout_year: 4,
    phone: "06 07 08 09 10",
    strava_url: "https://strava.com/athletes/augustin",
    patrol_id: "patrol-jaguars",
    is_chef: false,
    onboarded: true,
    created_at: "2026-09-01T00:00:00Z",
  },
  {
    id: "usr-ines",
    email: "ines@scout.fr",
    full_name: "Inès Faure",
    totem: "Marmotte",
    quali: "Joyeuse",
    scout_year: 1,
    phone: "06 08 09 10 11",
    strava_url: null,
    patrol_id: "patrol-marmottes",
    is_chef: false,
    onboarded: true,
    created_at: "2026-09-01T00:00:00Z",
  },
  {
    id: "usr-arthur",
    email: "arthur@scout.fr",
    full_name: "Arthur Chevalier",
    totem: "Faucon",
    quali: "Intrépide",
    scout_year: 3,
    phone: "06 09 10 11 12",
    strava_url: "https://strava.com/athletes/arthur",
    patrol_id: "patrol-faucons",
    is_chef: false,
    onboarded: true,
    created_at: "2026-09-01T00:00:00Z",
  },
];

const SEED_ACTIVITIES: Activity[] = [
  // Chefs rides (this week)
  {
    id: "act-chef-1",
    user_id: "usr-gauthier",
    ride_date: "2026-09-29",
    km: 58.4,
    proof_path: null,
    strava_link: "https://www.strava.com/activities/9901",
    status: "approved",
    note: "Reconnaissance de l'itinéraire du camp",
    created_at: "2026-09-29T10:00:00Z",
  },
  {
    id: "act-chef-2",
    user_id: "usr-gauthier",
    ride_date: "2026-10-01",
    km: 42.0,
    proof_path: null,
    strava_link: "https://www.strava.com/activities/9902",
    status: "approved",
    note: "Sortie maîtrise vélo",
    created_at: "2026-10-01T08:00:00Z",
  },

  // Scouts rides (this week: Sept 28 - Oct 1, 2026)
  {
    id: "act-1",
    user_id: "usr-baudouin",
    ride_date: "2026-09-29",
    km: 46.5,
    proof_path: null,
    strava_link: "https://www.strava.com/activities/101",
    status: "approved",
    note: "Sortie colline avec les Cougars",
    created_at: "2026-09-29T10:00:00Z",
  },
  {
    id: "act-2",
    user_id: "usr-baudouin",
    ride_date: "2026-10-01",
    km: 38.0,
    proof_path: null,
    strava_link: "https://www.strava.com/activities/102",
    status: "approved",
    note: "Tour du lac rapide",
    created_at: "2026-10-01T09:00:00Z",
  },
  {
    id: "act-3",
    user_id: "usr-clemence",
    ride_date: "2026-09-28",
    km: 54.2,
    proof_path: null,
    strava_link: "https://www.strava.com/activities/103",
    status: "approved",
    note: "Piste verte en patrouille",
    created_at: "2026-09-28T14:00:00Z",
  },
  {
    id: "act-4",
    user_id: "usr-clemence",
    ride_date: "2026-09-30",
    km: 42.0,
    proof_path: null,
    strava_link: "https://www.strava.com/activities/104",
    status: "approved",
    note: "Grande boucle le long du canal",
    created_at: "2026-09-30T15:00:00Z",
  },
  {
    id: "act-5",
    user_id: "usr-antoine",
    ride_date: "2026-09-29",
    km: 68.4,
    proof_path: null,
    strava_link: "https://www.strava.com/activities/105",
    status: "approved",
    note: "Entraînement dénivelé",
    created_at: "2026-09-29T16:00:00Z",
  },
  {
    id: "act-6",
    user_id: "usr-eleonore",
    ride_date: "2026-09-30",
    km: 51.5,
    proof_path: null,
    strava_link: "https://www.strava.com/activities/106",
    status: "approved",
    note: "Sous-bois et chemins forestiers",
    created_at: "2026-09-30T17:00:00Z",
  },
  {
    id: "act-7",
    user_id: "usr-gregoire",
    ride_date: "2026-10-01",
    km: 75.0,
    proof_path: null,
    strava_link: "https://www.strava.com/activities/107",
    status: "approved",
    note: "Voie express vélo - grosse moyenne !",
    created_at: "2026-10-01T08:00:00Z",
  },
  {
    id: "act-8",
    user_id: "usr-mathilde",
    ride_date: "2026-09-29",
    km: 45.0,
    proof_path: null,
    strava_link: "https://www.strava.com/activities/108",
    status: "approved",
    note: "Chemins de campagne Girafes",
    created_at: "2026-09-29T18:00:00Z",
  },
  {
    id: "act-9",
    user_id: "usr-augustin",
    ride_date: "2026-09-30",
    km: 62.3,
    proof_path: null,
    strava_link: "https://www.strava.com/activities/109",
    status: "approved",
    note: "Relais Jaguars à deux",
    created_at: "2026-09-30T18:00:00Z",
  },
  {
    id: "act-10",
    user_id: "usr-ines",
    ride_date: "2026-09-30",
    km: 39.8,
    proof_path: null,
    strava_link: "https://www.strava.com/activities/110",
    status: "approved",
    note: "Balade automnale",
    created_at: "2026-09-30T19:00:00Z",
  },
  {
    id: "act-11",
    user_id: "usr-arthur",
    ride_date: "2026-09-29",
    km: 58.0,
    proof_path: null,
    strava_link: "https://www.strava.com/activities/111",
    status: "approved",
    note: "Sortie Faucons",
    created_at: "2026-09-29T12:00:00Z",
  },

  // Rides from last week (Sept 21 - Sept 27, 2026)
  {
    id: "act-lw-1",
    user_id: "usr-baudouin",
    ride_date: "2026-09-23",
    km: 52.0,
    proof_path: null,
    strava_link: "https://www.strava.com/activities/201",
    status: "approved",
    note: "Sortie mercredi",
    created_at: "2026-09-23T10:00:00Z",
  },
  {
    id: "act-lw-2",
    user_id: "usr-clemence",
    ride_date: "2026-09-24",
    km: 61.5,
    proof_path: null,
    strava_link: "https://www.strava.com/activities/202",
    status: "approved",
    note: "Grand tour",
    created_at: "2026-09-24T14:00:00Z",
  },
  {
    id: "act-lw-3",
    user_id: "usr-antoine",
    ride_date: "2026-09-25",
    km: 45.0,
    proof_path: null,
    strava_link: "https://www.strava.com/activities/203",
    status: "approved",
    note: "Cols et descentes",
    created_at: "2026-09-25T16:00:00Z",
  },
  {
    id: "act-lw-4",
    user_id: "usr-gauthier",
    ride_date: "2026-09-26",
    km: 65.0,
    proof_path: null,
    strava_link: "https://www.strava.com/activities/204",
    status: "approved",
    note: "Sortie longue maîtrise",
    created_at: "2026-09-26T09:00:00Z",
  },
];

const SEED_TIMELINE: TimelineEvent[] = [
  {
    id: "tl-2026-kickoff",
    year: 2026,
    date_str: "15 Septembre 2026",
    title: "Lancement de l'Édition 2026 de l'ALEZAN 42",
    description:
      "Coup d'envoi du grand concours de kilomètres à vélo entre toutes les patrouilles scoutes de la troupe ! Les compteurs Strava sont enclenchés et le trophée est remis en jeu.",
    image_url:
      "https://images.unsplash.com/photo-1544197150-b99a580bb7a8?auto=format&fit=crop&w=1200&q=80",
    drive_url: "https://drive.google.com",
    tag: "Défi 2026",
    created_at: "2026-09-15T00:00:00Z",
  },
  {
    id: "tl-2025-camp",
    year: 2025,
    date_str: "Juillet 2025",
    title: "Camp d'été dans le Vercors — Raid Vélo de 180 km",
    description:
      "Les patrouilles ont bravé les cols du Vercors lors d'une expédition vélo mémorable sous la tente. Félicitations aux Faucons et aux Gazelles pour leurs étapes reines !",
    image_url:
      "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80",
    drive_url: "https://drive.google.com",
    tag: "Camp d'été",
    created_at: "2025-07-20T00:00:00Z",
  },
  {
    id: "tl-2024-defi",
    year: 2024,
    date_str: "Octobre 2024",
    title: "Victoire Historique des Bisons — 1 420 km cumulés",
    description:
      "Avec une régularité impressionnante tout l'automne, la patrouille des Bisons a remporté le grand fanion doré. Une fête mémorable au local autour d'un grand feu de camp.",
    image_url:
      "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=1200&q=80",
    drive_url: "https://drive.google.com",
    tag: "Édition 2024",
    created_at: "2024-10-30T00:00:00Z",
  },
  {
    id: "tl-2023-creation",
    year: 2023,
    date_str: "Mai 2023",
    title: "Naissance du Trophée de l'ALEZAN 42",
    description:
      "Inauguration du défi par la maîtrise : allier esprit scout, écologie, dépassement de soi et aventure sportive à travers la pratique du vélo au quotidien et en patrouille.",
    image_url:
      "https://images.unsplash.com/photo-1517649763962-0c623266ddc0?auto=format&fit=crop&w=1200&q=80",
    drive_url: "https://drive.google.com",
    tag: "Histoire",
    created_at: "2023-05-10T00:00:00Z",
  },
];

const SEED_COUNTDOWN: CountdownConfig = {
  id: "countdown-main",
  title: "Fin du Défi Vélo des Patrouilles 2026",
  subtitle: "Rassemblement de troupe et remise du Grand Trophée ALEZAN 42",
  target_date: "2026-11-15T18:00:00",
  is_active: true,
};

const SEED_USER_ROLES: UserRole[] = [
  { id: "role-gauthier", user_id: "usr-gauthier", role: "admin" },
];

export interface DatabaseState {
  patrols: Patrol[];
  profiles: Profile[];
  activities: Activity[];
  timeline: TimelineEvent[];
  countdown: CountdownConfig;
  user_roles: UserRole[];
  currentUser: { id: string; email: string } | null;
}

class StandaloneDatabase {
  private state: DatabaseState;
  private listeners: Set<() => void> = new Set();
  private authListeners: Set<(event: string, session: unknown) => void> = new Set();

  constructor() {
    this.state = this.loadState();
  }

  private loadState(): DatabaseState {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          // Ensure all tables and seed elements exist
          return {
            patrols: parsed.patrols?.length ? parsed.patrols : SEED_PATROLS,
            profiles: parsed.profiles?.length ? parsed.profiles : SEED_PROFILES,
            activities: parsed.activities?.length ? parsed.activities : SEED_ACTIVITIES,
            timeline: parsed.timeline?.length ? parsed.timeline : SEED_TIMELINE,
            countdown: parsed.countdown || SEED_COUNTDOWN,
            user_roles: parsed.user_roles?.length ? parsed.user_roles : SEED_USER_ROLES,
            currentUser: parsed.currentUser || null,
          };
        }
      } catch (err) {
        console.warn("Failed to load local DB state:", err);
      }
    }

    return {
      patrols: [...SEED_PATROLS],
      profiles: [...SEED_PROFILES],
      activities: [...SEED_ACTIVITIES],
      timeline: [...SEED_TIMELINE],
      countdown: { ...SEED_COUNTDOWN },
      user_roles: [...SEED_USER_ROLES],
      currentUser: null,
    };
  }

  private saveState() {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      } catch (err) {
        console.warn("Failed to save local DB state:", err);
      }
    }
    this.notify();
  }

  public subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  public subscribeAuth(fn: (event: string, session: unknown) => void): () => void {
    this.authListeners.add(fn);
    return () => this.authListeners.delete(fn);
  }

  private notify() {
    this.listeners.forEach((fn) => {
      try {
        fn();
      } catch {
        // ignore listener error
      }
    });
  }

  private notifyAuth(event: string) {
    const session = this.state.currentUser
      ? { user: this.state.currentUser, access_token: "standalone-token" }
      : null;
    this.authListeners.forEach((fn) => {
      try {
        fn(event, session);
      } catch {
        // ignore listener error
      }
    });
    this.notify();
  }

  // --- Auth APIs ---
  public getCurrentUser(): { id: string; email: string } | null {
    return this.state.currentUser;
  }

  public getSession() {
    return this.state.currentUser
      ? { user: this.state.currentUser, access_token: "standalone-token" }
      : null;
  }

  public signIn(email: string) {
    const cleanEmail = email.trim().toLowerCase();
    let profile = this.state.profiles.find((p) => p.email?.toLowerCase() === cleanEmail);

    if (!profile) {
      const isGauthier = cleanEmail === "baudeletgauthier@gmail.com";
      const id = isGauthier ? "usr-gauthier" : `usr-${Date.now().toString(36)}`;
      profile = {
        id,
        email: cleanEmail,
        full_name: cleanEmail.split("@")[0] || "Scout",
        totem: null,
        quali: null,
        scout_year: isGauthier ? null : 1,
        phone: null,
        strava_url: null,
        patrol_id: isGauthier ? "patrol-staff" : null,
        is_chef: isGauthier,
        onboarded: isGauthier,
        created_at: new Date().toISOString(),
      };
      this.state.profiles.push(profile);
    }

    if (cleanEmail === "baudeletgauthier@gmail.com" || cleanEmail.includes("admin")) {
      if (!this.state.user_roles.some((r) => r.user_id === profile!.id && r.role === "admin")) {
        this.state.user_roles.push({
          id: `role-${Date.now()}`,
          user_id: profile!.id,
          role: "admin",
        });
      }
    }

    this.state.currentUser = { id: profile.id, email: cleanEmail };
    this.saveState();
    this.notifyAuth("SIGNED_IN");
    return { user: this.state.currentUser, profile };
  }

  public signOut() {
    this.state.currentUser = null;
    this.saveState();
    this.notifyAuth("SIGNED_OUT");
  }

  public isAdmin(userId?: string): boolean {
    const uid = userId || this.state.currentUser?.id;
    if (!uid) return false;
    return this.state.user_roles.some((r) => r.user_id === uid && r.role === "admin");
  }

  // --- Patrols APIs ---
  public getPatrols(): Patrol[] {
    return [...this.state.patrols];
  }

  public addPatrol(name: string, category: PatrolCategory): Patrol {
    const patrol: Patrol = {
      id: `patrol-${Date.now().toString(36)}`,
      name: name.trim(),
      category,
      created_at: new Date().toISOString(),
    };
    this.state.patrols.push(patrol);
    this.saveState();
    return patrol;
  }

  public deletePatrol(id: string) {
    this.state.patrols = this.state.patrols.filter((p) => p.id !== id);
    this.saveState();
  }

  // --- Profiles APIs ---
  public getProfiles(): Profile[] {
    return [...this.state.profiles];
  }

  public getProfile(id: string): Profile | null {
    return this.state.profiles.find((p) => p.id === id) || null;
  }

  public updateProfile(id: string, patch: Partial<Profile>): Profile | null {
    const idx = this.state.profiles.findIndex((p) => p.id === id);
    if (idx === -1) return null;
    const current = this.state.profiles[idx]!;

    // Check if patrol is Staff or Chefs
    const patrol = this.state.patrols.find(
      (pa) => pa.id === (patch.patrol_id || current.patrol_id),
    );
    const isStaffOrChef =
      patrol?.name.toLowerCase().includes("staff") ||
      patrol?.name.toLowerCase().includes("chef") ||
      patrol?.category === "mixte" ||
      current.is_chef;

    const updated: Profile = {
      ...current,
      ...patch,
      is_chef: isStaffOrChef,
      scout_year: isStaffOrChef ? null : (patch.scout_year ?? current.scout_year),
    };
    this.state.profiles[idx] = updated;
    this.saveState();
    return updated;
  }

  // --- Activities APIs ---
  public getActivities(userId?: string): Activity[] {
    if (userId) {
      return this.state.activities.filter((a) => a.user_id === userId);
    }
    return [...this.state.activities];
  }

  public addActivity(data: {
    user_id: string;
    ride_date: string;
    km: number;
    proof_path?: string | null;
    strava_link?: string | null;
    note?: string | null;
  }): Activity {
    const strava = data.strava_link?.trim();
    // Rule: Strava link -> approved, screenshot proof -> pending
    const status: "approved" | "pending" = strava && strava.length > 0 ? "approved" : "pending";

    const activity: Activity = {
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      user_id: data.user_id,
      ride_date: data.ride_date,
      km: Number(data.km),
      proof_path: data.proof_path || null,
      strava_link: strava || null,
      status,
      note: data.note || null,
      created_at: new Date().toISOString(),
    };

    this.state.activities.unshift(activity);
    this.saveState();
    return activity;
  }

  public updateActivityStatus(id: string, status: "approved" | "rejected" | "pending") {
    const act = this.state.activities.find((a) => a.id === id);
    if (act) {
      act.status = status;
      this.saveState();
    }
  }

  public deleteActivity(id: string) {
    this.state.activities = this.state.activities.filter((a) => a.id !== id);
    this.saveState();
  }

  // --- Timeline APIs ---
  public getTimeline(): TimelineEvent[] {
    return [...this.state.timeline].sort(
      (a, b) => b.year - a.year || b.date_str.localeCompare(a.date_str),
    );
  }

  public addTimelineEvent(event: Omit<TimelineEvent, "id" | "created_at">): TimelineEvent {
    const newEvent: TimelineEvent = {
      ...event,
      id: `tl-${Date.now().toString(36)}`,
      created_at: new Date().toISOString(),
    };
    this.state.timeline.unshift(newEvent);
    this.saveState();
    return newEvent;
  }

  public updateTimelineEvent(id: string, patch: Partial<TimelineEvent>) {
    const idx = this.state.timeline.findIndex((t) => t.id === id);
    if (idx !== -1) {
      this.state.timeline[idx] = { ...this.state.timeline[idx]!, ...patch };
      this.saveState();
    }
  }

  public deleteTimelineEvent(id: string) {
    this.state.timeline = this.state.timeline.filter((t) => t.id !== id);
    this.saveState();
  }

  // --- Countdown APIs ---
  public getCountdown(): CountdownConfig {
    return { ...this.state.countdown };
  }

  public updateCountdown(config: Partial<CountdownConfig>) {
    this.state.countdown = { ...this.state.countdown, ...config };
    this.saveState();
  }

  // --- Admin Roles ---
  public getAdmins(): string[] {
    return this.state.user_roles.filter((r) => r.role === "admin").map((r) => r.user_id);
  }

  public setAdmin(userId: string) {
    if (!this.state.user_roles.some((r) => r.user_id === userId && r.role === "admin")) {
      this.state.user_roles.push({
        id: `role-${Date.now()}`,
        user_id: userId,
        role: "admin",
      });
      this.saveState();
    }
  }

  public removeAdmin(userId: string) {
    this.state.user_roles = this.state.user_roles.filter(
      (r) => !(r.user_id === userId && r.role === "admin"),
    );
    this.saveState();
  }

  // --- Leaderboard Calculation ---
  public getLeaderboard(from?: string | null, to?: string | null) {
    // 1. Group approved activities by user_id
    const userKmMap = new Map<string, number>();
    for (const act of this.state.activities) {
      if (act.status !== "approved") continue;
      if (from && act.ride_date < from) continue;
      if (to && act.ride_date > to) continue;
      const current = userKmMap.get(act.user_id) || 0;
      userKmMap.set(act.user_id, current + Number(act.km));
    }

    // 2. Map profiles with patrol info
    const rows = this.state.profiles
      .filter((p) => !!p.patrol_id)
      .map((p) => {
        const patrol = this.state.patrols.find((pa) => pa.id === p.patrol_id);
        const km = userKmMap.get(p.id) || 0;
        const isChef =
          patrol?.name.toLowerCase().includes("staff") ||
          patrol?.name.toLowerCase().includes("chef") ||
          patrol?.category === "mixte" ||
          p.is_chef;

        return {
          user_id: p.id,
          display_name: p.totem
            ? `${p.totem}${p.quali ? " " + p.quali : ""}`
            : p.full_name || "Scout",
          full_name: p.full_name || "Scout",
          totem: p.totem,
          quali: p.quali,
          scout_year: isChef ? null : p.scout_year,
          is_chef: isChef,
          patrol_id: p.patrol_id!,
          patrol_name: patrol?.name || "Patrouille",
          category: patrol?.category || "mixte",
          km,
        };
      });

    return rows;
  }
}

export const db = new StandaloneDatabase();
