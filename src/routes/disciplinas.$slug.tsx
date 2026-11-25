import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { MODE_LABELS, type QuizMode } from "@/lib/quiz";
import { EmptyContent } from "@/components/vet/EmptyContent";

export const Route = createFileRoute("/disciplinas/$slug")({
  head: () => ({
    meta: [
      { title: "Tópicos da disciplina — VetStudy" },
      { name: "description", content: "Escolha um tópico de anatomia veterinária e o tipo de quiz." },
      { property: "og:title", content: "Tópicos da disciplina — VetStudy" },
      { property: "og:description", content: "Escolha um tópico de anatomia veterinária e o tipo de quiz." },
    ],
  }),
  component: DisciplinePage,
});

const MODES: QuizMode[] = ["text", "image", "mixed"];

function DisciplinePage() {
  const { slug } = Route.useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["discipline", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("disciplines")
        .select("id, name, description, topics(id, slug, name, description, sort_order, questions(kind))")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <div className="mx-auto max-w-4xl p-4"><Skeleton className="h-64 rounded-xl" /></div>;
  if (!data) return <div className="mx-auto max-w-4xl p-4 py-12"><EmptyContent text="Disciplina não encontrada." /></div>;

  const topics = [...data.topics].sort((a, b) => a.sort_order - b.sort_order);
  const allQs = topics.flatMap((t) => t.questions);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← Disciplinas</Link>
      <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">{data.name}</h1>
      {data.description && <p className="mt-2 text-muted-foreground">{data.description}</p>}

      {allQs.length > 0 && (
        <div className="mt-6 rounded-xl bg-secondary p-4">
          <p className="mb-3 text-sm font-medium">Quiz com todos os tópicos</p>
          <ModeButtons discipline={data.id} kinds={allQs.map((q) => q.kind)} />
        </div>
      )}

      <h2 className="mb-4 mt-10 text-xl font-semibold">Tópicos</h2>
      {topics.length === 0 ? (
        <EmptyContent text="Nenhum tópico publicado ainda." />
      ) : (
        <ul className="space-y-3">
          {topics.map((t) => (
            <li key={t.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-lg font-semibold">{t.name}</h3>
                <span className="text-xs text-muted-foreground">{t.questions.length} questões</span>
              </div>
              {t.description && <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>}
              <div className="mt-4">
                {t.questions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Questões em preparação.</p>
                ) : (
                  <ModeButtons topic={t.id} kinds={t.questions.map((q) => q.kind)} />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function ModeButtons({ topic, discipline, kinds }: { topic?: string; discipline?: string; kinds: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {MODES.map((m) => {
        const available = m === "mixed" ? kinds.length > 0 : kinds.includes(m);
        return (
          <Button key={m} asChild={available} size="sm" variant={m === "mixed" ? "default" : "outline"} disabled={!available}>
            {available ? (
              <Link to="/quiz" search={{ mode: m, topic, discipline }}>{MODE_LABELS[m]}</Link>
            ) : (
              <span>{MODE_LABELS[m]}</span>
            )}
          </Button>
        );
      })}
    </div>
  );
}