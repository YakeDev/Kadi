import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  FilePenLine,
  FileText,
  Loader2,
  Plus,
  RefreshCcw,
  Wallet,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import NativeSheet from "./NativeSheet.jsx";
import DashboardChart from "../components/DashboardChart.jsx";

const money = (value, currency) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
const date = (value) =>
  (value || "").slice(0, 10).split("-").reverse().join("/");
const periods = [
  { value: "day", label: "Aujourd’hui" },
  { value: "month", label: "Ce mois" },
  { value: "year", label: "Cette année" },
];
const followUp = [
  { key: "overdue", label: "En retard", status: "overdue", color: "#b42318" },
  { key: "dueSoon", label: "À échéance", status: "sent", color: "#0866c6" },
  { key: "drafts", label: "Brouillons", status: "draft", color: "#64738a" },
];

export default function NativeHome({
  name,
  state,
  period,
  setPeriod,
  currency,
  setCurrency,
  customRange,
  rangeDraft,
  setRangeDraft,
  rangeError,
  applyRange,
  fetchData,
  requestedRange,
  chartDefinitions,
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { summary, recent = [], todo = {} } = state;
  const totals = summary?.totals || {};
  const ready = state.status === "ready";
  const loading = state.status === "loading";
  const label = customRange
    ? "Dates choisies"
    : periods.find((item) => item.value === period)?.label;
  return (
    <div className="native-home">
      <header className="native-home-greeting">
        <div>
          <p>Votre activité en un regard</p>
          <h1>
            Bonjour{name ? `, ${name.split(" ")[0]}` : ""}{" "}
            <span aria-hidden="true">☀</span>
          </h1>
        </div>
        <button
          type="button"
          className="native-icon-button"
          aria-label="Actualiser"
          disabled={loading}
          onClick={() => fetchData(requestedRange.current)}
        >
          <RefreshCcw aria-hidden="true" />
        </button>
      </header>
      <div className="native-home-period">
        <button type="button" onClick={() => setFiltersOpen(true)}>
          <CalendarDays aria-hidden="true" />
          {label}
          <ChevronDown aria-hidden="true" />
        </button>
        <span>{currency}</span>
      </div>
      {loading ? (
        <div role="status" className="native-list-loading">
          <Loader2 className="animate-spin" aria-hidden="true" />
          Chargement de votre activité…
        </div>
      ) : null}
      {state.status === "error" ? (
        <section className="native-record space-y-3" role="alert">
          <h2>Données indisponibles</h2>
          <p className="text-sm text-[var(--text-muted)]">
            Vérifiez votre connexion puis réessayez.
          </p>
          <button
            type="button"
            className="btn-primary"
            onClick={() => fetchData(requestedRange.current)}
          >
            Réessayer
          </button>
        </section>
      ) : null}
      {ready ? (
        <>
          <section
            className="native-balance-card"
            aria-label="Encaissements de la période"
          >
            <div>
              <Wallet aria-hidden="true" />
              <span>Revenus encaissés</span>
            </div>
            <strong>{money(totals.revenue, currency)}</strong>
            <p>
              {date(summary.meta?.startDate)} — {date(summary.meta?.endDate)}
            </p>
            <Link to="/factures">
              En attente <b>{money(totals.outstanding, currency)}</b>
              <ChevronRight aria-hidden="true" />
            </Link>
          </section>
          <div className="native-home-metrics">
            <div>
              <span>Factures émises</span>
              <strong>{totals.invoiceCount || 0}</strong>
            </div>
            <div>
              <span>Délai de paiement</span>
              <strong>
                {totals.averagePaymentDelay == null
                  ? "—"
                  : `${Number(totals.averagePaymentDelay).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} j`}
              </strong>
            </div>
          </div>
          <section className="native-home-section">
            <h2>Créer un document</h2>
            <div className="native-quick-actions">
              <Link to="/devis/nouveau">
                <span>
                  <FilePenLine aria-hidden="true" />
                  <Plus aria-hidden="true" />
                </span>
                Nouveau devis
              </Link>
              <Link to="/factures/nouvelle">
                <span>
                  <FileText aria-hidden="true" />
                  <Plus aria-hidden="true" />
                </span>
                Nouvelle facture
              </Link>
            </div>
          </section>
          <section className="native-home-section">
            <h2>À suivre</h2>
            <p>Toutes périodes et devises</p>
            <div className="native-home-followup">
              {followUp.map((item) => (
                <Link key={item.key} to={`/factures?status=${item.status}`}>
                  <span style={{ background: item.color }} />
                  <span>{item.label}</span>
                  <b>{todo[item.key]?.length || 0}</b>
                  <ChevronRight aria-hidden="true" />
                </Link>
              ))}
            </div>
          </section>
          {recent.length ? (
            <section className="native-home-section">
              <header>
                <h2>Dernières factures</h2>
                <Link to="/factures">Tout voir</Link>
              </header>
              <div className="native-home-recent">
                {recent.map((invoice) => (
                  <Link
                    key={invoice.id}
                    to={
                      invoice.status === "draft"
                        ? `/factures/nouvelle?id=${invoice.id}`
                        : `/factures?invoice=${invoice.id}`
                    }
                  >
                    <span className="native-record-icon">
                      <FileText aria-hidden="true" />
                    </span>
                    <div>
                      <strong>
                        {invoice.client?.company_name || "Client"}
                      </strong>
                      <p>{invoice.invoice_number}</p>
                    </div>
                    <b>
                      {money(
                        invoice.total_amount,
                        invoice.currency === "$"
                          ? "USD"
                          : invoice.currency || "USD",
                      )}
                    </b>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
          {chartDefinitions.some(
            (chart) => summary.charts?.[chart.key]?.length,
          ) ? (
            <details className="native-home-charts">
              <summary>Statistiques de la période</summary>
              {chartDefinitions
                .filter((chart) => summary.charts?.[chart.key]?.length)
                .map((chart) => (
                  <section key={chart.key}>
                    <h2>
                      {chart.title} ({currency})
                    </h2>
                    <DashboardChart
                      label={`${chart.title} (${currency})`}
                      data={summary.charts[chart.key]}
                      labelKey={chart.labelKey}
                      type={chart.type}
                      height={200}
                    />
                  </section>
                ))}
            </details>
          ) : null}
        </>
      ) : null}
      {filtersOpen ? (
        <NativeSheet
          title="Période et devise"
          onClose={() => setFiltersOpen(false)}
        >
          <div
            className="native-filter-strip"
            role="group"
            aria-label="Période"
          >
            {periods.map((item) => (
              <button
                key={item.value}
                type="button"
                aria-pressed={!customRange && period === item.value}
                onClick={() => {
                  if (period === item.value) fetchData();
                  else setPeriod(item.value);
                  setFiltersOpen(false);
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
          <label className="label mt-5 block" htmlFor="native-summary-currency">
            Devise
          </label>
          <select
            id="native-summary-currency"
            className="input mt-2"
            value={currency}
            onChange={(event) => setCurrency(event.target.value)}
          >
            <option value="USD">USD</option>
            <option value="CDF">CDF</option>
          </select>
          <details className="mt-5">
            <summary className="text-sm font-semibold">
              Choisir des dates
            </summary>
            <form
              onSubmit={(event) => {
                applyRange(event);
                if (
                  rangeDraft.start &&
                  rangeDraft.end &&
                  rangeDraft.start <= rangeDraft.end
                )
                  setFiltersOpen(false);
              }}
              className="mt-4 space-y-3"
            >
              <label className="label block">
                Du
                <input
                  type="date"
                  className="input mt-2"
                  required
                  value={rangeDraft.start}
                  onChange={(event) =>
                    setRangeDraft((prev) => ({
                      ...prev,
                      start: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="label block">
                Au, inclus
                <input
                  type="date"
                  className="input mt-2"
                  required
                  min={rangeDraft.start || undefined}
                  value={rangeDraft.end}
                  onChange={(event) =>
                    setRangeDraft((prev) => ({
                      ...prev,
                      end: event.target.value,
                    }))
                  }
                />
              </label>
              {rangeError ? (
                <p role="alert" className="text-sm text-red-700">
                  {rangeError}
                </p>
              ) : null}
              <button
                type="submit"
                className="btn-primary w-full"
                disabled={loading}
              >
                Appliquer
              </button>
            </form>
          </details>
          <p className="native-record-note mt-5">
            Encaissements selon la date de réception. Soldes et factures selon
            la date d’émission. Aucune conversion automatique.
          </p>
        </NativeSheet>
      ) : null}
    </div>
  );
}
