import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Mascot } from "@/components/vet/Mascot";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyContent } from "@/components/vet/EmptyContent";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "VetStudy — Quizzes de anatomia veterinária" },
      { name: "description", content: "Estude anatomia veterinária com quizzes tradicionais, de imagens e mistos, com explicações imediatas." },
      { property: "og:title", content: "VetStudy — Quizzes de anatomia veterinária" },
      { property: "og:description", content: "Quizzes de anatomia veterinária com explicações imediatas e histórico de estudo." },
    ],
  }),
  component: Index,
});

function Index() {
  const { data, isLoading } = useQuery({
    queryKey: ["disciplines"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("disciplines")
        .select("id, slug, name, description, topics(count)")
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  return (
    <main>
      <section className="bg-hero">
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-14 md:grid-cols-[1.4fr_1fr] md:py-20">
          <div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-primary">Anatomia veterinária</p>
            <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
              Estude com quizzes que <em className="text-primary">explicam</em> cada resposta.
            </h1>
            <p className="mt-4 max-w-xl text-lg text-muted-foreground">
              Escolha uma disciplina, um tópico e o tipo de quiz: tradicional, de imagens ou misto.
            </p>
          </div>
          <div className="flex justify-center">
            <div className="relative">
              <Mascot className="h-48 w-48 animate-bob sm:h-60 sm:w-60" />
              <div className="absolute -left-10 top-0 rounded-2xl rounded-br-sm bg-card px-4 py-2 text-sm font-medium shadow-soft">
                Oi! Eu sou o Bento. Bora estudar?
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="mb-6 text-2xl font-semibold">Disciplinas</h2>
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
          </div>
        ) : !data || data.length === 0 ? (
          <EmptyContent />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.map((d) => (
              <Link
                key={d.id}
                to="/disciplinas/$slug"
                params={{ slug: d.slug }}
                className="group rounded-xl border border-border bg-card p-5 transition hover:-translate-y-0.5 hover:shadow-soft"
              >
                <h3 className="text-xl font-semibold group-hover:text-primary">{d.name}</h3>
                {d.description && <p className="mt-1 text-sm text-muted-foreground">{d.description}</p>}
                <p className="mt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {(d.topics as unknown as { count: number }[])[0]?.count ?? 0} tópicos
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}