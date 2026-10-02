import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  Calendar,
  ExternalLink,
  Plus,
  Trash2,
  Edit2,
  FolderOpen,
  Image as ImageIcon,
  Sparkles,
  MapPin,
  Flag,
} from "lucide-react";
import { db, type TimelineEvent } from "@/lib/database";
import { useAuth } from "@/lib/useAuth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/timeline")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Timeline & Rétrospectives — ALEZAN 42" },
      {
        name: "description",
        content:
          "Retrace l'histoire, les camps d'été et les défis vélo des années précédentes de la troupe ALEZAN 42.",
      },
      { property: "og:title", content: "Timeline & Rétrospectives — ALEZAN 42" },
      {
        property: "og:description",
        content: "Retrouve les archives photos, albums Drive et souvenirs des patrouilles.",
      },
    ],
  }),
  component: TimelinePage,
});

function TimelinePage() {
  const { isAdmin } = useAuth();
  const [events, setEvents] = useState<TimelineEvent[]>(db.getTimeline());
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [formYear, setFormYear] = useState(new Date().getFullYear().toString());
  const [formDateStr, setFormDateStr] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formImageUrl, setFormImageUrl] = useState("");
  const [formDriveUrl, setFormDriveUrl] = useState("");
  const [formTag, setFormTag] = useState("Défi Vélo");

  useEffect(() => {
    return db.subscribe(() => {
      setEvents(db.getTimeline());
    });
  }, []);

  const years = Array.from(new Set(events.map((e) => e.year.toString()))).sort(
    (a, b) => Number(b) - Number(a),
  );

  const filteredEvents = events.filter(
    (e) => selectedYear === "all" || e.year.toString() === selectedYear,
  );

  const openCreateModal = () => {
    setEditingId(null);
    setFormYear(new Date().getFullYear().toString());
    setFormDateStr("");
    setFormTitle("");
    setFormDescription("");
    setFormImageUrl("");
    setFormDriveUrl("");
    setFormTag("Défi Vélo");
    setModalOpen(true);
  };

  const openEditModal = (event: TimelineEvent) => {
    setEditingId(event.id);
    setFormYear(event.year.toString());
    setFormDateStr(event.date_str);
    setFormTitle(event.title);
    setFormDescription(event.description);
    setFormImageUrl(event.image_url || "");
    setFormDriveUrl(event.drive_url || "");
    setFormTag(event.tag);
    setModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Supprimer cet événement de la timeline ?")) {
      db.deleteTimelineEvent(id);
      toast.success("Événement supprimé");
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      toast.error("Le titre est requis");
      return;
    }

    if (editingId) {
      db.updateTimelineEvent(editingId, {
        year: Number(formYear) || new Date().getFullYear(),
        date_str: formDateStr.trim() || formYear,
        title: formTitle.trim(),
        description: formDescription.trim(),
        image_url: formImageUrl.trim() || null,
        drive_url: formDriveUrl.trim() || null,
        tag: formTag.trim() || "Événement",
      });
      toast.success("Événement mis à jour");
    } else {
      db.addTimelineEvent({
        year: Number(formYear) || new Date().getFullYear(),
        date_str: formDateStr.trim() || formYear,
        title: formTitle.trim(),
        description: formDescription.trim(),
        image_url: formImageUrl.trim() || null,
        drive_url: formDriveUrl.trim() || null,
        tag: formTag.trim() || "Événement",
      });
      toast.success("Événement ajouté à la timeline");
    }
    setModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header Banner */}
      <section className="relative overflow-hidden bg-bark py-14 text-bark-foreground md:py-20">
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-primary px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary-foreground">
                <Flag className="h-3.5 w-3.5" />
                <span>Mémoire & Rétrospectives</span>
              </div>
              <h1 className="mt-3 text-3xl font-black md:text-5xl">
                La Grande Timeline de la Troupe
              </h1>
              <p className="mt-2 max-w-xl text-base text-bark-foreground/80">
                Retrace les exploits des années passées, les camps d'été, les raids à vélo et accède
                aux albums Drive des patrouilles.
              </p>
            </div>

            {isAdmin && (
              <Button
                onClick={openCreateModal}
                className="mt-4 gap-2 self-start rounded-xl font-semibold shadow-md sm:mt-0 sm:self-auto"
              >
                <Plus className="h-4 w-4" />
                Ajouter un souvenir
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="mx-auto max-w-5xl px-4 py-10">
        {/* Year Filters */}
        <div className="flex flex-wrap items-center gap-2 border-b pb-6">
          <span className="mr-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Filtrer par année :
          </span>
          <button
            onClick={() => setSelectedYear("all")}
            className={cn(
              "rounded-full border px-4 py-1.5 text-xs font-semibold transition-all",
              selectedYear === "all"
                ? "border-primary bg-primary text-primary-foreground shadow"
                : "border-border bg-card text-foreground hover:border-primary",
            )}
          >
            Toutes les années
          </button>
          {years.map((y) => (
            <button
              key={y}
              onClick={() => setSelectedYear(y)}
              className={cn(
                "rounded-full border px-4 py-1.5 text-xs font-semibold transition-all",
                selectedYear === y
                  ? "border-primary bg-primary text-primary-foreground shadow"
                  : "border-border bg-card text-foreground hover:border-primary",
              )}
            >
              {y}
            </button>
          ))}
        </div>

        {/* Vertical Timeline */}
        <div className="relative mt-10 space-y-10 before:absolute before:inset-0 before:left-4 before:h-full before:w-0.5 before:bg-border md:before:left-1/2 md:before:-translate-x-1/2">
          {filteredEvents.length === 0 ? (
            <div className="rounded-2xl border bg-card p-12 text-center text-muted-foreground">
              Aucun événement répertorié pour cette période.
            </div>
          ) : (
            filteredEvents.map((item, index) => {
              const isEven = index % 2 === 0;
              return (
                <div
                  key={item.id}
                  className={cn(
                    "relative flex flex-col md:flex-row md:items-center",
                    isEven ? "md:flex-row-reverse" : "",
                  )}
                >
                  {/* Timeline node icon */}
                  <div className="absolute left-4 z-10 -ml-3.5 flex h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow-md md:left-1/2 md:-ml-3.5">
                    <Sparkles className="h-3.5 w-3.5" />
                  </div>

                  {/* Spacer for two-column desktop layout */}
                  <div className="hidden w-1/2 md:block" />

                  {/* Card Content */}
                  <div className="ml-10 w-auto md:ml-0 md:w-1/2 md:px-6">
                    <div className="group relative overflow-hidden rounded-2xl border border-border/80 bg-card p-5 shadow-sm transition hover:border-primary/50 hover:shadow-md">
                      {/* Image if available */}
                      {item.image_url && (
                        <div className="relative -mx-5 -mt-5 mb-4 h-52 overflow-hidden bg-muted">
                          <img
                            src={item.image_url}
                            alt={item.title}
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                          <span className="absolute bottom-3 left-4 rounded-full bg-black/60 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
                            {item.tag}
                          </span>
                        </div>
                      )}

                      {/* Header */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
                          <Calendar className="h-3 w-3" />
                          {item.date_str}
                        </span>
                        {!item.image_url && (
                          <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-semibold text-secondary-foreground">
                            {item.tag}
                          </span>
                        )}
                        {isAdmin && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openEditModal(item)}
                              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                              title="Modifier"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                              title="Supprimer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      <h3 className="mt-3 font-display text-xl font-bold text-foreground">
                        {item.title}
                      </h3>

                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        {item.description}
                      </p>

                      {/* Drive Album Link */}
                      {item.drive_url && (
                        <div className="mt-4 pt-3 border-t">
                          <a
                            href={item.drive_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 rounded-lg bg-secondary px-3.5 py-2 text-xs font-semibold text-secondary-foreground transition hover:bg-primary hover:text-primary-foreground"
                          >
                            <FolderOpen className="h-4 w-4" />
                            Voir l'album photos & archives Drive
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* Admin Event Dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Modifier le souvenir" : "Ajouter un événement à la Timeline"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="ev-year">Année</Label>
                <Input
                  id="ev-year"
                  type="number"
                  value={formYear}
                  onChange={(e) => setFormYear(e.target.value)}
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="ev-date">Date affichée</Label>
                <Input
                  id="ev-date"
                  placeholder="Ex: Juillet 2025"
                  value={formDateStr}
                  onChange={(e) => setFormDateStr(e.target.value)}
                  required
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="ev-title">Titre de l'événement</Label>
              <Input
                id="ev-title"
                placeholder="Ex: Raid en Auvergne des Condors"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                required
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="ev-tag">Catégorie / Tag</Label>
              <Input
                id="ev-tag"
                placeholder="Ex: Camp d'été, Défi Vélo, Raid..."
                value={formTag}
                onChange={(e) => setFormTag(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="ev-desc">Récit / Description</Label>
              <Textarea
                id="ev-desc"
                rows={3}
                placeholder="Raconte les anecdotes, les vainqueurs, les kilomètres parcourus..."
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="ev-img">Lien vers une photo (URL)</Label>
              <Input
                id="ev-img"
                placeholder="https://..."
                value={formImageUrl}
                onChange={(e) => setFormImageUrl(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="ev-drive">Lien vers le dossier Google Drive (optionnel)</Label>
              <Input
                id="ev-drive"
                placeholder="https://drive.google.com/..."
                value={formDriveUrl}
                onChange={(e) => setFormDriveUrl(e.target.value)}
                className="mt-1"
              />
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Annuler
              </Button>
              <Button type="submit">{editingId ? "Mettre à jour" : "Ajouter à la timeline"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
