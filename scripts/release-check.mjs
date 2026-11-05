// Checks the things App Store review and a release need, before archiving in Xcode:
//
//   npm run release-check
//
// ✗ = must fix (exit code 1), ⚠ = worth a look, ✓ = fine.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
let failed = 0;
const ok = (msg) => console.log(`✓ ${msg}`);
const warn = (msg) => console.log(`⚠ ${msg}`);
const fail = (msg) => {
  failed++;
  console.log(`✗ ${msg}`);
};

// --- app config ---
const config = read('src/app/config.ts');
const constant = (name) => new RegExp(`export const ${name}(?::\\s*\\w+)?\\s*=\\s*'([^']*)'`).exec(config)?.[1] ?? '';
const appName = constant('APP_NAME');
const email = constant('SUPPORT_EMAIL');
if (!email || email.endsWith('@example.com')) fail(`SUPPORT_EMAIL in src/app/config.ts is still a placeholder (${email})`);
else ok(`support email: ${email}`);
for (const page of ['public/privacy.html', 'public/support.html']) {
  const html = read(page);
  if (html.includes('@example.com')) fail(`${page} still shows the placeholder address`);
  else if (!html.includes(email)) fail(`${page} doesn't show the support email (${email})`);
  else ok(`${page} shows the support email`);
}
if (!constant('APP_STORE_ID')) warn('APP_STORE_ID is empty: the "Rate" link stays hidden (fine for the first release)');

// --- iOS project ---
const plist = read('ios/App/App/Info.plist');
const plistString = (key) => new RegExp(`<key>${key}</key>\\s*<string>([^<]*)</string>`).exec(plist)?.[1];
const displayName = plistString('CFBundleDisplayName');
if (displayName !== appName) warn(`Info.plist display name "${displayName}" differs from APP_NAME "${appName}"`);
else ok(`display name: ${displayName}`);
// the camera plugin refuses to open the camera unless all three texts exist, even unused ones
for (const key of ['NSCameraUsageDescription', 'NSPhotoLibraryUsageDescription', 'NSPhotoLibraryAddUsageDescription']) {
  if (plistString(key)) ok(`${key} is set`);
  else fail(`Info.plist lacks ${key}`);
}
// the app's languages: declared to iOS (the web view only offers these to navigator.language), with the
// permission prompts translated
const languages = [.../LANGUAGES = \[([^\]]*)\]/.exec(read('src/i18n/index.ts'))[1].matchAll(/'(\w+)'/g)].map((m) => m[1]);
const declared = [.../<key>CFBundleLocalizations<\/key>\s*<array>([\s\S]*?)<\/array>/.exec(plist)?.[1].matchAll(/<string>(\w+)<\/string>/g) ?? []].map((m) => m[1]);
const missing = languages.filter((l) => !declared.includes(l));
if (missing.length) fail(`Info.plist CFBundleLocalizations lacks ${missing.join(', ')} (the app has ${languages.join(', ')})`);
else ok(`languages: ${declared.join(', ')}`);
for (const lang of languages) {
  const file = `ios/App/App/${lang}.lproj/InfoPlist.strings`;
  const strings = fs.existsSync(path.join(root, file)) ? read(file) : '';
  const lacking = ['NSCameraUsageDescription', 'NSPhotoLibraryUsageDescription', 'NSPhotoLibraryAddUsageDescription'].filter(
    (key) => !strings.includes(`${key} = "`),
  );
  if (!strings) fail(`${file} is missing (the permission prompts would be in English)`);
  else if (lacking.length) fail(`${file} lacks ${lacking.join(', ')}`);
  else if (!read('ios/App/App.xcodeproj/project.pbxproj').includes(`path = ${lang}.lproj/InfoPlist.strings;`))
    fail(`${file} isn't in the Xcode project, so it isn't in the app`);
  else ok(`${lang}: permission prompts translated`);
}
// tips: the StoreKit plugin is part of the app and registered, and the product ids match the store guide
const pbxproj = read('ios/App/App.xcodeproj/project.pbxproj');
const registered =
  read('ios/App/App/SceneDelegate.swift').includes('MainViewController()') &&
  read('ios/App/App/MainViewController.swift').includes('registerPluginInstance(StorePlugin())');
if (!pbxproj.includes('StorePlugin.swift in Sources') || !registered)
  fail('the tip plugin (StorePlugin.swift) is not in the Xcode project or not registered in MainViewController');
else ok('tip plugin registered');
const tipIds = [...read('src/app/config.ts').matchAll(/'(com\.[\w.]+\.tip\.\w+)'/g)].map((m) => m[1]);
const undocumented = tipIds.filter((id) => !read('store/README.md').includes(id));
if (tipIds.length !== 3 || undocumented.length) fail(`tip product ids and store/README.md disagree: ${undocumented.join(', ')}`);
else ok(`tips: ${tipIds.map((id) => id.split('.').pop()).join(', ')} (consumables in App Store Connect)`);
if (/<key>ITSAppUsesNonExemptEncryption<\/key>\s*<false\/>/.test(plist)) ok('export compliance: no encryption declared');
else fail('Info.plist lacks ITSAppUsesNonExemptEncryption = NO (App Store Connect will ask on every upload)');

const pbx = read('ios/App/App.xcodeproj/project.pbxproj');
const setting = (key) => [...new Set([...pbx.matchAll(new RegExp(`${key} = ([^;]+);`, 'g'))].map((m) => m[1].replace(/"/g, '')))];

// one bundle id everywhere: it is permanent once the first build is uploaded
const appId = /appId:\s*'([^']+)'/.exec(read('capacitor.config.ts'))?.[1];
const iosIds = setting('PRODUCT_BUNDLE_IDENTIFIER');
const androidId = /applicationId\s+"([^"]+)"/.exec(read('android/app/build.gradle'))?.[1];
if (iosIds.length === 1 && iosIds[0] === appId && androidId === appId) ok(`bundle id: ${appId}`);
else fail(`bundle ids differ: capacitor.config.ts ${appId}, Xcode ${iosIds.join(' / ')}, Android ${androidId}`);
const pkgVersion = JSON.parse(read('package.json')).version;
const marketing = setting('MARKETING_VERSION');
const build = setting('CURRENT_PROJECT_VERSION');
const same = (a, b) => {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  return [0, 1, 2].every((i) => (pa[i] ?? 0) === (pb[i] ?? 0));
};
if (marketing.length === 1 && same(marketing[0], pkgVersion))
  ok(`version ${marketing[0]} (build ${build.join(', ')}); package.json ${pkgVersion}`);
else warn(`Xcode version ${marketing.join(', ')} vs package.json ${pkgVersion}: keep them in step`);
const families = setting('TARGETED_DEVICE_FAMILY');
if (families.some((f) => f.split(',').includes('2')))
  warn('the app also targets iPad: App Store Connect then needs iPad screenshots and review checks the iPad layout');
else ok('iPhone only');

// App icon: the 1024 px PNG must not have an alpha channel (colour type 4 or 6, or a tRNS chunk)
const iconDir = 'ios/App/App/Assets.xcassets/AppIcon.appiconset';
const icons = JSON.parse(read(`${iconDir}/Contents.json`)).images.filter((i) => i.filename);
for (const icon of icons) {
  const png = fs.readFileSync(path.join(root, iconDir, icon.filename));
  const colourType = png[25];
  const alpha = colourType === 4 || colourType === 6 || png.includes(Buffer.from('tRNS'));
  const width = png.readUInt32BE(16);
  if (alpha) fail(`${icon.filename} has an alpha channel (the App Store rejects it)`);
  else ok(`${icon.filename}: ${width}×${png.readUInt32BE(20)}, no alpha`);
}

// --- App Store texts: Apple's limits, in every language ---
const LIMITS = { 'App name': 30, Subtitle: 30, 'Promotional text': 170, Description: 4000, Keywords: 100 };
for (const file of fs.readdirSync(path.join(root, 'store')).filter((f) => /^listing(\.\w+)?\.md$/.test(f))) {
  const sections = Object.fromEntries(
    read(`store/${file}`)
      .split(/^## /m)
      .slice(1)
      .map((s) => [s.slice(0, s.indexOf('\n')).replace(/\s*\(.*$/, ''), s.slice(s.indexOf('\n')).trim()]),
  );
  const counts = [];
  const failedBefore = failed;
  for (const [field, max] of Object.entries(LIMITS)) {
    const body = sections[field];
    if (body === undefined) {
      fail(`store/${file} has no "${field}" section`);
      continue;
    }
    // short fields are the first `…`; promotional text the first paragraph (without a "(168)" count)
    const text = /^(App name|Subtitle|Keywords)$/.test(field)
      ? (/`([^`]+)`/.exec(body)?.[1] ?? '')
      : field === 'Promotional text'
        ? body.split(/\n\s*\n/)[0].replace(/\s*\(\d+\)$/, '')
        : body;
    const length = [...text].length;
    if (length > max) fail(`store/${file}: ${field} has ${length} characters (max ${max})`);
    if (field === 'Keywords' && /,\s/.test(text)) fail(`store/${file}: no spaces after the commas in the keywords`);
    counts.push(`${field.toLowerCase()} ${length}/${max}`);
  }
  if (failed === failedBefore) ok(`store/${file}: ${counts.join(', ')}`);
}

// the Licences page (About → Licences): the GPL notice, where the sources are, every bundled licence
const licences = fs.existsSync(path.join(root, 'public/licenses.txt')) ? read('public/licenses.txt') : '';
if (!licences) fail('public/licenses.txt is missing: run npm run build (scripts/licenses.mjs writes it)');
else if (!licences.includes('WITHOUT ANY WARRANTY') || !licences.includes(constant('SOURCE_URL')) || !licences.includes('stockfish.js/tree/'))
  fail('public/licenses.txt is out of date: run node scripts/licenses.mjs');
else ok('licences page: GPL notice, source links and bundled licences');

// --- repository ---
// the public source (npm run publish-source) leaves out the models and the training pipeline
try {
  const { execSync } = await import('node:child_process');
  const listed = execSync('git archive --format=tar HEAD | tar -t', { cwd: root, maxBuffer: 64 << 20 }).toString();
  if (/^(public\/models|ml)\//m.test(listed)) fail('the public source export would include public/models or ml/: check .gitattributes');
  else ok('public source export leaves out the models and ml/');
} catch {
  warn('could not check the public source export (git archive)');
}
try {
  const status = fs.existsSync(path.join(root, '.git')) ? (await import('node:child_process')).execSync('git status --porcelain', { cwd: root }).toString() : '';
  if (status.trim()) warn('uncommitted changes: commit them so the release matches the source on GitHub');
  else ok('working tree clean');
} catch {
  warn('could not run git status');
}

console.log(failed ? `\n${failed} problem(s) to fix before submitting.` : '\nReady for Product → Archive in Xcode.');
process.exit(failed ? 1 : 0);
