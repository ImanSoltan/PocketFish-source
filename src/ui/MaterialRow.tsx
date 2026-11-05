// Play mode: the pieces one side has taken, as small overlapping pieces, and its lead in material.
import { pieceUrl } from '../board/Board';
import { colorOf, type Color, type PieceChar } from '../chess/position';
import { t, type MessageKey } from '../i18n';
import type { Material } from '../play/material';

interface Props {
  /** whose captures: White's row shows the black pieces White has taken */
  side: Color;
  material: Material;
  pieceSet: string;
}

export function MaterialRow({ side, material, pieceSet }: Props) {
  // pieces of a kind in one overlapping group: ♟♟♟ ♞ ♜
  const groups: PieceChar[][] = [];
  for (const p of material.taken[side]) {
    const g = groups.at(-1);
    if (g?.[0] === p) g.push(p);
    else groups.push([p]);
  }
  const lead = side === 'w' ? material.balance : -material.balance;
  return (
    <div className="material" role="group" aria-label={t(side === 'w' ? 'play.takenByWhite' : 'play.takenByBlack')} data-testid={`material-${side}`}>
      {groups.map((g) => (
        <span key={g[0]} className="material-group">
          {g.map((p, i) => (
            <img key={i} className={colorOf(p)} src={pieceUrl(pieceSet, p)} alt={t(`piece.${p}` as MessageKey)} />
          ))}
        </span>
      ))}
      {lead > 0 && (
        <span className="material-lead" aria-label={t('play.ahead', { n: lead })} data-testid="material-lead">
          +{lead}
        </span>
      )}
    </div>
  );
}
