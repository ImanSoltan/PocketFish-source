import { useEffect, useRef, useState, type JSX, type PointerEvent as ReactPointerEvent } from 'react';
import { forcedTurn, possibleCastling, type Setup } from '../chess/position';
import { applyH, homography, type Pt } from '../vision/geometry';
import { MODELS_MISSING, getVision } from '../vision/client';
import { loadPhoto, photoGray, rectifiedCrop, releasePhoto, rotatePhoto, type Photo } from '../vision/photo';
import { interpret } from '../vision/postprocess';
import { defaultQuad } from '../vision/recognize';
import { isIOS, isNative, pickPhotoNative, readClipboardImage } from '../app/platform';
import { APP_NAME } from '../app/config';
import type { Settings } from '../app/settings';
import type { ScanReview } from './EditorScreen';
import { IconCamera, IconClipboard, IconImage, IconLock, IconRotate } from './icons';
import { t } from '../i18n';

type Phase = 'pick' | 'loading' | 'detecting' | 'adjust' | 'recognizing';

interface Props {
  settings: Settings;
  onResult: (r: ScanReview) => void;
  toast: (msg: string) => void;
  /** photo handed over from outside (e.g. shared / pasted image) */
  initialBlob?: Blob | null;
  /** go straight to adjusting the corners of an earlier scan */
  resume?: { photo: Photo; corners: Pt[] } | null;
}

export function ScanScreen({ settings, onResult, toast, initialBlob, resume }: Props) {
  const [phase, setPhase] = useState<Phase>(resume ? 'adjust' : 'pick');
  const [photo, setPhoto] = useState<Photo | null>(resume?.photo ?? null);
  const [corners, setCorners] = useState<Pt[] | null>(resume?.corners ?? null);
  const [found, setFound] = useState(true);
  /** a build from the public source code, which has no recognition models */
  const [noModels, setNoModels] = useState(false);
  const camInput = useRef<HTMLInputElement>(null);
  const libInput = useRef<HTMLInputElement>(null);

  const detect = async (p: Photo) => {
    if (photo && photo !== p) releasePhoto(photo);
    setPhoto(p);
    setCorners(null);
    setPhase('detecting');
    try {
      const vision = getVision();
      await vision.setImage(photoGray(p));
      const det = await vision.detect();
      setFound(det.found);
      setCorners(det.found ? det.corners : defaultQuad(p.width, p.height));
    } catch (e) {
      console.error(e);
      toast(t('scan.detectFailed'));
      setFound(false);
      setCorners(defaultQuad(p.width, p.height));
    }
    setPhase('adjust');
  };

  const handleBlob = async (blob: Blob | null | undefined) => {
    if (!blob) return;
    setPhase('loading');
    try {
      await detect(await loadPhoto(blob));
    } catch (e) {
      console.error(e);
      toast(t('scan.openFailed'));
      setPhase('pick');
    }
  };

  // load the models while the user picks a photo; a build without them says so up front
  useEffect(() => {
    getVision().loaded.catch((e: Error) => e.message === MODELS_MISSING && setNoModels(true));
  }, []);

  useEffect(() => {
    if (initialBlob) handleBlob(initialBlob);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialBlob]);

  // paste an image (screenshots on desktop)
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith('image/'));
      if (item) handleBlob(item.getAsFile());
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pick = async (source: 'camera' | 'photos') => {
    // On iOS the file input's system photo picker hands over only the chosen photo, without asking for
    // access to the photo library (the camera plugin's picker asks for it first).
    const native = isNative() && !(source === 'photos' && isIOS());
    if (native) handleBlob(await pickPhotoNative(source));
    else (source === 'camera' ? camInput : libInput).current?.click();
  };

  // a screenshot or picture copied in another app
  const paste = async () => {
    const blob = await readClipboardImage();
    if (blob) handleBlob(blob);
    else toast(t('scan.noPicture'));
  };

  const recognize = async () => {
    if (!photo || !corners) return;
    setPhase('recognizing');
    try {
      const reading = await getVision().classify(corners);
      const res = interpret(reading.probs);
      const forced = forcedTurn(res.board);
      const castling = settings.assumeCastling
        ? possibleCastling(res.board)
        : { K: false, Q: false, k: false, q: false };
      const setup: Setup = {
        board: res.board,
        turn: forced ?? settings.defaultTurn,
        castling,
        ep: null,
        halfmove: 0,
        fullmove: 1,
      };
      onResult({
        setup,
        confidence: res.confidence,
        blackAtBottom: res.blackAtBottom,
        crop: rectifiedCrop(photo, reading.corners as [number, number][]),
        turnReason: forced ? 'check' : 'default',
        source: { photo, corners: reading.corners },
      });
    } catch (e) {
      console.error(e);
      toast(t('scan.recognizeFailed'));
      setPhase('adjust');
    }
  };

  const fileInputs = (
    <>
      <input
        ref={camInput}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        data-testid="camera-input"
        onChange={(e) => {
          handleBlob(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <input
        ref={libInput}
        type="file"
        accept="image/*"
        hidden
        data-testid="file-input"
        onChange={(e) => {
          handleBlob(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </>
  );

  if (phase === 'pick' || phase === 'loading' || !photo) {
    return (
      <div className="screen scan">
        {fileInputs}
        <div className="card scan-intro">
          <div className="title">{t('scan.title')}</div>
          <p className="muted">{t('scan.intro')}</p>
          <ul className="tips">
            <li>{t('scan.tip1')}</li>
            <li>{t('scan.tip2')}</li>
            <li>{t('scan.tip3')}</li>
          </ul>
        </div>
        {noModels && (
          <div className="card scan-intro" data-testid="no-models">
            <p className="muted">{t('scan.noModels', { app: APP_NAME })}</p>
          </div>
        )}
        <div className="scan-buttons" hidden={noModels}>
          <button className="primary big" onClick={() => pick('camera')} disabled={phase === 'loading'}>
            <IconCamera /> {t('scan.takePhoto')}
          </button>
          <button className="secondary big" onClick={() => pick('photos')} disabled={phase === 'loading'}>
            <IconImage /> {t('scan.choose')}
          </button>
          <button className="secondary wide" onClick={paste} disabled={phase === 'loading'} data-testid="paste">
            <IconClipboard /> {t('scan.paste')}
          </button>
        </div>
        {phase === 'loading' && <div className="muted center">{t('scan.opening')}</div>}
        <p className="privacy-note" data-testid="privacy-note">
          <IconLock size={15} /> {t('scan.privacy')}
        </p>
      </div>
    );
  }

  return (
    <div className="screen scan">
      {fileInputs}
      <div className="card hint-card">
        {t(phase === 'detecting' ? 'scan.looking' : phase === 'recognizing' ? 'scan.reading' : found ? 'scan.adjust' : 'scan.notFound')}
      </div>
      <QuadEditor photo={photo} corners={corners} onChange={setCorners} busy={phase !== 'adjust'} />
      <div className="actions">
        <button className="secondary" onClick={() => pick('camera')} disabled={phase !== 'adjust'}>
          {t('scan.retake')}
        </button>
        <button
          className="secondary icon-only"
          aria-label={t('scan.rotate')}
          disabled={phase !== 'adjust'}
          onClick={async () => detect(await rotatePhoto(photo))}
        >
          <IconRotate />
        </button>
        <button className="primary" onClick={recognize} disabled={phase !== 'adjust' || !corners} data-testid="recognize">
          {t('scan.recognize')}
        </button>
      </div>
    </div>
  );
}

const LOUPE = 114; // px, inner size of .loupe in styles.css (120 px minus its border)
const ZOOM = 3; // loupe magnification relative to the photo on screen

function QuadEditor({
  photo,
  corners,
  onChange,
  busy,
}: {
  photo: Photo;
  corners: Pt[] | null;
  onChange: (c: Pt[]) => void;
  busy: boolean;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  // the corner being dragged and its offset from the finger (photo px): the corner
  // moves with the finger instead of jumping under it, so it stays visible
  const [drag, setDrag] = useState<{ index: number; dx: number; dy: number } | null>(null);
  const { width: w, height: h } = photo;
  const unit = Math.max(w, h) / 100;

  /** On-screen scale (CSS px per photo px) and offset of the photo inside the svg (viewBox, xMidYMid meet). */
  const view = () => {
    const r = svgRef.current!.getBoundingClientRect();
    const scale = Math.min(r.width / w, r.height / h);
    return { r, scale, ox: (r.width - w * scale) / 2, oy: (r.height - h * scale) / 2 };
  };

  const toPhoto = (e: ReactPointerEvent): Pt => {
    const { r, scale, ox, oy } = view();
    return [(e.clientX - r.left - ox) / scale, (e.clientY - r.top - oy) / scale];
  };

  const onDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!corners || busy || !e.isPrimary) return;
    const p = toPhoto(e);
    // grab the nearest handle (generous touch target)
    let best = -1;
    let bd = Infinity;
    corners.forEach((c, i) => {
      const d = Math.hypot(c[0] - p[0], c[1] - p[1]);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    if (best >= 0 && bd < unit * 12) {
      e.currentTarget.setPointerCapture(e.pointerId);
      setDrag({ index: best, dx: corners[best][0] - p[0], dy: corners[best][1] - p[1] });
    }
  };
  const onMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!drag || !corners || !e.isPrimary) return;
    const [x, y] = toPhoto(e);
    const next = corners.slice();
    next[drag.index] = [Math.min(w, Math.max(0, x + drag.dx)), Math.min(h, Math.max(0, y + drag.dy))];
    onChange(next);
  };
  const onUp = () => setDrag(null);

  let grid: JSX.Element[] = [];
  if (corners) {
    try {
      const H = homography(
        [
          [0, 0],
          [8, 0],
          [8, 8],
          [0, 8],
        ],
        corners,
      );
      grid = Array.from({ length: 7 }, (_, i) => i + 1).flatMap((i) => {
        const a = applyH(H, [i, 0]);
        const b = applyH(H, [i, 8]);
        const c = applyH(H, [0, i]);
        const d = applyH(H, [8, i]);
        return [
          <line key={`v${i}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} vectorEffect="non-scaling-stroke" />,
          <line key={`h${i}`} x1={c[0]} y1={c[1]} x2={d[0]} y2={d[1]} vectorEffect="non-scaling-stroke" />,
        ];
      });
    } catch {
      grid = [];
    }
  }

  // the board outline and grid, drawn in photo coordinates with constant on-screen line widths
  const outline = corners && (
    <>
      <polygon
        points={corners.map((c) => c.join(',')).join(' ')}
        style={{ fill: 'var(--scan-line)', fillOpacity: 0.12, stroke: 'var(--scan-line)' }}
        strokeWidth={2.5}
        vectorEffect="non-scaling-stroke"
      />
      <g style={{ stroke: 'var(--scan-line)', strokeOpacity: 0.7 }} strokeWidth={1}>
        {grid}
      </g>
    </>
  );

  // the loupe shows the same photo and outline, magnified around the dragged corner
  let loupe: JSX.Element | null = null;
  if (drag && corners && svgRef.current) {
    const [cx, cy] = corners[drag.index];
    const s = view().scale * ZOOM;
    const r = LOUPE / 2 / s; // photo px from the corner to the loupe's edge
    loupe = (
      <div className={`loupe ${cx < w / 2 ? 'right' : 'left'}`} data-testid="loupe">
        <svg viewBox={`${cx - r} ${cy - r} ${2 * r} ${2 * r}`} aria-hidden="true">
          <image href={photo.url} width={w} height={h} />
          {outline}
          <circle cx={cx} cy={cy} r={7 / s} fill="none" stroke="#fff" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
    );
  }

  return (
    <div
      className="quad-wrap"
      // exactly the photo's aspect ratio, as large as fits: corners, loupe and photo line up
      style={{ aspectRatio: `${w} / ${h}`, width: `min(100%, calc(62dvh * ${w / h}))` }}
    >
      <img src={photo.url} alt={t('scan.photoAlt')} draggable={false} />
      <svg
        ref={svgRef}
        viewBox={`0 0 ${w} ${h}`}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        className={busy ? 'busy' : ''}
        data-testid="quad"
      >
        {outline}
        {corners?.map((c, i) => (
          <g key={i}>
            <circle cx={c[0]} cy={c[1]} r={unit * 3.2} fill="rgba(255,255,255,0.35)" stroke="#fff" strokeWidth={unit * 0.5} />
            <circle cx={c[0]} cy={c[1]} r={unit * 0.8} style={{ fill: 'var(--scan-line)' }} />
          </g>
        ))}
      </svg>
      {loupe}
      {busy && <div className="spinner-overlay"><div className="spinner" /></div>}
    </div>
  );
}
