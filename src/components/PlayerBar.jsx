// Name plate shown above / below the board.
export default function PlayerBar({ player, color, toMove }) {
  return (
    <div className={`player-bar ${toMove ? 'to-move' : ''}`}>
      <span className={`player-swatch ${color}`} />
      <span className="player-name">{player.username}</span>
      {player.rating !== '' && player.rating != null && <span className="player-rating">({player.rating})</span>}
    </div>
  )
}
