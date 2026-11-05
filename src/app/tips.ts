// Tips through the App Store (StoreKit 2, in ios/App/App/StorePlugin.swift). Everything in the app stays
// free; a tip only supports it. Apple handles the payment: the app keeps nothing but a local thank-you flag.
import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { TIP_IDS } from './config';
import { isIOS, isNative } from './platform';
import { loadJson, saveJson } from './settings';

export type TipSize = keyof typeof TIP_IDS;
export interface TipOffer {
  id: string;
  size: TipSize;
  /** in the customer's currency, from the App Store */
  price: string;
}
export type TipOutcome = 'thanks' | 'pending' | 'cancelled';

/** The native side (StorePlugin.swift). */
export interface StoreBackend {
  products(options: { ids: string[] }): Promise<{ products: { id: string; title: string; price: string }[] }>;
  purchase(options: { id: string }): Promise<{ state: 'purchased' | 'pending' | 'cancelled' }>;
  addListener(event: 'purchased', listener: (e: { id: string }) => void): Promise<PluginListenerHandle>;
}

const Store = registerPlugin<StoreBackend>('Store');

/** Tips go through the App Store, so only the iPhone app offers them. */
export const tipsAvailable = () => isNative() && isIOS();

const SUPPORTER_KEY = 'chessy.supporter.v1';
/** This device has given a tip (shown as a thank-you in Settings). */
export const isSupporter = () => loadJson<boolean>(SUPPORTER_KEY) === true;
const thank = () => saveJson(SUPPORTER_KEY, true);

/** The tips with their App Store prices, smallest first; ones missing in App Store Connect are left out. */
export async function loadTips(store: StoreBackend = Store): Promise<TipOffer[]> {
  const { products } = await store.products({ ids: Object.values(TIP_IDS) });
  return (Object.entries(TIP_IDS) as [TipSize, string][]).flatMap(([size, id]) => {
    const p = products.find((x) => x.id === id);
    return p ? [{ id, size, price: p.price }] : [];
  });
}

/** Opens Apple's payment sheet for a tip. */
export async function giveTip(id: string, store: StoreBackend = Store): Promise<TipOutcome> {
  const { state } = await store.purchase({ id });
  if (state !== 'purchased') return state;
  thank();
  return 'thanks';
}

/** A tip that went through later (approved with Ask to Buy); returns a function that stops listening. */
export function listenForLateTips(onTip: () => void, store: StoreBackend = Store): () => void {
  const handle = store.addListener('purchased', () => {
    thank();
    onTip();
  });
  return () => void handle.then((h) => h.remove());
}
