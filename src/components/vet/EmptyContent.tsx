import { Mascot } from "./Mascot";

export function EmptyContent({ text = "Nenhuma disciplina publicada ainda." }: { text?: string }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-card p-10 text-center">
      <Mascot className="h-24 w-24" mood="think" />
      <p className="mt-4 font-medium">{text}</p>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        O conteúdo será adicionado a partir dos materiais de referência do curso.
      </p>
    </div>
  );
}