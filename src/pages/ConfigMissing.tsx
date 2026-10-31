import { Logo } from "../components/Logo";

export function ConfigMissing() {
  return (
    <main className="main">
      <Logo tagline />
      <section className="card" style={{ marginTop: "1.5rem" }}>
        <h1>Configuração do Supabase ausente</h1>
        <p>Copie <code>.env.example</code> para <code>.env.local</code>, preencha <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code> (Supabase → Project Settings → API) e reinicie o <code>npm run dev</code>.</p>
        <p className="muted">Use somente a chave <strong>anon</strong> pública. Nunca a <code>service_role</code>.</p>
      </section>
    </main>
  );
}
