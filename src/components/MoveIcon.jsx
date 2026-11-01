// Round chess.com-style classification badge, drawn as inline SVG so it
// scales crisply on the board and in the move list.

function starPoints(cx, cy, outer, inner) {
  const pts = []
  for (let i = 0; i < 10; i += 1) {
    const r = i % 2 === 0 ? outer : inner
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`)
  }
  return pts.join(' ')
}

const STAR = starPoints(10, 10.4, 6, 2.6)

function Glyph({ kind }) {
  const stroke = { stroke: '#fff', strokeWidth: 2.3, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' }
  const text = (t, size = 10) => (
    <text
      x="10"
      y="10.5"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={size}
      fontWeight="900"
      fontFamily="Arial, Helvetica, sans-serif"
      fill="#fff"
      letterSpacing="-0.6"
    >
      {t}
    </text>
  )
  switch (kind) {
    case 'brilliant':
      return text('!!')
    case 'great':
      return text('!', 11)
    case 'inaccuracy':
      return text('?!', 9.5)
    case 'mistake':
      return text('?', 11)
    case 'blunder':
      return text('??', 10)
    case 'best':
      return <polygon points={STAR} fill="#fff" />
    case 'excellent':
      return (
        <path
          fill="#fff"
          d="M5.3 9.2h2.3v6H5.3zM8.6 15.2V9.4l2.6-4.1c.9-.1 1.6.6 1.4 1.5l-.5 2.1h3c.8 0 1.4.8 1.2 1.6l-1.1 3.8c-.2.6-.7.9-1.3.9z"
        />
      )
    case 'good':
      return <polyline points="5.8,10.4 8.7,13.3 14.3,7.4" {...stroke} />
    case 'book':
      return (
        <g>
          <path fill="#fff" d="M4.6 6.4c1.9-.6 3.8-.4 5.4.8 1.6-1.2 3.5-1.4 5.4-.8v8.1c-1.9-.6-3.8-.4-5.4.8-1.6-1.2-3.5-1.4-5.4-.8z" />
          <path d="M10 7.3v7.9" stroke="#a88865" strokeWidth="0.9" />
        </g>
      )
    case 'forced':
      return (
        <g {...stroke}>
          <path d="M5.5 10h8.2" />
          <path d="M10.4 6.6 13.8 10l-3.4 3.4" />
        </g>
      )
    case 'miss':
      return (
        <g {...stroke}>
          <path d="M6.7 6.7l6.6 6.6M13.3 6.7l-6.6 6.6" />
        </g>
      )
    default:
      return null
  }
}

export default function MoveIcon({ classification, size = 18, title, className = '' }) {
  if (!classification) return null
  return (
    <svg
      className={`move-icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 20 20"
      role="img"
      aria-label={title ?? classification.label}
    >
      <title>{title ?? classification.label}</title>
      <circle cx="10" cy="10.6" r="9.4" fill="rgba(0,0,0,0.28)" />
      <circle cx="10" cy="10" r="9.4" fill={classification.color} />
      <Glyph kind={classification.key} />
    </svg>
  )
}
