import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Mascot } from "@/components/vet/Mascot";
import { MODE_LABELS, scorePercent, type QuizMode } from "@/lib/quiz";

export const Route = createFileRoute("/_authenticated/historico")({
  head: () => ({
    meta: [
      { title: "Meu histórico — VetStudy" },
      { name: "description", content: "Acompanhe seus quizzes de anatomia veterinária e sua evolução." },
      { property: "og:title", content: "Meu histórico — VetStudy" },
      { property: "og:description", content: "Acompanhe seus quizzes e sua evolução." },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["attempts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quiz_attempts")
        .select("id, mode, score, total, created_at, topics(name, disciplines(name))")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const totalQ = data?.reduce((s, a) => s + a.total, 0) ?? 0;
  const totalOk = data?.reduce((s, a) => s + a.score, 0) ?? 0;

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-semibold">Meu histórico</h1>
      {isLoading ? <Skeleton className="mt-6 h-48 rounded-xl" /> : !data || data.length === 0 ? (
        <div className="mt-8 flex flex-col items-center rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <Mascot className="h-24 w-24" mood="think" />
          <p className="mt-4 font-medium">Você ainda não fez nenhum quiz.</p>
          <Button asChild className="mt-4"><Link to="/">Começar a estudar</Link></Button>
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <Stat label="Quizzes feitos" value={String(data.length)} />
            <Stat label="Questões respondidas" value={String(totalQ)} />
            <Stat label="Aproveitamento" value={`${scorePercent(totalOk, totalQ)}%`} />
          </div>
          <ul className="mt-8 divide-y divide-border rounded-xl border border-border bg-card">
            {data.map((a) => {
              const pct = scorePercent(a.score, a.total);
              return (
                <li key={a.id} className="flex items-center justify-between gap-4 p-4">
                  <div>
                    <p className="font-medium">{a.topics ? a.topics.name : "Vários tópicos"}</p>
                    <p className="text-sm text-muted-foreground">
                      {a.topics?.disciplines?.name ? `${a.topics.disciplines.name} · ` : ""}
                      {MODE_LABELS[a.mode as QuizMode]} · {new Date(a.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <span className={pct >= 60 ? "font-semibold text-success" : "font-semibold text-destructive"}>
                    {a.score}/{a.total}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-3xl font-semibold text-primary">{value}</p>
    </div>
  );
}