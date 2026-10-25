import { Loader2, Search, X } from "lucide-react";

export const NativeEmpty = ({ icon: Icon, title, description, action }) => (
  <div className="native-empty">
    <span className="native-empty-art">
      <Icon aria-hidden="true" />
    </span>
    <h2>{title}</h2>
    <p>{description}</p>
    {action}
  </div>
);

// Native collections share data and handlers with the web tables, but use a
// separate hierarchy: search, horizontal filters, then touch-friendly records.
export const NativeCollection = ({
  label,
  count,
  search,
  onSearch,
  searchLabel,
  filters = [],
  value,
  onFilter,
  extra,
  toolsAction,
  loading,
  error,
  onRetry,
  empty,
  children,
}) => (
  <section className="native-collection" aria-label={label}>
    <div className="native-collection-tools">
      <div className="native-search-row">
        <div className="native-search">
          <Search aria-hidden="true" />
          <input
            type="search"
            aria-label={searchLabel}
            placeholder={searchLabel}
            value={search}
            onChange={(event) => onSearch(event.target.value)}
          />
          {search ? (
            <button
              type="button"
              aria-label="Effacer la recherche"
              onClick={() => onSearch("")}
            >
              <X aria-hidden="true" />
            </button>
          ) : null}
        </div>
        {toolsAction}
      </div>
      {filters.length ? (
        <div
          className="native-filter-strip"
          role="group"
          aria-label={`Filtres ${label.toLocaleLowerCase("fr-FR")}`}
        >
          {filters.map((filter) => (
            <button
              key={filter.value}
              type="button"
              aria-pressed={value === filter.value}
              onClick={() => onFilter(filter.value)}
            >
              {filter.label}
            </button>
          ))}
        </div>
      ) : null}
      {extra}
    </div>
    {loading ? (
      <div role="status" className="native-list-loading">
        <Loader2 aria-hidden="true" className="animate-spin" />
        Chargement…
      </div>
    ) : error ? (
      <div role="alert" className="native-empty">
        <h2>Chargement impossible</h2>
        <p>Vérifiez votre connexion et réessayez.</p>
        <button type="button" className="btn-secondary" onClick={onRetry}>
          Réessayer
        </button>
      </div>
    ) : count === 0 ? (
      empty
    ) : (
      <>
        <p className="native-result-count">
          {count}{" "}
          {(count === 1 && label !== "Devis"
            ? label.replace(/s$/u, "")
            : label
          ).toLocaleLowerCase("fr-FR")}
        </p>
        <div className="native-records">{children}</div>
      </>
    )}
  </section>
);
