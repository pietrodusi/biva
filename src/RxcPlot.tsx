import { LEVELS, ellipsePoints, eigenSym2, covariance, type RefParams, type Vector } from "./biva";

interface Props {
  ref95: RefParams;
  point: Vector | null;
  sexLabel: string;
}

// Colours per tolerance level (low -> high confidence).
const LEVEL_STYLE: Record<number, { stroke: string; label: string }> = {
  0.5: { stroke: "#16a34a", label: "50%" },
  0.75: { stroke: "#d97706", label: "75%" },
  0.95: { stroke: "#dc2626", label: "95%" },
};

/** Produce ~`count` rounded tick values covering [min, max]. */
function niceTicks(min: number, max: number, count = 6): number[] {
  const span = max - min || 1;
  const rawStep = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const norm = rawStep / mag;
  const step = (norm >= 5 ? 5 : norm >= 2 ? 2 : 1) * mag;
  const start = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step * 1e-9; v += step) {
    ticks.push(Math.round(v * 1e6) / 1e6);
  }
  return ticks;
}

const W = 640;
const H = 520;
const M = { top: 24, right: 24, bottom: 56, left: 64 };

export function RxcPlot({ ref95, point, sexLabel }: Props) {
  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;

  // Build all three ellipses once.
  const ellipses = LEVELS.map((lvl) => ({ ...lvl, pts: ellipsePoints(ref95, lvl.k) }));

  // Fixed "classic BIVA" axis ranges (R/H 100–500, Xc/H 10–50), matching the
  // scale of the published Campa RXc figures. This locks the plot's aspect ratio
  // so the ellipse's on-screen shape and orientation stay stable and paper-like
  // instead of re-fitting — and re-rotating — with every change of values.
  //
  // The frame only ever GROWS beyond the standard range (rounded to a tick) if
  // an unusually large/eccentric ellipse or patient point would otherwise be
  // clipped (e.g. the older-adult female reference, whose 95% ellipse reaches
  // ~520 Ω/m on R/H).
  const xs = ellipses[2].pts.map((p) => p[0]);
  const ys = ellipses[2].pts.map((p) => p[1]);
  if (point) {
    xs.push(point.rh);
    ys.push(point.xch);
  }
  const xMin = Math.min(100, Math.floor(Math.min(...xs) / 100) * 100);
  const xMax = Math.max(500, Math.ceil(Math.max(...xs) / 100) * 100);
  const yMin = Math.min(10, Math.floor(Math.min(...ys) / 10) * 10);
  const yMax = Math.max(50, Math.ceil(Math.max(...ys) / 10) * 10);

  // Data -> screen mapping (note the y-axis flip: SVG y grows downward).
  const sx = (x: number) => M.left + ((x - xMin) / (xMax - xMin)) * plotW;
  const sy = (y: number) => M.top + (1 - (y - yMin) / (yMax - yMin)) * plotH;

  const toPath = (pts: Array<[number, number]>) =>
    pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${sx(x).toFixed(2)},${sy(y).toFixed(2)}`).join(" ") + " Z";

  const xticks = niceTicks(xMin, xMax, 4); // ~100 Ω/m steps, like the paper
  const yticks = niceTicks(yMin, yMax, 4); // ~10 Ω/m steps, like the paper

  // Interpretation axes, drawn to follow the ellipse AS DISPLAYED.
  //
  // The covariance eigenvectors live in data units (Ω/m); the plot scales R/H
  // and Xc/H by different amounts, so mapping those data-space axes to screen
  // would NOT line them up with the long/short directions of the rendered
  // ellipse. Instead we build the covariance of the ON-SCREEN ellipse and take
  // its principal axes, so the drawn cross lies along the ellipse you see.
  //
  // A point's screen offset from the centre is (SX*dx, -SY*dy), so the screen
  // covariance is  A·Σ·Aᵀ  with  A = diag(SX, -SY).
  const SX = plotW / (xMax - xMin);
  const SY = plotH / (yMax - yMin);
  const { a, b, c } = covariance(ref95);
  const screenEig = eigenSym2(SX * SX * a, -SX * SY * b, SY * SY * c);
  const k95 = LEVELS[2].k;
  const cxp = sx(ref95.meanRH);
  const cyp = sy(ref95.meanXcH);

  // Orient each axis to point rightward on screen so the +end is the right pole.
  const orientRight = (v: [number, number]): [number, number] =>
    v[0] >= 0 ? v : [-v[0], -v[1]];
  const uMaj = orientRight(screenEig.v1); // major: up-right (dehydration) <-> down-left
  const uMin = orientRight(screenEig.v2); // minor: down-right (less cell mass) <-> up-left
  const semiMaj = k95 * Math.sqrt(Math.max(0, screenEig.l1));
  const semiMin = k95 * Math.sqrt(Math.max(0, screenEig.l2));

  // Endpoints (in screen px); LAB extends a touch further for the labels.
  const along = (u: [number, number], len: number): [number, number] => [
    cxp + u[0] * len,
    cyp + u[1] * len,
  ];
  const majDehydr = along(uMaj, semiMaj);
  const majOver = along(uMaj, -semiMaj);
  const minLess = along(uMin, semiMin);
  const minMore = along(uMin, -semiMin);
  // Labels sit a little beyond each axis tip (which is on the 95% ellipse) and
  // are anchored AWAY from the ellipse so the whole word clears the curve.
  const majDehydrLab = along(uMaj, semiMaj + 12);
  const majOverLab = along(uMaj, -semiMaj - 12);
  const minLessLab = along(uMin, semiMin + 12);
  const minMoreLab = along(uMin, -semiMin - 12);

  return (
    <svg
      className="rxc-plot"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Grafico R-Xc per ${sexLabel === "male" ? "uomo" : sexLabel === "female" ? "donna" : sexLabel}`}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Plot frame */}
      <rect x={M.left} y={M.top} width={plotW} height={plotH} fill="#ffffff" stroke="#cbd5e1" />

      {/* Grid + ticks */}
      {xticks.map((t) => (
        <g key={`x${t}`}>
          <line x1={sx(t)} y1={M.top} x2={sx(t)} y2={M.top + plotH} stroke="#eef2f7" />
          <line x1={sx(t)} y1={M.top + plotH} x2={sx(t)} y2={M.top + plotH + 5} stroke="#94a3b8" />
          <text x={sx(t)} y={M.top + plotH + 18} textAnchor="middle" className="tick">
            {t}
          </text>
        </g>
      ))}
      {yticks.map((t) => (
        <g key={`y${t}`}>
          <line x1={M.left} y1={sy(t)} x2={M.left + plotW} y2={sy(t)} stroke="#eef2f7" />
          <line x1={M.left - 5} y1={sy(t)} x2={M.left} y2={sy(t)} stroke="#94a3b8" />
          <text x={M.left - 9} y={sy(t) + 4} textAnchor="end" className="tick">
            {t}
          </text>
        </g>
      ))}

      {/* Axis titles */}
      <text x={M.left + plotW / 2} y={H - 12} textAnchor="middle" className="axis-title">
        R/H (Ω/m)
      </text>
      <text
        x={16}
        y={M.top + plotH / 2}
        textAnchor="middle"
        className="axis-title"
        transform={`rotate(-90 16 ${M.top + plotH / 2})`}
      >
        Xc/H (Ω/m)
      </text>

      {/* Interpretation axes of the 95% ellipse, aligned to the displayed
          ellipse's visual major/minor directions (dashed) + pole labels. */}
      <line
        x1={majOver[0]}
        y1={majOver[1]}
        x2={majDehydr[0]}
        y2={majDehydr[1]}
        stroke="#64748b"
        strokeDasharray="4 4"
      />
      <line
        x1={minMore[0]}
        y1={minMore[1]}
        x2={minLess[0]}
        y2={minLess[1]}
        stroke="#64748b"
        strokeDasharray="4 4"
      />
      <text x={majDehydrLab[0]} y={majDehydrLab[1]} textAnchor="start" className="pole">
        disidratazione
      </text>
      <text x={majOverLab[0]} y={majOverLab[1]} textAnchor="end" className="pole">
        iperidratazione
      </text>
      <text x={minMoreLab[0]} y={minMoreLab[1]} textAnchor="end" className="pole">
        ← più massa cellulare
      </text>
      <text x={minLessLab[0]} y={minLessLab[1]} textAnchor="start" className="pole">
        meno massa cellulare →
      </text>

      {/* Tolerance ellipses */}
      {ellipses.map((e) => (
        <path
          key={e.p}
          d={toPath(e.pts)}
          fill="none"
          stroke={LEVEL_STYLE[e.p].stroke}
          strokeWidth={1.8}
        />
      ))}

      {/* Reference mean marker */}
      <circle cx={sx(ref95.meanRH)} cy={sy(ref95.meanXcH)} r={2.5} fill="#475569" />

      {/* Patient vector */}
      {point && (
        <g>
          <circle
            cx={sx(point.rh)}
            cy={sy(point.xch)}
            r={6}
            fill="#1d4ed8"
            stroke="#ffffff"
            strokeWidth={1.5}
          />
          <text x={sx(point.rh) + 9} y={sy(point.xch) - 8} className="point-label">
            {point.rh.toFixed(1)}, {point.xch.toFixed(1)}
          </text>
        </g>
      )}

      {/* Legend */}
      <g transform={`translate(${M.left + 10}, ${M.top + 8})`}>
        {ellipses.map((e, i) => (
          <g key={e.p} transform={`translate(0, ${i * 16})`}>
            <line x1={0} y1={0} x2={18} y2={0} stroke={LEVEL_STYLE[e.p].stroke} strokeWidth={2} />
            <text x={24} y={4} className="legend">
              tolleranza {LEVEL_STYLE[e.p].label}
            </text>
          </g>
        ))}
      </g>
    </svg>
  );
}
