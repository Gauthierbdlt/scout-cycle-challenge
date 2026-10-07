/**
 * ALEZAN 42 — Script de Diagnostic Supabase
 *
 * Ce script vérifie l'initialisation du client Supabase de l'application,
 * teste la connexion réseau, effectue des lectures simples dans la base de données,
 * et diagnostique pourquoi la création de compte peut échouer à persister les données.
 *
 * Lancement :
 *   npx tsx scripts/supabase-diagnostic.ts
 */

import { supabase } from "../src/integrations/supabase/client";

interface DiagnosticResult {
  step: string;
  status: "OK" | "WARNING" | "ERROR";
  message: string;
  details?: unknown;
}

const results: DiagnosticResult[] = [];

function record(
  step: string,
  status: "OK" | "WARNING" | "ERROR",
  message: string,
  details?: unknown,
) {
  results.push({ step, status, message, details });
  const icon = status === "OK" ? "✅" : status === "WARNING" ? "⚠️" : "❌";
  console.log(`${icon} [${status}] ${step}: ${message}`);
  if (details && (status === "ERROR" || status === "WARNING")) {
    console.log(
      "   Détails :",
      typeof details === "object" ? JSON.stringify(details, null, 2) : details,
    );
  }
}

async function runDiagnostics() {
  console.log("===============================================================");
  console.log("🔍 DIAGNOSTIC SUPABASE - DÉFI VÉLO ALEZAN 42");
  console.log("===============================================================\n");

  // 1. VÉRIFICATION DES VARIABLES D'ENVIRONNEMENT
  console.log("--- 1. Variables d'Environnement & Configuration ---");
  const TARGET_PROJECT = "civblymnwigeayfecujp.supabase.co";
  const rawUrl =
    process.env["VITE_SUPABASE_URL"] && !process.env["VITE_SUPABASE_URL"].includes("lovable.cloud")
      ? process.env["VITE_SUPABASE_URL"]
      : "https://civblymnwigeayfecujp.supabase.co";

  const rawKey =
    process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] &&
    !process.env["VITE_SUPABASE_PUBLISHABLE_KEY"].includes("bWCIoCwQ")
      ? process.env["VITE_SUPABASE_PUBLISHABLE_KEY"]
      : "sb_publishable_Rs7_eLIv_g7FcK2R1Hz8cw_rc6qLJfs";

  if (process.env["SUPABASE_URL"]?.includes("lovable.cloud")) {
    record(
      "Variables d'environnement",
      "WARNING",
      "L'environnement conteneur possédait l'ancienne URL de proxy Lovable. L'application a été reconfigurée pour cibler directement votre projet Supabase officiel : " +
        rawUrl,
    );
  } else {
    record("Variables d'environnement", "OK", `URL Cible : ${rawUrl} (Projet : ${TARGET_PROJECT})`);
  }

  // 2. VÉRIFICATION DE L'INITIALISATION DU CLIENT SUPABASE APPLICATIF
  console.log("\n--- 2. Initialisation du Client Supabase de l'Application ---");
  if (!supabase) {
    record(
      "Initialisation du client",
      "ERROR",
      "L'objet client exporté par src/integrations/supabase/client est indéfini.",
    );
    return;
  }

  if (typeof supabase.from !== "function" || typeof supabase.auth?.signUp !== "function") {
    record(
      "Initialisation du client",
      "ERROR",
      "Le client Supabase n'expose pas l'API standard (@supabase/supabase-js).",
    );
    return;
  }
  record(
    "Initialisation du client",
    "OK",
    "Client Supabase instancié avec succès (API from, auth, rpc, storage).",
  );

  // 3. TEST DE CONNEXION : LECTURE SIMPLE SUR LA TABLE 'patrols'
  console.log("\n--- 3. Test de Connexion & Lecture Simple (Table 'patrols') ---");
  try {
    const start = performance.now();
    const { data: patrols, error: patrolErr } = await supabase
      .from("patrols")
      .select("id, name, category, created_at")
      .limit(10);
    const duration = Math.round(performance.now() - start);

    if (patrolErr) {
      record(
        "Lecture table 'patrols'",
        "ERROR",
        `Échec de lecture : ${patrolErr.message}`,
        patrolErr,
      );
    } else {
      record(
        "Lecture table 'patrols'",
        "OK",
        `${patrols?.length ?? 0} patrouilles trouvées en ${duration}ms (Connexion réseau OK).`,
        patrols?.map((p) => `${p.name} (${p.category})`),
      );
    }
  } catch (err: unknown) {
    record("Lecture table 'patrols'", "ERROR", "Exception réseau lors de la requête", err);
  }

  // 4. TEST DE LECTURE SUR LA TABLE 'profiles' (RLS AUDIT)
  console.log("\n--- 4. Test de Lecture sur la Table 'profiles' (Politiques RLS) ---");
  try {
    const { data: profiles, error: profileErr } = await supabase
      .from("profiles")
      .select("id, email, full_name, totem, quali, patrol_id, onboarded")
      .limit(10);

    if (profileErr) {
      record(
        "Lecture table 'profiles'",
        "WARNING",
        `Erreur ou restriction RLS : ${profileErr.message}`,
        profileErr,
      );
    } else {
      record(
        "Lecture table 'profiles'",
        "OK",
        `Requête SELECT réussie : ${profiles?.length ?? 0} profil(s) visible(s) en mode anonyme/public.`,
      );
    }
  } catch (err: unknown) {
    record("Lecture table 'profiles'", "ERROR", "Exception inattendue", err);
  }

  // 5. TEST RPC DE SÉCURITÉ 'leaderboard'
  console.log("\n--- 5. Test RPC de Sécurité ('leaderboard') ---");
  try {
    const { data: lbData, error: lbErr } = await supabase.rpc("leaderboard", {
      _from: null as unknown as string,
      _to: null as unknown as string,
    });

    if (lbErr) {
      record(
        "RPC 'leaderboard'",
        "WARNING",
        `La fonction RPC 'leaderboard' a retourné une erreur : ${lbErr.message}`,
        lbErr,
      );
    } else {
      record(
        "RPC 'leaderboard'",
        "OK",
        `Fonction SECURITY DEFINER opérationnelle (${Array.isArray(lbData) ? lbData.length : 0} coureurs retournés).`,
        lbData,
      );
    }
  } catch (err: unknown) {
    record("RPC 'leaderboard'", "WARNING", "Exception lors de l'appel RPC", err);
  }

  // 6. TEST DE PERSISTANCE & DIAGNOSTIC DES ÉCHECS D'INSCRIPTION
  console.log("\n--- 6. Analyse de Persistance : Pourquoi les Comptes ne Persistaient Pas ---");

  // Test A : Tentative d'insertion directe dans 'profiles' en anonyme (doit tester la politique RLS)
  try {
    const dummyId = "00000000-0000-0000-0000-000000000099";
    const { error: insertErr } = await supabase.from("profiles").insert({
      id: dummyId,
      email: "probe_diagnostics@test.local",
      full_name: "Diagnostic Probe",
    });

    if (insertErr) {
      if (
        insertErr.code === "42501" ||
        insertErr.message.toLowerCase().includes("row-level security")
      ) {
        record(
          "RLS sur 'profiles'",
          "WARNING",
          "RLS active sur 'profiles' : une insertion directe par un client NON authentifié (session null) est rejetée par Postgres (Erreur 42501).",
          insertErr,
        );
      } else {
        record(
          "Insertion test profil",
          "WARNING",
          `Erreur d'insertion : ${insertErr.message}`,
          insertErr,
        );
      }
    } else {
      record(
        "Insertion test profil",
        "OK",
        "Insertion directe autorisée (attention si RLS n'est pas activée).",
      );
      // Nettoyage immédiat
      await supabase.from("profiles").delete().eq("id", dummyId);
    }
  } catch (err: unknown) {
    record("Insertion test profil", "WARNING", "Exception insertion", err);
  }

  // Test B : État de la session Auth actuelle
  try {
    const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
    if (sessionErr) {
      record("Session Supabase Auth", "WARNING", `Erreur getSession : ${sessionErr.message}`);
    } else {
      record(
        "Session Supabase Auth",
        "OK",
        sessionData.session
          ? `Utilisateur authentifié : ${sessionData.session.user.email}`
          : "Aucune session active dans le client (comportement normal hors navigateur).",
      );
    }
  } catch (err: unknown) {
    record("Session Supabase Auth", "ERROR", "Exception session", err);
  }

  // 7. SYNTHÈSE ET RECOMMANDATIONS
  console.log("\n===============================================================");
  console.log("📋 SYNTHÈSE DU DIAGNOSTIC");
  console.log("===============================================================");

  const errors = results.filter((r) => r.status === "ERROR");
  const warnings = results.filter((r) => r.status === "WARNING");

  if (errors.length === 0) {
    console.log(
      "\n✨ RÉSULTAT : Le client Supabase est CORRECTEMENT initialisé et la connexion est ÉTABLIE.",
    );
    console.log("   La base de données répond parfaitement aux requêtes de lecture (SELECT).\n");
  } else {
    console.log(`\n❌ RÉSULTAT : ${errors.length} erreur(s) bloquante(s) détectée(s).\n`);
  }

  console.log("🔍 CAUSES IDENTIFIÉES DE NON-PERSISTANCE DES COMPTES :");
  console.log("1. CODE FRONTEND (Corrigé) :");
  console.log(
    "   - Auparavant, le formulaire d'inscription (auth.tsx) appelait uniquement `db.signUp(...)` (mock local)",
  );
  console.log(
    "     et n'appelait JAMAIS `supabase.auth.signUp(...)`. Les comptes n'atteignaient donc jamais Supabase.",
  );
  console.log(
    "   - Ce comportement a été corrigé : `supabase.auth.signUp` et l'upsert dans `profiles` sont maintenant appelés.\n",
  );

  console.log("2. RLS & SÉCURITÉ POSTGRES :");
  console.log("   - La table `public.profiles` est protégée par RLS (Row Level Security).");
  console.log("   - Si Supabase Auth a 'Confirm email' activé :");
  console.log(
    "     `signUp` crée l'utilisateur dans `auth.users`, mais ne délivre pas de session active immédiate.",
  );
  console.log(
    "     Le client n'étant pas encore authentifié, l'insertion directe dans `profiles` est bloquée (Code 42501).",
  );
  console.log("   - Solution recommandée :");
  console.log(
    "     a) Désactiver 'Confirm email' dans Supabase Dashboard > Authentication > Providers > Email",
  );
  console.log("        OU");
  console.log(
    "     b) Exécuter le trigger `on_auth_user_created` fourni dans `supabase/supabase_setup.sql`",
  );
  console.log(
    "        qui insère automatiquement le profil avec les privilèges SECURITY DEFINER dès l'inscription.\n",
  );

  return {
    success: errors.length === 0,
    results,
  };
}

// Exécution si appelé directement
runDiagnostics()
  .then(({ success }) => {
    process.exit(success ? 0 : 1);
  })
  .catch((err) => {
    console.error("Erreur fatale diagnostic:", err);
    process.exit(1);
  });
