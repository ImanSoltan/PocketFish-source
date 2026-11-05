import { createElement, type ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TIP_IDS } from '../../src/app/config';
import { giveTip, isSupporter, listenForLateTips, loadTips, type StoreBackend } from '../../src/app/tips';
import { TipJar } from '../../src/ui/TipJarScreen';

// localStorage for the thank-you flag (the tests run in Node)
const store = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() {
    return store.size;
  },
} as Storage;

function fakeStore(overrides: Partial<StoreBackend> = {}): StoreBackend {
  return {
    products: async () => ({
      products: [
        { id: TIP_IDS.large, title: 'Large', price: '€9.99' },
        { id: 'com.example.other', title: 'Other', price: '€1.00' },
        { id: TIP_IDS.small, title: 'Small', price: '€1.99' },
      ],
    }),
    purchase: async () => ({ state: 'purchased' }),
    addListener: async () => ({ remove: async () => {} }),
    ...overrides,
  };
}

beforeEach(() => store.clear());

describe('tips', () => {
  it('lists the tips smallest first, leaving out the ones the App Store lacks', async () => {
    expect(await loadTips(fakeStore())).toEqual([
      { id: TIP_IDS.small, size: 'small', price: '€1.99' },
      { id: TIP_IDS.large, size: 'large', price: '€9.99' },
    ]);
  });

  it('asks the App Store for exactly the three tips', async () => {
    const products = vi.fn(async () => ({ products: [] }));
    await loadTips(fakeStore({ products }));
    expect(products).toHaveBeenCalledWith({ ids: [TIP_IDS.small, TIP_IDS.medium, TIP_IDS.large] });
  });

  it('a tip says thanks and is remembered on the device', async () => {
    expect(isSupporter()).toBe(false);
    expect(await giveTip(TIP_IDS.small, fakeStore())).toBe('thanks');
    expect(isSupporter()).toBe(true);
  });

  it('a cancelled or pending tip changes nothing', async () => {
    expect(await giveTip(TIP_IDS.small, fakeStore({ purchase: async () => ({ state: 'cancelled' }) }))).toBe('cancelled');
    expect(await giveTip(TIP_IDS.small, fakeStore({ purchase: async () => ({ state: 'pending' }) }))).toBe('pending');
    expect(isSupporter()).toBe(false);
  });

  it('a failed payment is reported', async () => {
    const purchase = async () => {
      throw new Error('no network');
    };
    await expect(giveTip(TIP_IDS.small, fakeStore({ purchase }))).rejects.toThrow('no network');
    expect(isSupporter()).toBe(false);
  });

  it('a tip approved later says thanks; listening can stop', async () => {
    let listener: ((e: { id: string }) => void) | undefined;
    const remove = vi.fn(async () => {});
    const onTip = vi.fn();
    const stop = listenForLateTips(
      onTip,
      fakeStore({
        addListener: async (_event, fn) => {
          listener = fn;
          return { remove };
        },
      }),
    );
    listener!({ id: TIP_IDS.medium });
    expect(onTip).toHaveBeenCalledOnce();
    expect(isSupporter()).toBe(true);
    stop();
    await new Promise((r) => setTimeout(r));
    expect(remove).toHaveBeenCalledOnce();
  });
});

describe('the tip jar screen', () => {
  type Props = ComponentProps<typeof TipJar>;
  const base: Props = {
    available: true,
    offers: [
      { id: TIP_IDS.small, size: 'small', price: '$1.99' },
      { id: TIP_IDS.medium, size: 'medium', price: '$4.99' },
      { id: TIP_IDS.large, size: 'large', price: '$9.99' },
    ],
    offline: false,
    busy: null,
    outcome: null,
    failure: null,
    supporter: false,
    onTip: () => {},
    onRetry: () => {},
  };
  const html = (props: Partial<Props> = {}) =>
    renderToStaticMarkup(createElement(TipJar, { ...base, ...props }));

  it('offers the three tips with their prices and says nothing is unlocked', () => {
    const page = html();
    for (const text of ['Small tip', '$1.99', 'Medium tip', '$4.99', 'Large tip', '$9.99']) expect(page).toContain(text);
    expect(page).toContain("doesn&#x27;t unlock anything");
    expect(page).toContain('every feature stays free');
  });

  it('in the browser, points to the iPhone app instead', () => {
    const page = html({ available: false, offers: null });
    expect(page).toContain('Tips are possible in the PocketFish iPhone app.');
    expect(page).not.toContain('$1.99');
  });

  it('while loading, offline, and when the App Store has no tips', () => {
    expect(html({ offers: null })).toContain('Loading the App Store prices');
    const offline = html({ offline: true });
    expect(offline).toContain('Couldn&#x27;t reach the App Store');
    expect(offline).toContain('Try again');
    expect(html({ offers: [] })).toContain('Tips aren&#x27;t available right now.');
  });

  it('thanks, waits for approval, or reports a failure', () => {
    expect(html({ outcome: 'thanks' })).toContain('Thank you! Your tip keeps PocketFish going.');
    expect(html({ outcome: 'pending' })).toContain('Waiting for approval');
    expect(html({ failure: 'no network' })).toContain('The tip didn&#x27;t go through: no network');
  });

  it('buttons wait while a tip is paid; an earlier tip is thanked', () => {
    expect(html({ busy: TIP_IDS.small }).match(/disabled=""/g)).toHaveLength(3);
    expect(html({ supporter: true })).toContain('Thank you for supporting PocketFish');
  });
});
