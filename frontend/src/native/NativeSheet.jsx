import { X } from "lucide-react";
import { useModalFocus } from "../hooks/useModalFocus.js";

export default function NativeSheet({ title, onClose, children }) {
  const ref = useModalFocus(true, onClose);
  return (
    <div
      className="native-sheet-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="native-sheet"
      >
        <div aria-hidden="true" className="native-sheet-handle" />
        <header>
          <h2>{title}</h2>
          <button
            type="button"
            className="native-icon-button"
            aria-label="Fermer"
            onClick={onClose}
          >
            <X aria-hidden="true" />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
