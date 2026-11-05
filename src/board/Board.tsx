// Interactive SVG chess board: tap-tap or drag moves, promotion picker, engine
// arrows, highlights and an edit mode (tap to place, drag to move / remove).
import { useRef, useState, type JSX, type PointerEvent as ReactPointerEvent } from 'react';
import { colorOf, type Board as BoardArray, type Color, type PieceChar } from '../chess/position';

export interface Arrow {
  from: number;
  to: number;
  color: string;
  opacity: number;
  /** shaft width in squares */
  width?: number;
}

export interface Theme {
  name: string;
  light: string;
  dark: string;
  highlight: string;
}

export const THEMES: Theme[] = [
  // modern boards (one per colour scheme)
  { name: 'ocean', light: '#e7edf6', dark: '#8ba3c4', highlight: 'rgba(250, 204, 21, 0.45)' },
  { name: 'lavender', light: '#efecf8', dark: '#a69ed3', highlight: 'rgba(250, 204, 21, 0.45)' },
  { name: 'slate', light: '#c9d3df', dark: '#62748e', highlight: 'rgba(34, 211, 238, 0.38)' },
  { name: 'stone', light: '#ecebe8', dark: '#a9a49c', highlight: 'rgba(255, 138, 76, 0.45)' },
  { name: 'walnut', light: '#f2e2cc', dark: '#bf8e66', highlight: 'rgba(250, 204, 21, 0.45)' },
  // classics
  { name: 'green', light: '#ebecd0', dark: '#779556', highlight: 'rgba(255, 255, 51, 0.42)' },
  { name: 'brown', light: '#f0d9b5', dark: '#b58863', highlight: 'rgba(155, 199, 0, 0.41)' },
  { name: 'blue', light: '#dee3e6', dark: '#8ca2ad', highlight: 'rgba(155, 199, 0, 0.41)' },
  { name: 'gray', light: '#e8e8e8', dark: '#a7a7a7', highlight: 'rgba(255, 220, 60, 0.45)' },
];

export const pieceUrl = (set: string, p: PieceChar) =>
  `pieces/${set}/${colorOf(p)}${p.toUpperCase()}.svg`;

interface Props {
  board: BoardArray;
  orientation: Color;
  theme: Theme;
  pieceSet: string;
  coords?: boolean;
  arrows?: Arrow[];
  lastMove?: [number, number] | null;
  checkSquare?: number | null;
  /** per-square overlay colors (e.g. uncertain squares after a scan) */
  marks?: Record<number, string>;
  /** play mode: legal destination squares per origin square */
  dests?: Map<number, number[]> | null;
  isPromotion?: (from: number, to: number) => boolean;
  promotionColor?: Color;
  onMove?: (from: number, to: number, promotion?: string) => void;
  /** edit mode */
  onSquareTap?: (sq: number) => void;
  onPieceDrop?: (from: number, to: number | null) => void;
}

interface Drag {
  from: number;
  x: number;
  y: number;
  startX: number;
  startY: number;
  moved: boolean;
  wasSelected: boolean;
}

const FILES = 'abcdefgh';

export function ChessBoard(props: Props) {
  const { board, orientation, theme, pieceSet, arrows = [], dests, marks } = props;
  const svgRef = useRef<SVGSVGElement>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [promo, setPromo] = useState<{ from: number; to: number } | null>(null);
  const editMode = !dests && (!!props.onSquareTap || !!props.onPieceDrop);

  // square index <-> display position (col, row from the top-left)
  const disp = (sq: number) => {
    const r = Math.floor(sq / 8);
    const c = sq % 8;
    return orientation === 'w' ? { c, r } : { c: 7 - c, r: 7 - r };
  };
  const sqAt = (c: number, r: number) => (orientation === 'w' ? r * 8 + c : (7 - r) * 8 + (7 - c));

  const toBoard = (e: ReactPointerEvent) => {
    const rect = svgRef.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * 8,
      y: ((e.clientY - rect.top) / rect.height) * 8,
    };
  };
  const squareFromXY = (x: number, y: number) =>
    x < 0 || y < 0 || x >= 8 || y >= 8 ? null : sqAt(Math.floor(x), Math.floor(y));

  const tryMove = (from: number, to: number) => {
    setSelected(null);
    if (props.isPromotion?.(from, to)) setPromo({ from, to });
    else props.onMove?.(from, to);
  };

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (promo || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const { x, y } = toBoard(e);
    const sq = squareFromXY(x, y);
    if (sq === null) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const base = { from: sq, x, y, startX: x, startY: y, moved: false, wasSelected: false };
    if (editMode) {
      setDrag(board[sq] && props.onPieceDrop ? base : { ...base, from: -1 - sq });
      return;
    }
    if (!dests) return;
    if (selected !== null && selected !== sq && dests.get(selected)?.includes(sq)) {
      tryMove(selected, sq);
      return;
    }
    if (board[sq] && dests.has(sq)) {
      setDrag({ ...base, wasSelected: selected === sq });
      setSelected(sq);
    } else {
      setSelected(null);
    }
  };

  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!drag || drag.from < 0) return;
    const { x, y } = toBoard(e);
    const moved = drag.moved || Math.hypot(x - drag.startX, y - drag.startY) > 0.2;
    setDrag({ ...drag, x, y, moved });
  };

  const onPointerUp = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!drag) return;
    const { x, y } = toBoard(e);
    const target = squareFromXY(x, y);
    setDrag(null);
    if (drag.from < 0) {
      // edit mode tap on an empty square
      props.onSquareTap?.(-1 - drag.from);
      return;
    }
    if (editMode) {
      if (drag.moved) props.onPieceDrop?.(drag.from, target);
      else props.onSquareTap?.(drag.from);
      return;
    }
    if (drag.moved) {
      if (target !== null && target !== drag.from && dests?.get(drag.from)?.includes(target)) {
        tryMove(drag.from, target);
      }
    } else if (drag.wasSelected) {
      setSelected(null);
    }
  };

  const square = (c: number, r: number) => {
    const light = (c + r) % 2 === 0;
    return <rect key={`s${c}${r}`} x={c} y={r} width={1} height={1} fill={light ? theme.light : theme.dark} />;
  };

  const overlays: JSX.Element[] = [];
  const hl = (sq: number, fill: string, key: string) => {
    const { c, r } = disp(sq);
    overlays.push(<rect key={key} x={c} y={r} width={1} height={1} style={{ fill }} />);
  };
  if (props.lastMove) {
    hl(props.lastMove[0], theme.highlight, 'lm0');
    hl(props.lastMove[1], theme.highlight, 'lm1');
  }
  if (marks) for (const [sq, fill] of Object.entries(marks)) hl(Number(sq), fill, `mk${sq}`);
  if (selected !== null) hl(selected, 'var(--sq-selected)', 'sel');
  if (props.checkSquare !== null && props.checkSquare !== undefined) {
    const { c, r } = disp(props.checkSquare);
    overlays.push(<rect key="chk" x={c} y={r} width={1} height={1} fill="url(#check)" />);
  }

  const dots: JSX.Element[] = [];
  if (selected !== null && dests) {
    for (const to of dests.get(selected) ?? []) {
      const { c, r } = disp(to);
      dots.push(
        board[to] ? (
          <circle key={`d${to}`} cx={c + 0.5} cy={r + 0.5} r={0.455} style={{ fill: 'none', stroke: 'var(--sq-dot)' }} strokeWidth={0.09} />
        ) : (
          <circle key={`d${to}`} cx={c + 0.5} cy={r + 0.5} r={0.16} style={{ fill: 'var(--sq-dot)' }} />
        ),
      );
    }
  }

  const pieces: JSX.Element[] = [];
  board.forEach((p, sq) => {
    if (!p) return;
    if (drag && drag.moved && drag.from === sq) return;
    const { c, r } = disp(sq);
    pieces.push(<image key={`p${sq}${p}`} href={pieceUrl(pieceSet, p)} x={c} y={r} width={1} height={1} />);
  });
  let dragged: JSX.Element | null = null;
  if (drag && drag.moved && drag.from >= 0 && board[drag.from]) {
    dragged = (
      <image
        href={pieceUrl(pieceSet, board[drag.from]!)}
        x={drag.x - 0.6}
        y={drag.y - 0.75}
        width={1.2}
        height={1.2}
        style={{ pointerEvents: 'none' }}
      />
    );
  }

  const coordEls: JSX.Element[] = [];
  if (props.coords !== false) {
    for (let i = 0; i < 8; i++) {
      const rankLabel = orientation === 'w' ? String(8 - i) : String(i + 1);
      const fileLabel = orientation === 'w' ? FILES[i] : FILES[7 - i];
      coordEls.push(
        <text key={`r${i}`} x={0.08} y={i + 0.23} fontSize={0.18} fontWeight={600} fill={i % 2 === 0 ? theme.dark : theme.light}>
          {rankLabel}
        </text>,
        <text key={`f${i}`} x={i + 0.92} y={7.92} fontSize={0.18} fontWeight={600} textAnchor="end" fill={i % 2 === 0 ? theme.light : theme.dark}>
          {fileLabel}
        </text>,
      );
    }
  }

  const arrowEls = arrows.map((a, i) => {
    const f = disp(a.from);
    const t = disp(a.to);
    const x1 = f.c + 0.5, y1 = f.r + 0.5, x2 = t.c + 0.5, y2 = t.r + 0.5;
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (len < 1e-6) return null;
    const ux = (x2 - x1) / len, uy = (y2 - y1) / len;
    const w = a.width ?? 0.16;
    const head = Math.min(0.42, len * 0.5);
    const hw = w * 2.4;
    const sx = x1 + ux * 0.18, sy = y1 + uy * 0.18; // start a bit off the center
    const tipX = x2 - ux * 0.08, tipY = y2 - uy * 0.08;
    const bx = tipX - ux * head, by = tipY - uy * head;
    const nx = -uy, ny = ux;
    const pts = [
      [sx + nx * w / 2, sy + ny * w / 2],
      [bx + nx * w / 2, by + ny * w / 2],
      [bx + nx * hw / 2, by + ny * hw / 2],
      [tipX, tipY],
      [bx - nx * hw / 2, by - ny * hw / 2],
      [bx - nx * w / 2, by - ny * w / 2],
      [sx - nx * w / 2, sy - ny * w / 2],
    ];
    return (
      <polygon
        key={`a${i}-${a.from}-${a.to}`}
        points={pts.map((p) => p.map((v) => v.toFixed(3)).join(',')).join(' ')}
        style={{ fill: a.color }}
        opacity={a.opacity}
        strokeLinejoin="round"
      />
    );
  });

  let promoEl: JSX.Element | null = null;
  if (promo) {
    const { c, r } = disp(promo.to);
    const color = props.promotionColor ?? (r === 0 ? 'w' : 'b');
    const dir = r === 0 ? 1 : -1;
    const choices = ['q', 'n', 'r', 'b'];
    promoEl = (
      <g>
        <rect x={0} y={0} width={8} height={8} fill="rgba(0,0,0,0.45)" onPointerDown={() => setPromo(null)} />
        {choices.map((p, i) => {
          const y = r + dir * i;
          const piece = (color === 'w' ? p.toUpperCase() : p) as PieceChar;
          return (
            <g
              key={p}
              className="promo-choice"
              data-piece={p}
              onPointerDown={(e) => {
                e.stopPropagation();
                const { from, to } = promo;
                setPromo(null);
                props.onMove?.(from, to, p);
              }}
            >
              <circle cx={c + 0.5} cy={y + 0.5} r={0.48} fill="#f4f4f4" stroke="#999" strokeWidth={0.02} />
              <image href={pieceUrl(pieceSet, piece)} x={c + 0.05} y={y + 0.05} width={0.9} height={0.9} />
            </g>
          );
        })}
      </g>
    );
  }

  const rows = Array.from({ length: 8 }, (_, r) => r);
  return (
    <div className="board-wrap">
      <svg
        ref={svgRef}
        className="board"
        viewBox="0 0 8 8"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => setDrag(null)}
        data-orientation={orientation}
      >
        <defs>
          <radialGradient id="check">
            <stop offset="0%" stopColor="rgba(255,0,0,1)" />
            <stop offset="25%" stopColor="rgba(231,0,0,1)" />
            <stop offset="89%" stopColor="rgba(169,0,0,0)" />
            <stop offset="100%" stopColor="rgba(158,0,0,0)" />
          </radialGradient>
        </defs>
        {rows.map((r) => rows.map((c) => square(c, r)))}
        {coordEls}
        {overlays}
        {dots}
        {pieces}
        <g style={{ pointerEvents: 'none' }}>{arrowEls}</g>
        {dragged}
        {promoEl}
      </svg>
    </div>
  );
}
