import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { fenAt, newLine, restoreLine, type Line } from './chess/game';
import { START_FEN, parseFen, type Color } from './chess/position';
import { addToHistory, clearHistory, loadHistory, thumbnail, type ScanRecord } from './app/history';
import { isNative, tapFeedback } from './app/platform';
import { applyScheme } from './app/schemes';
import { deleteAllData, loadJson, loadSettings, saveJson, saveSettings, type Settings } from './app/settings';
import { APP_NAME } from './app/config';
import { setLanguage, t } from './i18n';
import { AnalysisScreen, type Mode } from './ui/AnalysisScreen';
import { EditorScreen, type ScanReview } from './ui/EditorScreen';
import { ScanScreen } from './ui/ScanScreen';
import { releasePhoto } from './vision/photo';
import { AboutScreen } from './ui/AboutScreen';
import { PrivacyScreen } from './ui/PrivacyScreen';
import { PuzzleScreen } from './ui/PuzzleScreen';
import { SettingsScreen } from './ui/SettingsScreen';
import { setTipsDismissed } from './ui/WelcomeCard';
import { TipJarScreen } from './ui/TipJarScreen';
import { LicencesScreen } from './ui/LicencesScreen';
import { listenForLateTips, tipsAvailable } from './app/tips';
import { IconBoard, IconCamera, IconLeft, IconPuzzle, IconSettings, Logo } from './ui/icons';

type Screen = 'home' | 'puzzles' | 'scan' | 'review' | 'edit' | 'settings' | 'privacy' | 'about' | 'tips' | 'licences';

/** screens of the tab bar (and Settings): each keeps its scroll position, like iOS tabs */
const TABS: Screen[] = ['home', 'puzzles', 'settings'];

/** pages opened from Settings */
const SETTINGS_PAGES: Screen[] = ['privacy', 'about', 'tips'];

/** where Back goes from each screen */
const backTo = (s: Screen): Screen => (s === 'licences' ? 'about' : SETTINGS_PAGES.includes(s) ? 'settings' : 'home');

const LINE_KEY = 'chessy.line.v1';
const ORIENTATION_KEY = 'chessy.orientation.v1';
const MODE_KEY = 'chessy.mode.v1';
/** two taps on Board within this many ms start a new game */
const DOUBLE_TAP_MS = 600;

interface Toast {
  text: string;
  action?: { label: string; run: () => void };
}

function initialLine(): Line {
  return restoreLine(loadJson<unknown>(LINE_KEY)) ?? newLine(START_FEN);
}

export function App() {
  const [settings, setSettingsState] = useState<Settings>(loadSettings);
  const [line, setLine] = useState<Line>(initialLine);
  const [orientation, setOrientation] = useState<Color>(() => loadJson<Color>(ORIENTATION_KEY) ?? 'w');
  const [screen, setScreen] = useState<Screen>('home');
  const [mode, setMode] = useState<Mode>(() => {
    const m = loadJson<Mode>(MODE_KEY);
    return m === 'solve' || m === 'play' ? m : 'analyze';
  });
  const [review, setReview] = useState<ScanReview | null>(null);
  const [scanKey, setScanKey] = useState(0);
  const [resumeScan, setResumeScan] = useState<ScanReview['source'] | null>(null);
  const [history, setHistory] = useState<ScanRecord[]>(loadHistory);
  const [toastMsg, setToastMsg] = useState<Toast | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastHomeTap = useRef(0);
  const homeButton = useRef<HTMLButtonElement>(null);

  // A new screen starts at the top; switching tabs or going back to Settings returns to where it was.
  const mainRef = useRef<HTMLElement>(null);
  const scrolled = useRef<Partial<Record<Screen, number>>>({});
  const shownScreen = useRef(screen);
  useLayoutEffect(() => {
    const prev = shownScreen.current;
    if (prev === screen || !mainRef.current) return;
    shownScreen.current = screen;
    const back = backTo(prev) === screen && (SETTINGS_PAGES.includes(prev) || prev === 'licences');
    const restore = back || (TABS.includes(prev) && TABS.includes(screen));
    mainRef.current.scrollTop = restore ? (scrolled.current[screen] ?? 0) : 0;
  }, [screen]);

  // Android hardware back button: return to the analysis screen, exit from there
  const screenRef = useRef(screen);
  screenRef.current = screen;
  useEffect(() => {
    if (!isNative()) return;
    let remove: (() => void) | undefined;
    import('@capacitor/app').then(({ App: CapApp }) => {
      CapApp.addListener('backButton', () => {
        if (screenRef.current !== 'home') setScreen(backTo(screenRef.current));
        else CapApp.exitApp();
      }).then((h) => (remove = () => h.remove()));
    });
    return () => remove?.();
  }, []);

  // colour scheme ('auto' follows the system light / dark setting)
  useEffect(() => {
    applyScheme(settings.scheme);
    if (settings.scheme !== 'auto' || typeof matchMedia !== 'function') return;
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyScheme('auto');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [settings.scheme]);

  // 'auto' language: follow the system language when it changes (the iOS app restarts anyway)
  const [, setLanguageVersion] = useState(0);
  useEffect(() => {
    if (settings.language !== 'auto') return;
    const onChange = () => {
      setLanguage('auto');
      setLanguageVersion((v) => v + 1);
    };
    window.addEventListener('languagechange', onChange);
    return () => window.removeEventListener('languagechange', onChange);
  }, [settings.language]);

  const toast = useCallback((text: string, action?: Toast['action']) => {
    setToastMsg({ text, action });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), action ? 5000 : 2600);
  }, []);

  // a tip approved later (Ask to Buy) says thank you whenever it arrives
  useEffect(() => {
    if (!tipsAvailable()) return;
    return listenForLateTips(() => toast(t('tips.thanks', { app: APP_NAME })));
  }, [toast]);

  useEffect(() => saveJson(LINE_KEY, line), [line]);
  useEffect(() => saveJson(ORIENTATION_KEY, orientation), [orientation]);
  useEffect(() => saveJson(MODE_KEY, mode), [mode]);

  const setSettings = (s: Settings) => {
    if (s.language !== settings.language) setLanguage(s.language);
    setSettingsState(s);
    saveSettings(s);
    if (!s.keepScans && history.length) setHistory(clearHistory());
  };

  /** Removes everything stored on the device and starts the app afresh. */
  const deleteData = () => {
    const ok = window.confirm(t('app.deleteConfirm', { app: APP_NAME }));
    if (!ok) return;
    deleteAllData();
    location.reload();
  };

  const startScan = (resume: ScanReview['source'] | null = null) => {
    // a fresh scan no longer needs the previous photo
    if (!resume && review?.source) releasePhoto(review.source.photo);
    setResumeScan(resume);
    setScanKey((k) => k + 1);
    setScreen('scan');
  };

  const analyze = (fen: string, o: Color) => {
    setLine(newLine(fen));
    setOrientation(o);
    setScreen('home');
  };

  /** A puzzle (with its solution) on the analysis screen. */
  const analyzeLine = (l: Line, o: Color) => {
    setLine(l);
    setOrientation(o);
    setMode('analyze');
    setScreen('home');
  };

  /** Starting position, White at the bottom; the previous position can be restored from the toast. */
  const newGame = () => {
    tapFeedback();
    if (line.rootFen === START_FEN && line.moves.length === 0 && orientation === 'w') {
      // already there: confirm, but keep the Undo of a reset that just happened (extra taps)
      if (!toastMsg?.action) toast(t('app.newGame'));
      return;
    }
    const previous = { line, orientation };
    setLine(newLine(START_FEN));
    setOrientation('w');
    toast(t('app.newGame'), {
      label: t('app.undo'),
      run: () => {
        setLine(previous.line);
        setOrientation(previous.orientation);
      },
    });
  };

  // Board goes to the analysis screen; tapping it twice (or more) in a row starts a new game.
  // A tap anywhere else in between breaks the sequence.
  const onAnyPointerDown = (e: ReactPointerEvent) => {
    if (!homeButton.current?.contains(e.target as Node)) lastHomeTap.current = 0;
  };
  const onHomeTap = () => {
    const now = Date.now();
    const repeated = now - lastHomeTap.current < DOUBLE_TAP_MS;
    lastHomeTap.current = now;
    setScreen('home');
    if (repeated) newGame();
  };

  const showNav = screen === 'home' || screen === 'puzzles' || screen === 'settings';

  return (
    <div className={`app ${showNav ? 'with-nav' : 'with-actions'}`} onPointerDownCapture={onAnyPointerDown}>
      <header className="topbar">
        {!showNav && (
          <button className="back" aria-label={t('common.back')} onClick={() => setScreen(backTo(screen))}>
            <IconLeft />
          </button>
        )}
        <button className="brand" onClick={() => setScreen('home')}>
          <Logo />
          <span>{APP_NAME}</span>
        </button>
        {showNav && (
          <button
            className={`settings-btn ${screen === 'settings' ? 'active' : ''}`}
            aria-label={t('nav.settings')}
            onClick={() => setScreen('settings')}
          >
            <IconSettings size={22} />
          </button>
        )}
      </header>

      <main ref={mainRef} onScroll={(e) => (scrolled.current[screen] = e.currentTarget.scrollTop)}>
        {screen === 'home' && (
          <AnalysisScreen
            mode={mode}
            setMode={setMode}
            line={line}
            setLine={setLine}
            orientation={orientation}
            setOrientation={setOrientation}
            settings={settings}
            onEdit={() => setScreen('edit')}
            toast={toast}
            history={history}
            onOpenRecord={(r) => {
              setLine(newLine(r.fen));
              setOrientation(r.orientation ?? 'w');
            }}
            onClearHistory={() => setHistory(clearHistory())}
          />
        )}
        {screen === 'puzzles' && <PuzzleScreen settings={settings} onAnalyze={analyzeLine} />}
        {screen === 'scan' && (
          <ScanScreen
            key={scanKey}
            resume={resumeScan}
            settings={settings}
            toast={toast}
            onResult={(r) => {
              setReview(r);
              setScreen('review');
            }}
          />
        )}
        {screen === 'review' && review && (
          <EditorScreen
            mode="review"
            initial={review.setup}
            review={review}
            settings={settings}
            orientation={review.blackAtBottom ? 'b' : 'w'}
            onDone={async (fen, o, m) => {
              setMode(m);
              analyze(fen, o);
              if (settings.keepScans) setHistory(addToHistory(history, fen, await thumbnail(review.crop), o));
            }}
            onCancel={() => setScreen('home')}
            onRescan={() => startScan(review.source ?? null)}
          />
        )}
        {screen === 'edit' && (
          <EditorScreen
            mode="edit"
            initial={parseFen(fenAt(line)) ?? parseFen(START_FEN)!}
            settings={settings}
            orientation={orientation}
            onDone={(fen, o, m) => {
              setMode(m);
              analyze(fen, o);
            }}
            onCancel={() => setScreen('home')}
          />
        )}
        {screen === 'settings' && (
          <SettingsScreen
            settings={settings}
            onChange={setSettings}
            onShowTips={() => {
              setTipsDismissed(false);
              setScreen('home');
            }}
            onPrivacy={() => setScreen('privacy')}
            onAbout={() => setScreen('about')}
            onTips={() => setScreen('tips')}
            onDeleteData={deleteData}
          />
        )}
        {screen === 'privacy' && <PrivacyScreen scheme={settings.scheme} />}
        {screen === 'about' && <AboutScreen onLicences={() => setScreen('licences')} />}
        {screen === 'licences' && <LicencesScreen />}
        {screen === 'tips' && <TipJarScreen />}
      </main>

      {toastMsg && (
        <div className="toast" role="status">
          {toastMsg.text}
          {toastMsg.action && (
            <button
              className="toast-action"
              onClick={() => {
                toastMsg.action!.run();
                setToastMsg(null);
              }}
            >
              {toastMsg.action.label}
            </button>
          )}
        </div>
      )}

      {showNav && (
      <nav className="bottombar">
        <button
          ref={homeButton}
          className={`nav ${screen === 'home' ? 'active' : ''}`}
          aria-label={t('nav.board')}
          onClick={onHomeTap}
        >
          <IconBoard size={24} />
          <span>{t('nav.board')}</span>
        </button>
        <div className="camera-slot">
          <button className="camera" aria-label={t('nav.scan')} onClick={() => startScan()} data-testid="scan">
            <IconCamera size={28} />
          </button>
        </div>
        <button className={`nav ${screen === 'puzzles' ? 'active' : ''}`} aria-label={t('nav.puzzles')} onClick={() => setScreen('puzzles')}>
          <IconPuzzle size={24} />
          <span>{t('nav.puzzles')}</span>
        </button>
      </nav>
      )}
    </div>
  );
}
