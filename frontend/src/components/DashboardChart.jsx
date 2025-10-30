import { useMemo, useState } from "react";
import clsx from "clsx";

const formatNumber = (value) => {
  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `${(value / 1_000).toFixed(1)}k`;
  }
  return value.toLocaleString("fr-FR", { maximumFractionDigits: 0 });
};

const normalizeData = (data = [], valueKey, labelKey) =>
  data
    .map((item) => ({
      value: Number(item?.[valueKey] ?? 0),
      label: String(item?.[labelKey] ?? ""),
    }))
    .filter((item) => Number.isFinite(item.value));

const truncateLabel = (label, maxLength) => {
  if (!label) return "";
  if (label.length <= maxLength) return label;
  return `${label.slice(0, maxLength - 1)}…`;
};

const formatSinglePointLabel = (label) => {
  if (!label) return "—";
  if (/^\d{4}$/.test(label)) {
    return label;
  }
  if (/^\d{4}-\d{2}$/.test(label)) {
    const [year, month] = label.split("-").map(Number);
    const date = new Date(year, month - 1, 1);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString("fr-FR", {
        month: "long",
        year: "numeric",
      });
    }
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(label)) {
    const date = new Date(label);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    }
  }
  return label;
};

const formatSinglePointValue = (value) => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "—";
  }
  return value.toLocaleString("fr-FR", { maximumFractionDigits: 0 });
};

const DashboardChart = ({
  data,
  valueKey = "total",
  labelKey = "label",
  type = "bar",
  className,
  height = 220,
}) => {
  const [highlightIndex, setHighlightIndex] = useState(null);

  const points = useMemo(
    () => normalizeData(data, valueKey, labelKey),
    [data, valueKey, labelKey],
  );
  const maxValue = useMemo(
    () => points.reduce((max, item) => Math.max(max, item.value), 0),
    [points],
  );

  if (points.length === 0) {
    return (
      <div
        className={clsx(
          "flex min-h-[180px] items-center justify-center rounded-[var(--radius-xl)] border border-dashed border-[var(--border)] bg-[rgba(15,23,42,0.02)] text-sm text-[var(--text-muted)]",
          className,
        )}
      >
        Aucune donnée disponible pour la période sélectionnée.
      </div>
    );
  }

  if (type === "line" && points.length < 2) {
    const latestPoint = points[0];
    const formattedValue = formatSinglePointValue(latestPoint.value);
    const formattedLabel = formatSinglePointLabel(latestPoint.label);
    return (
      <div
        className={clsx(
          "flex min-h-[220px] items-center justify-center rounded-[var(--radius-xl)] border border-[var(--border)] bg-white p-6",
          className,
        )}
      >
        <div className="w-full max-w-md space-y-4 text-sm text-[var(--text-muted)]">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)]">
            <span>Données insuffisantes</span>
            <span>Tendance indisponible</span>
          </div>
          <p>
            Ajoutez d’autres factures ou changez de période pour visualiser une
            courbe de tendance.
          </p>
          <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-white p-4 text-[var(--text-dark)]">
            <div className="flex flex-col gap-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-muted)]">Dernier total</span>
                <span className="font-semibold">{formattedValue}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-muted)]">
                  Dernière période
                </span>
                <span className="font-semibold">{formattedLabel}</span>
              </div>
              <div className="flex items-center justify-center pt-1">
                <div className="flex h-16 w-full max-w-[160px] items-end justify-around">
                  <div className="flex h-full w-full items-end justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--border)] bg-[rgba(10,132,255,0.08)]">
                    <span className="mb-1 h-3 w-3 rounded-full bg-[var(--primary)]" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const chartHeight = Math.max(height, 160);
  const pointSpacing = type === "bar" ? 90 : 60;
  const barWidth = Math.min(40, pointSpacing - 24);
  const baseOffset = 40;
  const chartWidth = points.length * pointSpacing + baseOffset + 20;

  const pathD =
    type === "line"
      ? points
          .map((point, index) => {
            const x = baseOffset + index * pointSpacing;
            const y =
              chartHeight -
              (point.value / (maxValue || 1)) * (chartHeight - 60) -
              20;
            return `${index === 0 ? "M" : "L"}${x},${y}`;
          })
          .join(" ")
      : null;

  return (
    <div
      className={clsx(
        "rounded-[var(--radius-xl)] border border-[var(--border)] bg-white p-4",
        className,
      )}
    >
      <div className="relative h-full w-full overflow-x-auto pb-4">
        <svg
          width={chartWidth}
          height={chartHeight}
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="text-[var(--primary)]"
        >
          <line
            x1="32"
            y1={chartHeight - 20}
            x2={chartWidth - 8}
            y2={chartHeight - 20}
            stroke="var(--border)"
            strokeLinecap="round"
          />
          {type === "line" && pathD ? (
            <path
              d={pathD}
              fill="none"
              stroke="var(--primary)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
          {points.map((point, index) => {
            const x = baseOffset + index * pointSpacing;
            const visualHeight =
              (point.value / (maxValue || 1)) * (chartHeight - 60);
            const barHeight = Math.max(visualHeight, 6);
            const y = chartHeight - barHeight - 20;
            const isActive = highlightIndex === index;
            const truncatedLabel = truncateLabel(
              point.label,
              type === "bar" ? 12 : 16,
            );

            return (
              <g
                key={point.label || index}
                onMouseEnter={() => setHighlightIndex(index)}
                onMouseLeave={() => setHighlightIndex(null)}
              >
                <title>{point.label}</title>
                {type === "bar" ? (
                  <rect
                    x={x - barWidth / 2}
                    y={y}
                    width={barWidth}
                    height={barHeight}
                    rx="8"
                    className={clsx(
                      "transition-all",
                      isActive
                        ? "fill-[var(--primary)] opacity-90"
                        : "fill-[var(--primary-soft)] opacity-80",
                    )}
                  />
                ) : (
                  <circle
                    cx={x}
                    cy={y}
                    r={isActive ? 6 : 5}
                    className={clsx(
                      isActive
                        ? "fill-[var(--primary)]"
                        : "fill-[var(--primary-soft)]",
                    )}
                  />
                )}
                <text
                  x={x}
                  y={chartHeight - 6}
                  textAnchor="middle"
                  className="fill-[var(--text-muted)] text-[11px]"
                >
                  {truncatedLabel}
                </text>
                {isActive ? (
                  <text
                    x={x}
                    y={y - 12}
                    textAnchor="middle"
                    className="fill-[var(--text-dark)] text-xs font-semibold"
                  >
                    {formatNumber(point.value)}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

export default DashboardChart;
