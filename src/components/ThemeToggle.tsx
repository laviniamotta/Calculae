
import { useEffect, useRef, useState } from "react";
import { useTheme, type ThemePreference } from "../lib/theme";

const options: {
  value: ThemePreference;
  label: string;
  description: string;
}[] = [
  {
    value: "light",
    label: "Claro",
    description: "Fundo claro",
  },
  {
    value: "dark",
    label: "Escuro",
    description: "Fundo escuro",
  },
  {
    value: "system",
    label: "Automático",
    description: "Seguir dispositivo",
  },
];

function ThemeIcon({ type }: { type: ThemePreference }) {
  if (type === "light") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" />
      </svg>
    );
  }

  if (type === "dark") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M20.5 15.2A8.5 8.5 0 0 1 8.8 3.5 8.5 8.5 0 1 0 20.5 15.2Z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="4" />
      <path d="M12 4v16" />
      <path d="M12 8a4 4 0 0 1 0 8Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function ThemeToggle() {
  const [pref, setPref] = useTheme();
  const [open, setOpen] = useState(false);
  const controlRef = useRef<HTMLDivElement>(null);

  const currentLabel =
    options.find((option) => option.value === pref)?.label ?? "Automático";

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !controlRef.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function selectTheme(value: ThemePreference) {
    setPref(value);
    setOpen(false);
  }

  return (
    <div className="theme-control" ref={controlRef}>
      <button
        type="button"
        className={`theme-trigger${open ? " is-open" : ""}`}
        aria-label={`Tema atual: ${currentLabel}. Alterar aparência`}
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls="theme-popup"
        title={`Aparência: ${currentLabel}`}
        onClick={() => setOpen((previous) => !previous)}
      >
        <ThemeIcon type={pref} />

        <span className="theme-trigger-chevron" aria-hidden="true">
          <svg viewBox="0 0 12 12" fill="none">
            <path d="m3 4.5 3 3 3-3" />
          </svg>
        </span>
      </button>

      {open && (
        <div
          id="theme-popup"
          className="theme-popup"
          role="group"
          aria-label="Escolher aparência"
        >
          <p className="theme-popup-heading">Aparência</p>

          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`theme-popup-option${
                pref === option.value ? " is-active" : ""
              }`}
              aria-pressed={pref === option.value}
              onClick={() => selectTheme(option.value)}
            >
              <span className="theme-popup-icon">
                <ThemeIcon type={option.value} />
              </span>

              <span className="theme-popup-copy">
                <span className="theme-popup-label">{option.label}</span>
                <span className="theme-popup-description">
                  {option.description}
                </span>
              </span>

              {pref === option.value && (
                <svg
                  className="theme-popup-check"
                  viewBox="0 0 20 20"
                  fill="none"
                  aria-hidden="true"
                >
                  <path d="m5 10 3.2 3.2L15 6.5" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
