
export function ComingSoon({
  title,
  stage,
}: {
  title: string;
  stage: string;
}) {
  return (
    <section className="card">
      <h1>{title}</h1>
      <p className="muted">
        Esta tela ainda não foi construída (planejada para a {stage}).
        Nenhuma ação está disponível aqui por enquanto.
      </p>
    </section>
  );
}
