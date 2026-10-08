import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

/**
 * « Mot de passe oublié ? » sur la page de connexion.
 *
 * Envoie un lien de réinitialisation par e-mail. Tant qu'aucun serveur SMTP
 * n'est configuré dans Supabase, l'e-mail n'arrive qu'aux membres de l'équipe
 * Supabase : le message renvoie donc aussi vers un animateur, qui peut définir
 * un mot de passe temporaire depuis la page admin.
 */
export function ForgotPassword({ initialEmail = "" }: { initialEmail?: string }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(initialEmail);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setEmail(initialEmail);
          setOpen(true);
        }}
        className="text-xs font-medium text-muted-foreground hover:text-primary hover:underline"
      >
        Mot de passe oublié ?
      </button>
    );
  }

  const send = async () => {
    const value = email.trim();
    if (!value) return;
    setBusy(true);
    // On ne révèle jamais si l'adresse existe : même message dans tous les cas.
    await supabase.auth
      .resetPasswordForEmail(value, {
        redirectTo: `${window.location.origin}/nouveau-mot-de-passe`,
      })
      .catch(() => undefined);
    setBusy(false);
    setDone(true);
  };

  return (
    <div className="space-y-2 rounded-xl border bg-muted/30 p-3 text-left">
      {done ? (
        <p className="text-xs text-foreground">
          Si un compte existe pour <strong>{email.trim()}</strong>, un lien pour choisir un nouveau
          mot de passe vient d&apos;être envoyé (pense à regarder dans les spams).
          <br />
          <strong>Rien reçu après quelques minutes ?</strong> Demande à un animateur : il peut te
          donner un mot de passe temporaire.
        </p>
      ) : (
        <>
          <Label htmlFor="forgot-email" className="text-xs font-semibold">
            Ton adresse e-mail
          </Label>
          <Input
            id="forgot-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="scout@troupe.fr"
          />
          <Button
            type="button"
            size="sm"
            disabled={busy || !email.trim()}
            onClick={send}
            className="w-full"
          >
            {busy ? "Envoi…" : "Recevoir un lien de réinitialisation"}
          </Button>
          <p className="text-[11px] text-muted-foreground">
            Tu peux aussi demander à un animateur de réinitialiser ton mot de passe.
          </p>
        </>
      )}
      <button
        type="button"
        onClick={() => {
          setOpen(false);
          setDone(false);
        }}
        className="text-[11px] text-muted-foreground hover:underline"
      >
        Fermer
      </button>
    </div>
  );
}
