import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpenText, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { EmptyContent } from "@/components/vet/EmptyContent";
import { Skeleton } from "@/components/ui/skeleton";
import { MarkdownContent } from "@/components/vet/MarkdownContent";

export const Route = createFileRoute("/resumos")({
  head: () => ({
    meta: [
      { title: "Resumos aprovados — VetStudy" },
      { name: "description", content: "Materiais de estudo revisados e aprovados pela equipe VetStudy." },
    ],
  }),
  component: ApprovedSummariesPage,
});

function ApprovedSummariesPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["approved-study-summaries"],
    queryFn: async () => {
      const db = supabase as any;
      const { data, error } = await db
        .from("study_summaries")
        .select("id,title,content_markdown,created_at,topics(name)")
        .eq("review_status", "approved")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:py-10">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-primary/10 p-3 text-primary"><BookOpenText className="h-6 w-6" /></div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">Biblioteca VetStudy</p>
          <h1 className="text-3xl font-semibold sm:text-4xl">Resumos de aula</h1>
        </div>
      </div>
      <p className="mt-3 max-w-2xl text-muted-foreground">Consulte resumos preparados a partir dos materiais das aulas e revisados pela administração.</p>

      {isLoading ? (
        <div className="mt-8"><Skeleton className="h-64 rounded-2xl" /></div>
      ) : isError ? (
        <div className="mt-8"><EmptyContent text="Não foi possível carregar os resumos." /></div>
      ) : !data?.length ? (
        <div className="mt-8"><EmptyContent text="Ainda não há resumos publicados. Novos materiais aparecerão aqui depois da revisão." /></div>
      ) : (
        <div className="mt-8 space-y-5">
          {data.map((summary: any) => (
            <article key={summary.id} className="rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-7">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-secondary p-2"><FileText className="h-5 w-5" /></div>
                <div>
                  <h2 className="text-xl font-semibold">{summary.title}</h2>
                  {summary.topics?.name && <p className="mt-1 text-sm text-muted-foreground">{summary.topics.name}</p>}
                </div>
              </div>
              <div className="mt-5"><MarkdownContent content={summary.content_markdown} /></div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
