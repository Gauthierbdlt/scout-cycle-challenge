import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import {
  Heart,
  Bike,
  ArrowLeft,
  ExternalLink,
  Trophy,
  Sparkles,
  Flame,
  Target,
  Gift,
  Footprints,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/lib/supabase";
import { db } from "@/lib/database";

export const Route = createFileRoute("/solidarite")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "ASBL Profitivisme & Solidarité — ALEZAN 42" },
      {
        name: "description",
        content:
          "Objectifs solidaires, 24h et marche parrainée de la troupe ALEZAN 42 au profit de l'ASBL Profitivisme.",
      },
      { property: "og:title", content: "ASBL Profitivisme & Solidarité — ALEZAN 42" },
      {
        property: "og:description",
        content:
          "Profiter de la vie malgré tout. Pédaler ensemble pour soutenir l'ASBL Profitivisme.",
      },
    ],
  }),
  component: SolidarityPage,
});

function SolidarityPage() {
  const [totalKm, setTotalKm] = useState<number>(0);

  // Récupération des kilomètres collectifs (identique à ton composant CollectiveRouteMap)
  const loadCollectiveDistance = useCallback(async () => {
    try {
      const { data: actsData } = await supabase.from("activities_public").select("km, status");
      let kmSum = 0;
      if (actsData && actsData.length > 0) {
        kmSum = actsData
          .filter((a) => a.status === "approved" || a.status === "pending")
          .reduce((sum, item) => sum + (Number(item.km) || 0), 0);
      }
      setTotalKm(Math.round(kmSum * 10) / 10);
    } catch (err) {
      console.warn("Erreur chargement kilomètres collectifs :", err);
      setTotalKm(0);
    }
  }, []);

  useEffect(() => {
    loadCollectiveDistance();
    return db.subscribe(() => loadCollectiveDistance());
  }, [loadCollectiveDistance]);

  // Définition des objectifs en kilomètres
  const goal24h = 1000; // Objectif de km pour les 24h
  const goalMarche = 500; // Objectif de km pour la marche parrainée

  const progress24h = Math.min(100, Math.round((totalKm / goal24h) * 100));
  const progressMarche = Math.min(100, Math.round((totalKm / goalMarche) * 100));

  return (
    <div className="min-h-screen bg-background">
      {/* Header Banner */}
      <section className="relative overflow-hidden bg-bark py-14 text-bark-foreground md:py-20">
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-rose-500/20 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-rose-500/10 border border-rose-500/20 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-rose-300">
                <Heart className="h-3.5 w-3.5 fill-rose-400 text-rose-400" />
                <span>ASBL Profitivisme — Ride On !</span>
              </div>
              <h1 className="mt-3 text-3xl font-black md:text-5xl text-white">
                Pédaler pour la Bonne Cause
              </h1>
              <p className="mt-2 max-w-xl text-base text-bark-foreground/80">
                Inspirés par l'énergie de Gilles Van der Spek et le documentaire de Charles Masset,
                la Troupe ALEZAN 42 met ses roues au service de la lutte contre le cancer.
              </p>
            </div>
            <div>
              <Button
                asChild
                variant="outline"
                className="gap-2 rounded-xl border-bark-foreground/30 bg-bark-foreground/10 text-bark-foreground hover:bg-bark-foreground/20 text-xs font-semibold"
              >
                <Link to="/">
                  <ArrowLeft className="h-4 w-4" />
                  Retour à l'accueil
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="mx-auto max-w-4xl px-4 py-10 space-y-8">
        {/* Section Objectifs de km (24h & Marche Parrainée) */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Objectif 24h */}
          <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-orange-500/10 text-orange-400 border border-orange-500/20">
                  <Target className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="font-display font-bold text-foreground">Défi des 24h</h3>
                  <p className="text-xs text-muted-foreground">Objectif de dons & kilomètres</p>
                </div>
              </div>
              <span className="font-mono font-black text-sm text-orange-400">
                {totalKm} / {goal24h} km
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Cumulons un maximum de kilomètres lors des 24h pour déclencher un don exceptionnel au
              profit de l'ASBL Profitivisme !
            </p>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-muted-foreground">Progression</span>
                <span className="text-primary">{progress24h}%</span>
              </div>
              <Progress value={progress24h} className="h-2.5 rounded-full" />
            </div>
          </div>

          {/* Objectif Marche Parrainée */}
          <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Footprints className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="font-display font-bold text-foreground">Marche Parrainée</h3>
                  <p className="text-xs text-muted-foreground">Effort collectif & parrainage</p>
                </div>
              </div>
              <span className="font-mono font-black text-sm text-emerald-400">
                {totalKm} / {goalMarche} km
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Chaque entraînement et chaque kilomètre validé sur la plateforme renforce l'impact de
              notre marche parrainée.
            </p>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-muted-foreground">Progression</span>
                <span className="text-emerald-500">{progressMarche}%</span>
              </div>
              <Progress value={progressMarche} className="h-2.5 rounded-full" />
            </div>
          </div>
        </div>

        {/* Section Histoire / Profitivisme */}
        <div className="rounded-2xl border border-border/80 bg-card p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 shrink-0">
              <Bike className="h-6 w-6" />
            </span>
            <div>
              <h2 className="font-display text-xl font-bold text-foreground">
                L'esprit du « Profitivisme »
              </h2>
              <p className="text-xs text-rose-400 font-medium">Profiter de la vie, malgré tout</p>
            </div>
          </div>

          <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
            <p>
              Derrière ce mot-valise se cache une philosophie de vie extraordinaire initiée par
              Gilles Van der Spek : un optimisme infaillible et un besoin viscéral de profiter de
              chaque instant, même face à l'adversité de la maladie.
            </p>
            <p>
              Cycliste passionné, il s'était lancé des défis fous — comme rouler 24 heures d'affilée
              dans une nacelle de la grande roue de Bruxelles — pour transformer son combat en un
              message d'espoir. Aujourd'hui, l'ASBL <strong>Profitivisme</strong> continue de faire
              vivre cet héritage en soutenant les personnes touchées par le cancer.
            </p>
          </div>

          <div className="pt-2 flex flex-wrap items-center justify-between gap-4 border-t border-border/80">
            <span className="text-xs text-muted-foreground italic">
              « You May Have Been Given A Cactus, But You Don't Have To Sit On It. » 🌵
            </span>
            <a
              href="https://profitivisme.org"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline underline-offset-4"
            >
              Visiter le site de l'ASBL Profitivisme
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>

        {/* Appel à l'action */}
        <div className="text-center rounded-2xl bg-primary/10 border border-primary/20 p-6 sm:p-8 space-y-4">
          <div className="inline-flex items-center gap-1 text-xs font-bold text-primary">
            <Flame className="h-4 w-4" />
            <span>Chaque kilomètre compte</span>
          </div>
          <h2 className="font-display text-xl font-bold text-foreground">
            Prêt à porter les couleurs du Profitivisme ?
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-xl mx-auto">
            Enfilez vos casques, cumulez vos kilomètres sur la plateforme de la troupe ALEZAN 42 et
            portons ensemble ce magnifique projet solidaire !
          </p>
          <div className="pt-2">
            <Button asChild className="rounded-xl font-bold shadow-md">
              <Link to="/mes-km">Enregistrer mes kilomètres</Link>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default SolidarityPage;
