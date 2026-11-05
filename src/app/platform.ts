// Small wrappers that use native Capacitor plugins inside the app and web APIs
// in the browser.
import { Capacitor } from '@capacitor/core';

export const isNative = () => Capacitor.isNativePlatform();
export const isIOS = () => Capacitor.getPlatform() === 'ios';

export async function openUrl(url: string) {
  if (isNative()) {
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({ url });
  } else {
    window.open(url, '_blank', 'noopener');
  }
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (isNative()) {
      const { Clipboard } = await import('@capacitor/clipboard');
      await Clipboard.write({ string: text });
    } else {
      await navigator.clipboard.writeText(text);
    }
    return true;
  } catch {
    return false;
  }
}

export async function readText(): Promise<string | null> {
  try {
    if (isNative()) {
      const { Clipboard } = await import('@capacitor/clipboard');
      const r = await Clipboard.read();
      return r.value ?? null;
    }
    return await navigator.clipboard.readText();
  } catch {
    return null;
  }
}

/**
 * The picture on the clipboard, if there is one. Only called when the user taps Paste: iOS asks
 * them to allow pasting, browsers show their own prompt.
 */
export async function readClipboardImage(): Promise<Blob | null> {
  try {
    if (isNative()) {
      const { Clipboard } = await import('@capacitor/clipboard');
      const r = await Clipboard.read();
      if (!r.type?.startsWith('image/') || !r.value?.startsWith('data:')) return null;
      return await (await fetch(r.value)).blob(); // a data: URL, decoded locally
    }
    for (const item of await navigator.clipboard.read()) {
      const type = item.types.find((t) => t.startsWith('image/'));
      if (type) return await item.getType(type);
    }
  } catch {
    // nothing on the clipboard, or pasting not allowed
  }
  return null;
}

export async function tapFeedback() {
  if (!isNative()) return;
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    // haptics unavailable
  }
}

/** A success / error vibration, e.g. for a right or wrong answer in solve mode. */
export async function resultFeedback(success: boolean) {
  if (!isNative()) return;
  try {
    const { Haptics, NotificationType } = await import('@capacitor/haptics');
    await Haptics.notification({ type: success ? NotificationType.Success : NotificationType.Error });
  } catch {
    // haptics unavailable
  }
}

/** Pick a photo: native camera / library sheet in the app, file input on the web. */
export async function pickPhotoNative(source: 'camera' | 'photos'): Promise<Blob | null> {
  const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
  try {
    const photo = await Camera.getPhoto({
      source: source === 'camera' ? CameraSource.Camera : CameraSource.Photos,
      resultType: CameraResultType.Uri,
      quality: 90,
      correctOrientation: true,
      width: 2000,
    });
    if (!photo.webPath) return null;
    return await (await fetch(photo.webPath)).blob();
  } catch {
    return null; // cancelled
  }
}

export const lichessUrl = (fen: string, orientation: 'w' | 'b') =>
  `https://lichess.org/analysis/standard/${fen.replace(/ /g, '_')}${orientation === 'b' ? '?color=black' : ''}`;

export const chessComUrl = (fen: string, orientation: 'w' | 'b') =>
  `https://www.chess.com/analysis?fen=${encodeURIComponent(fen)}${orientation === 'b' ? '&flip=true' : ''}`;
