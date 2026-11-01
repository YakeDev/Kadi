import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Building2,
  ChevronRight,
  FileText,
  Info,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.jsx";
import NativeSheet from "./NativeSheet.jsx";

import { nativeRootPaths } from "./platform.js";

export default function NativeTopbar() {
  const { pathname } = useLocation();
  const { user, profile, logout, isSuperAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const company = profile?.company?.trim() || "Mon entreprise";
  const name =
    profile?.manager_name?.trim() || user?.email?.split("@")[0] || "Mon compte";
  const initials = name
    .split(/[\s._-]+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase("fr-FR");
  const root = nativeRootPaths.includes(pathname);
  const back = pathname.startsWith("/devis")
    ? "/devis"
    : pathname.startsWith("/factures")
      ? "/factures"
      : "/";
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      <header
        className="app-topbar native-topbar"
        aria-label="Barre supérieure"
      >
        <div className="native-topbar-inner">
          {root ? (
            <span className="native-app-mark">
              <FileText aria-hidden="true" />
            </span>
          ) : (
            <Link className="native-icon-button" to={back} aria-label="Retour">
              <ArrowLeft aria-hidden="true" />
            </Link>
          )}
          <div className="native-topbar-identity">
            <span>Kadi</span>
            <p>{company}</p>
          </div>
          <button
            type="button"
            aria-label="Menu du compte"
            aria-expanded={open}
            onClick={() => setOpen(true)}
            className="native-avatar"
          >
            {initials}
          </button>
        </div>
      </header>
      {open ? (
        <NativeSheet
          title="Mon espace"
          onClose={() => {
            if (!pending) setOpen(false);
          }}
        >
          <div className="native-account-identity">
            <span className="native-avatar">{initials}</span>
            <div>
              <strong>{name}</strong>
              <p>{user?.email}</p>
              <p>{company}</p>
            </div>
          </div>
          <div className="native-account-links">
            <Link to="/entreprise" onClick={() => setOpen(false)}>
              <Building2 aria-hidden="true" />
              <span>Mon entreprise</span>
              <ChevronRight aria-hidden="true" />
            </Link>
            <Link to="/a-propos" onClick={() => setOpen(false)}>
              <Info aria-hidden="true" />
              <span>À propos de Kadi</span>
              <ChevronRight aria-hidden="true" />
            </Link>
            {isSuperAdmin ? (
              <Link to="/administration" onClick={() => setOpen(false)}>
                <ShieldCheck aria-hidden="true" />
                <span>Administration Kadi</span>
                <ChevronRight aria-hidden="true" />
              </Link>
            ) : null}
            <button
              type="button"
              disabled={pending}
              className="native-logout"
              onClick={async () => {
                setPending(true);
                setError(false);
                try {
                  await logout();
                  setOpen(false);
                } catch {
                  setError(true);
                } finally {
                  setPending(false);
                }
              }}
            >
              <LogOut aria-hidden="true" />
              <span>{pending ? "Déconnexion…" : "Se déconnecter"}</span>
            </button>
          </div>
          {error ? (
            <p role="alert" className="text-sm text-red-700">
              Déconnexion impossible. Réessayez.
            </p>
          ) : null}
          <p className="native-build-label">Kadi Pilote · 0.2.0</p>
        </NativeSheet>
      ) : null}
    </>
  );
}
