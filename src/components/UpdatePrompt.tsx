import { useRegisterSW } from "virtual:pwa-register/react";

/** Avisa quando há versão nova e deixa o usuário escolher o momento de atualizar. */
export function UpdatePrompt() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW();
  if (!needRefresh) return null;
  return (
    <div className="update-banner" role="status">
      <span>Nova versão disponível.</span>
      <button className="btn" onClick={() => void updateServiceWorker(true)}>Atualizar agora</button>
    </div>
  );
}
