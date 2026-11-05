// Feedback mail, version and App Store links for the Help & feedback settings.
import { APP_NAME, APP_STORE_ID, APP_VERSION, SUPPORT_EMAIL } from './config';
import { isNative } from './platform';
import { t } from '../i18n';

/** "1.0 (3)" in the native app (from the app bundle), the package version on the web. */
export async function appVersion(): Promise<string> {
  if (!isNative()) return APP_VERSION;
  try {
    const { App } = await import('@capacitor/app');
    const info = await App.getInfo();
    return `${info.version} (${info.build})`;
  } catch {
    return APP_VERSION;
  }
}

/** "iOS 18.1 (iPhone)", "Android 15" or "Web", from a user agent string. */
export function deviceName(ua: string): string {
  const ios = /OS (\d+)_(\d+)(?:_(\d+))? like Mac OS X/.exec(ua);
  if (ios && /iPhone|iPad|iPod/.test(ua)) {
    const v = ios[3] ? `${ios[1]}.${ios[2]}.${ios[3]}` : `${ios[1]}.${ios[2]}`;
    return `iOS ${v} (${/iPad/.test(ua) ? 'iPad' : 'iPhone'})`;
  }
  const android = /Android (\d+(?:\.\d+)?)/.exec(ua);
  if (android) return `Android ${android[1]}`;
  return 'Web';
}

/** A mailto: link to support, with the app version and device filled in. */
export function feedbackMail(kind: 'feedback' | 'scan', version: string, device: string): string {
  const subject = kind === 'scan' ? `${APP_NAME}: a scan was misread` : `${APP_NAME} feedback`;
  const intro = kind === 'scan' ? t('mail.scanIntro') : '';
  const body = `${intro}\n\n\n\n—\n${APP_NAME} ${version} · ${device}`;
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** The App Store page with the review sheet open, once the app has an App Store id. */
export const reviewUrl = (): string | null =>
  APP_STORE_ID ? `https://apps.apple.com/app/id${APP_STORE_ID}?action=write-review` : null;
