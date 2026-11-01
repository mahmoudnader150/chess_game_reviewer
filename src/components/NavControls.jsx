// First / previous / next / last controls plus board flip.
export default function NavControls({ ply, maxPly, onChange, onFlip }) {
  const btn = (label, title, target, disabled) => (
    <button type="button" className="nav-btn" title={title} aria-label={title} disabled={disabled} onClick={() => onChange(target)}>
      {label}
    </button>
  )
  return (
    <div className="nav-controls">
      <button type="button" className="nav-btn small" title="Flip board (F)" aria-label="Flip board" onClick={onFlip}>
        ⇅
      </button>
      {btn('⏮', 'First move (↑ / Home)', 0, ply === 0)}
      {btn('◀', 'Previous move (←)', ply - 1, ply === 0)}
      {btn('▶', 'Next move (→)', ply + 1, ply === maxPly)}
      {btn('⏭', 'Last move (↓ / End)', maxPly, ply === maxPly)}
    </div>
  )
}
