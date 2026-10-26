import { useState } from "react";

const WIDTH = 720;
const HEIGHT = 200;
const PAD = { top: 12, right: 8, bottom: 26, left: 44 };
const GAP = 2;

function dayLabel(day) {
  return new Date(`${day}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Rounds the axis top up to a friendly number so gridlines land on whole values
function niceMax(value) {
  if (value <= 4) return 4;
  const step = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / step) * step;
}

// A bar with 4px rounded top corners and a square base on the axis
function barPath(x, y, width, height) {
  const r = Math.min(4, width / 2, height);
  return `M${x},${y + height}V${y + r}Q${x},${y} ${x + r},${y}H${x + width - r}Q${x + width},${y} ${x + width},${y + r}V${y + height}Z`;
}

export default function VisitsChart({ daily }) {
  const [active, setActive] = useState(null);
  const max = niceMax(Math.max(0, ...daily.map((row) => row.visits)));
  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const slot = plotW / daily.length;
  const barW = Math.max(2, slot - GAP);
  const y = (value) => PAD.top + plotH - (value / max) * plotH;
  const ticks = [0, max / 2, max];
  const hovered = active === null ? null : daily[active];

  return (
    <figure className="portal-chart">
      <figcaption className="portal-chart-title">Page views per day</figcaption>
      <div className="portal-chart-frame">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label={`Page views per day for the last ${daily.length} days`}
          onMouseLeave={() => setActive(null)}
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={PAD.left}
                x2={WIDTH - PAD.right}
                y1={y(tick)}
                y2={y(tick)}
                className={tick === 0 ? "portal-chart-axis" : "portal-chart-grid"}
              />
              <text x={PAD.left - 8} y={y(tick) + 4} textAnchor="end" className="portal-chart-label">
                {tick}
              </text>
            </g>
          ))}

          {daily.map((row, index) => {
            const x = PAD.left + index * slot + GAP / 2;
            const height = (row.visits / max) * plotH;
            return (
              <g key={row.day}>
                {row.visits > 0 && (
                  <path
                    d={barPath(x, y(row.visits), barW, height)}
                    className={`portal-chart-bar${active === index ? " is-active" : ""}`}
                  />
                )}
                {/* Full-height hit area so thin or empty days are easy to hover */}
                <rect
                  x={PAD.left + index * slot}
                  y={PAD.top}
                  width={slot}
                  height={plotH}
                  fill="transparent"
                  onMouseEnter={() => setActive(index)}
                  onFocus={() => setActive(index)}
                  onBlur={() => setActive(null)}
                  tabIndex={0}
                  aria-label={`${dayLabel(row.day)}: ${row.visits} page views`}
                />
                {index % 7 === 0 && (
                  <text x={x + barW / 2} y={HEIGHT - 6} textAnchor="middle" className="portal-chart-label">
                    {dayLabel(row.day)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {hovered && (
          <div
            className="portal-tooltip"
            style={{ left: `${((PAD.left + (active + 0.5) * slot) / WIDTH) * 100}%` }}
          >
            <strong>{dayLabel(hovered.day)}</strong>
            <span>
              {hovered.visits} {hovered.visits === 1 ? "view" : "views"} · {hovered.visitors}{" "}
              {hovered.visitors === 1 ? "visitor" : "visitors"}
            </span>
          </div>
        )}
      </div>

      <details className="portal-chart-table">
        <summary>Show as a table</summary>
        <table>
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col">Page views</th>
              <th scope="col">Visitors</th>
            </tr>
          </thead>
          <tbody>
            {daily
              .filter((row) => row.visits > 0)
              .reverse()
              .map((row) => (
                <tr key={row.day}>
                  <td>{dayLabel(row.day)}</td>
                  <td>{row.visits}</td>
                  <td>{row.visitors}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
