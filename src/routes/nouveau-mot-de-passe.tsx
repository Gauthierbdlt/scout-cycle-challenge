import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/nouveau-mot-de-passe")({
  ssr: false,
  head: () => ({ meta: [{ title: "Nouveau mot de passe — ALEZAN 42" }] }),
  component: NewPasswordPage,
});

/**
 * Page ouverte depuis le lien « mot de passe oublié » reçu par e-mail.
 * Supabase ouvre une session temporaire à partir du lien ; on demande
 * ensuite le nouveau mot de passe.
 */
function NewPasswordPage() {
  const [ready, setReady] = useState(false);
  const [checked, setChecked] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" || session) {
        setReady(true);
        setChecked(true);
      }
    });
    // Le lien a peut-être déjà été traité avant l'abonnement
    supabase.auth.getSession().then(({ data: s }) => {
      if (!active) return;
      if (s.session) setReady(true);
      setChecked(true);
    });
    return () => {
      active = false;
      data?.subscription?.unsubscribe?.();
    };
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 6) {
      toast.error("Le mot de passe doit comporter au moins 6 caractères.");
      return;
    }
    if (pw !== pw2) {
      toast.error("Les deux mots de passe ne sont pas identiques.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) {
      toast.error("Impossible de changer le mot de passe : " + error.message);
      return;
    }
    toast.success("Mot de passe changé ! Tu es connecté.");
    window.location.href = "/";
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-md px-4 py-10">
        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            <h1 className="font-display text-xl font-bold text-foreground">
              Choisir un nouveau mot de passe
            </h1>
          </div>

          {!checked ? (
            <p className="text-sm text-muted-foreground">Vérification du lien…</p>
          ) : !ready ? (
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                Ce lien n&apos;est plus valide (il a peut-être déjà servi ou a expiré). Refais une
                demande depuis la page de connexion, ou demande à un animateur de réinitialiser ton
                mot de passe.
              </p>
              <Button asChild variant="outline">
                <Link to="/auth">Retour à la connexion</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={save} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="new-pw">Nouveau mot de passe</Label>
                <Input
                  id="new-pw"
                  type="password"
                  autoComplete="new-password"
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-pw2">Confirme le mot de passe</Label>
                <Input
                  id="new-pw2"
                  type="password"
                  autoComplete="new-password"
                  value={pw2}
                  onChange={(e) => setPw2(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" disabled={busy} className="w-full font-bold">
                {busy ? "Enregistrement…" : "Enregistrer le mot de passe"}
              </Button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
