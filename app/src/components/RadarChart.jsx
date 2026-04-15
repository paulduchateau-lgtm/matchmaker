const DIMENSIONS = [
  { key: "pertinence", label: "PERTINENCE" },
  { key: "experience", label: "EXPÉRIENCE" },
  { key: "capacite", label: "CAPACITÉ" },
  { key: "cout", label: "COÛT" },
  { key: "adaptabilite", label: "ADAPTABILITÉ" },
];

export function RadarChart({ scores = {}, size = 200 }) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 30;
  const n = DIMENSIONS.length;

  function polarToXY(angle, r) {
    const rad = (angle - 90) * (Math.PI / 180);
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  const angleStep = 360 / n;

  // Grid circles
  const gridCircles = [20, 40, 60, 80, 100].map((pct) => {
    const r = (pct / 100) * radius;
    const points = DIMENSIONS.map((_, i) => {
      const { x, y } = polarToXY(i * angleStep, r);
      return `${x},${y}`;
    }).join(" ");
    return (
      <polygon
        key={pct}
        points={points}
        fill="none"
        stroke="#363530"
        strokeWidth={pct === 100 ? 1 : 0.5}
      />
    );
  });

  // Axis lines
  const axes = DIMENSIONS.map((_, i) => {
    const { x, y } = polarToXY(i * angleStep, radius);
    return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#363530" strokeWidth={0.5} />;
  });

  // Data polygon
  const dataPoints = DIMENSIONS.map((dim, i) => {
    const val = scores[dim.key] || 0;
    const r = (val / 100) * radius;
    return polarToXY(i * angleStep, r);
  });
  const dataPolygon = dataPoints.map((p) => `${p.x},${p.y}`).join(" ");

  // Labels
  const labels = DIMENSIONS.map((dim, i) => {
    const { x, y } = polarToXY(i * angleStep, radius + 18);
    const val = scores[dim.key] || 0;
    return (
      <text
        key={dim.key}
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="middle"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "7px",
          fontWeight: "var(--weight-medium)",
          letterSpacing: "0.15em",
          fill: val >= 70 ? "var(--color-green)" : val >= 40 ? "var(--color-amber)" : "var(--color-sage)",
        }}
      >
        {dim.label}
      </text>
    );
  });

  // Score dots
  const dots = dataPoints.map((p, i) => (
    <circle key={i} cx={p.x} cy={p.y} r={3} fill="var(--color-green)" />
  ));

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {gridCircles}
      {axes}
      <polygon points={dataPolygon} fill="rgba(165, 217, 0, 0.15)" stroke="var(--color-green)" strokeWidth={1.5} />
      {dots}
      {labels}
    </svg>
  );
}
