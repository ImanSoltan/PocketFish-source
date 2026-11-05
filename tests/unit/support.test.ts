import { describe, expect, it } from 'vitest';
import { SUPPORT_EMAIL } from '../../src/app/config';
import { deviceName, feedbackMail, reviewUrl } from '../../src/app/support';

describe('support links', () => {
  it('names the device from the user agent', () => {
    const iphone =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';
    expect(deviceName(iphone)).toBe('iOS 18.1 (iPhone)');
    expect(deviceName('Mozilla/5.0 (iPad; CPU OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15')).toBe('iOS 17.4.1 (iPad)');
    expect(deviceName('Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36')).toBe('Android 15');
    expect(deviceName('Mozilla/5.0 (X11; Linux x86_64) Chrome/141.0')).toBe('Web');
  });

  it('prefills the feedback mail with the version and device', () => {
    const mail = feedbackMail('scan', '1.0 (3)', 'iOS 18.1 (iPhone)');
    expect(mail.startsWith(`mailto:${SUPPORT_EMAIL}?subject=`)).toBe(true);
    const body = decodeURIComponent(mail.split('body=')[1]);
    expect(body).toContain('Please attach the photo');
    expect(body).toContain('1.0 (3) · iOS 18.1 (iPhone)');
  });

  it('only offers a review link once the App Store id is known', () => {
    expect(reviewUrl()).toBeNull();
  });
});
