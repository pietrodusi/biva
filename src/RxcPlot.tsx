import { LEVELS, ellipsePoints, ellipseAxes, type RefParams, type Vector } from "./biva";

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

  // Build all three ellipses and the 95% axes once.
  const ellipses = LEVELS.map((lvl) => ({ ...lvl, pts: ellipsePoints(ref95, lvl.k) }));
  const axes = ellipseAxes(ref95, LEVELS[2].k); // major/minor of the 95% ellipse

  // Data bounds: driven by the 95% ellipse, expanded to include the patient
  // point, then padded so nothing touches the frame.
  const outer = ellipses[2].pts;
  let xMin = Infinity,
    xMax = -Infinity,
    yMin = Infinity,
    yMax = -Infinity;
  for (const [x, y] of outer) {
    xMin = Math.min(xMin, x);
    xMax = Math.max(xMax, x);
    yMin = Math.min(yMin, y);
    yMax = Math.max(yMax, y);
  }
  if (point) {
    xMin = Math.min(xMin, point.rh);
    xMax = Math.max(xMax, point.rh);
    yMin = Math.min(yMin, point.xch);
    yMax = Math.max(yMax, point.xch);
  }
  const padX = (xMax - xMin) * 0.12 || 10;
  const padY = (yMax - yMin) * 0.12 || 10;
  xMin -= padX;
  xMax += padX;
  yMin -= padY;
  yMax += padY;

  // Data -> screen mapping (note the y-axis flip: SVG y grows downward).
  const sx = (x: number) => M.left + ((x - xMin) / (xMax - xMin)) * plotW;
  const sy = (y: number) => M.top + (1 - (y - yMin) / (yMax - yMin)) * plotH;

  const toPath = (pts: Array<[number, number]>) =>
    pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${sx(x).toFixed(2)},${sy(y).toFixed(2)}`).join(" ") + " Z";

  const xticks = niceTicks(xMin, xMax);
  const yticks = niceTicks(yMin, yMax);

  // Endpoints of the interpretation axes, with a little overshoot for labels.
  const ext = (p: [number, number], q: [number, number], f: number): [number, number] => [
    q[0] + (q[0] - p[0]) * f,
    q[1] + (q[1] - p[1]) * f,
  ];
  const majTop = ext(axes.major[0], axes.major[1], 0.06);
  const majBot = ext(axes.major[1], axes.major[0], 0.06);
  const minRight = axes.minor[0][0] > axes.minor[1][0] ? axes.minor[0] : axes.minor[1];
  const minLeft = axes.minor[0][0] > axes.minor[1][0] ? axes.minor[1] : axes.minor[0];

  return (
    <svg
      className="rxc-plot"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`R-Xc graph for ${sexLabel}`}
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

      {/* Interpretation axes of the 95% ellipse (dashed) + pole labels */}
      <line
        x1={sx(majBot[0])}
        y1={sy(majBot[1])}
        x2={sx(majTop[0])}
        y2={sy(majTop[1])}
        stroke="#64748b"
        strokeDasharray="4 4"
      />
      <line
        x1={sx(minLeft[0])}
        y1={sy(minLeft[1])}
        x2={sx(minRight[0])}
        y2={sy(minRight[1])}
        stroke="#64748b"
        strokeDasharray="4 4"
      />
      <text x={sx(majTop[0])} y={sy(majTop[1]) - 4} textAnchor="middle" className="pole">
        dehydration
      </text>
      <text x={sx(majBot[0])} y={sy(majBot[1]) + 12} textAnchor="middle" className="pole">
        over-hydration
      </text>
      <text x={sx(minLeft[0]) - 4} y={sy(minLeft[1]) - 4} textAnchor="end" className="pole">
        ← more cell mass
      </text>
      <text x={sx(minRight[0]) + 4} y={sy(minRight[1]) + 12} textAnchor="start" className="pole">
        less cell mass →
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
              {LEVEL_STYLE[e.p].label} tolerance
            </text>
          </g>
        ))}
      </g>
    </svg>
  );
}
