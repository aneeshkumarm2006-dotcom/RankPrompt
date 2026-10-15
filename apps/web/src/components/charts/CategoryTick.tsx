/** Splits a long axis label into lines of at most `maxLength` characters (v1 CustomCategoryTick). */
export function wrapLabel(name: string, maxLength = 18): string[] {
  if (name.length <= maxLength) return [name];
  const lines: string[] = [];
  let current = '';
  for (const word of name.split(' ')) {
    if ((current + word).length <= maxLength) {
      current += (current ? ' ' : '') + word;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** Recharts XAxis tick that wraps long category names onto several lines. */
export function CategoryTick({
  x = 0,
  y = 0,
  payload,
}: {
  x?: number;
  y?: number;
  payload?: { value?: string | number };
}) {
  const lines = wrapLabel(String(payload?.value ?? ''));
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={16} textAnchor="middle" fill="#9CA3AF" fontSize={11}>
        {lines.map((line, index) => (
          <tspan x={0} dy={index === 0 ? 0 : 14} key={index}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
}
