// App identity and links, in one place. Renaming the app: change APP_NAME here, the
// display name in ios/App/App/Info.plist (CFBundleDisplayName), the web manifest and
// index.html title. Before a release, run `npm run release-check`.

export const APP_NAME = 'PocketFish';
/** The copyright holder: only in the legal lines (About's legal notice and ©, Licences). */
export const DEVELOPER = 'Iman Soltanzadeh';
/** The studio, shown in About as an endorsement ("A product by …") linking its website. */
export const BRAND = 'Agile With AI';
export const BRAND_URL = 'https://agilewithai.com/';
/** The studio's website in German, for the app in German. */
export const BRAND_URL_DE = 'https://agilewithai.com/de';

/** Where feedback and support mail goes (shown in the app, on support.html and privacy.html). */
export const SUPPORT_EMAIL = 'PocketFish@AgileWithAI.com';

/** The public source code (GPL), without the recognition models: npm run publish-source fills it. */
export const SOURCE_URL = 'https://github.com/ImanSoltan/PocketFish-source';
/** GitHub Pages of the public repository: the privacy and support pages. */
export const WEB_URL = 'https://imansoltan.github.io/PocketFish-source/';
export const PRIVACY_URL = `${WEB_URL}privacy.html`;
export const SUPPORT_URL = `${WEB_URL}support.html`;

/** Numeric App Store id (App Store Connect > App Information > Apple ID); enables "Rate". */
export const APP_STORE_ID = '';

/** Tips: consumable in-app purchases with these product ids in App Store Connect (store/README.md). */
export const TIP_IDS = {
  small: 'com.agilewithai.pocketfish.tip.small',
  medium: 'com.agilewithai.pocketfish.tip.medium',
  large: 'com.agilewithai.pocketfish.tip.large',
} as const;

/** Version of the web build (package.json); the native apps report their own. */
export const APP_VERSION: string = __APP_VERSION__;
