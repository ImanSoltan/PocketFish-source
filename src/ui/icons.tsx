// Icons from Lucide (ISC licence, https://lucide.dev), plus a few drawn for this app.
import {
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  CalendarDays,
  Camera,
  Check,
  ClipboardPaste,
  Code,
  Copy,
  Crop,
  ExternalLink,
  Eye,
  EyeOff,
  Flag,
  Flame,
  Globe,
  Heart,
  House,
  Info,
  Images,
  Lightbulb,
  Lock,
  Mail,
  Move,
  Pencil,
  Puzzle,
  Scale,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Settings,
  ShieldCheck,
  Trash2,
  Undo2,
  WifiOff,
  X,
  type LucideIcon,
} from 'lucide-react';

type P = { size?: number };

const icon = (Icon: LucideIcon, strokeWidth = 2) =>
  function LucideWrapped({ size = 22 }: P) {
    return <Icon size={size} strokeWidth={strokeWidth} aria-hidden="true" />;
  };

export const IconLeft = icon(ArrowLeft);
export const IconRight = icon(ArrowRight);
export const IconEdit = icon(Pencil);
export const IconFlip = icon(RefreshCw);
export const IconRotate = icon(RotateCw);
export const IconCopy = icon(Copy);
export const IconExternal = icon(ExternalLink);
export const IconCamera = icon(Camera, 2.1);
export const IconImage = icon(Images);
export const IconHome = icon(House);
export const IconSettings = icon(Settings);
export const IconCheck = icon(Check, 2.5);
export const IconX = icon(X, 2.5);
export const IconTrash = icon(Trash2);
export const IconLock = icon(Lock);
export const IconShield = icon(ShieldCheck);
export const IconWifiOff = icon(WifiOff);
export const IconEyeOff = icon(EyeOff);
export const IconEye = icon(Eye);
export const IconHand = icon(Move);
export const IconClipboard = icon(ClipboardPaste);
export const IconCrop = icon(Crop);
export const IconPuzzle = icon(Puzzle);
export const IconCalendar = icon(CalendarDays);
export const IconHint = icon(Lightbulb);
export const IconUndo = icon(Undo2);
export const IconSwap = icon(ArrowLeftRight);
export const IconRetry = icon(RotateCcw);
export const IconFlame = icon(Flame);
export const IconFlag = icon(Flag);
export const IconInfo = icon(Info);
export const IconMail = icon(Mail);
export const IconGlobe = icon(Globe);
export const IconCode = icon(Code);
export const IconHeart = icon(Heart);
export const IconLicence = icon(Scale);

/** A chessboard: four squares, two of them filled (drawn for this app). */
export const IconBoard = ({ size = 22 }: P) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="3" y="3" width="18" height="18" rx="3" />
    <path d="M3 12h18M12 3v18" />
    <path d="M4 4h8v8H4zM12 12h8v8h-8z" fill="currentColor" stroke="none" opacity="0.9" />
  </svg>
);

/** the app's symbol alone (scripts/make-icons.mjs), as a mask: drawn in the colour scheme's accent */
const glyphUrl = () => `url("${new URL('icon-glyph.svg', document.baseURI).href}")`;

/**
 * App logo inside the app: the symbol alone, so it blends with the colour scheme (top bar, Settings), or
 * the symbol on a frosted glass tile (About). The full-colour icon is for the home screen and the store.
 */
export const Logo = ({ size = 30, glass = false }: P & { glass?: boolean }) => {
  const mask = glyphUrl();
  return (
    <span className={`logo${glass ? ' logo-glass' : ''}`} style={{ width: size, height: size }} aria-hidden="true">
      <span className="logo-glyph" style={{ WebkitMaskImage: mask, maskImage: mask }} />
    </span>
  );
};
