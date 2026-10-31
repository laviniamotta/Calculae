
import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";

export function Logo({ tagline = false }: { tagline?: boolean }) {
  const { session } = useAuth();
  const destination = session ? "/painel" : "/";

  return (
    <Link
      to={destination}
      className="logo"
      aria-label={
        session
          ? "CalculaÊ! — ir para o painel"
          : "CalculaÊ! — página inicial"
      }
    >
      Calcula<b>Ê!</b>
      {tagline && <small>Comissão sem complicação.</small>}
    </Link>
  );
}
