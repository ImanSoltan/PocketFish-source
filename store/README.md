# Publishing PocketFish on the App Store

A step-by-step guide, from the developer account to the first approved version. The store texts
are in [`listing.md`](listing.md), the screenshots in [`screenshots/`](screenshots).

## 0. Decide first

- [x] **Name.** *PocketFish* ([`listing.md`](listing.md#name)); the store name `PocketFish: Chess Scanner` must
      still be free when you create the app record.
- [x] **Apple Developer Program.** Joined (Individual): the seller shown on the App Store is your legal name.
- [x] **Bundle ID.** `com.agilewithai.pocketfish`, permanent once the first build is uploaded. Apple doesn't
      check domain ownership, so it works with an Individual developer account; if AgileWithAI later becomes a
      company with its own Organization account, *App Transfer* in App Store Connect moves the app (with its
      bundle ID, ratings and reviews) there.
- [x] **Support email.** PocketFish@AgileWithAI.com, in `src/app/config.ts` (`SUPPORT_EMAIL`),
      `public/privacy.html` and `public/support.html`.
- [ ] **Price.** Free for version 1.0 (see "Price" below). A free app needs no tax or banking forms.
- [x] **Recognition models.** Trained only with assets whose licences allow commercial use
      (listed in `ml/TRAINING_ASSETS.md`, which stays out of the public source), so a paid version is fine too.

## 1. Join the Apple Developer Program (US$99 a year, or the local price)

Choose **Individual** or **Organization**:

- **Individual** — quickest. Your legal name (e.g. "Iman Soltanzadeh") is shown as the seller.
- **Organization** — the company name is shown instead. Needs a legal entity, a free **D-U-N-S number** from
  Dun & Bradstreet (can take up to two weeks) and a website on the company's domain.

Steps (individual):

1. Make sure your Apple ID has **two-factor authentication** on.
2. On your iPhone, install the **Apple Developer** app → *Account* → *Enroll Now* (the fastest way: it verifies
   your identity with a photo ID). Or use <https://developer.apple.com/programs/enroll/>.
3. Enter your legal name and address exactly as on your ID, accept the agreement and pay.
4. Wait for the "Welcome to the Apple Developer Program" email (usually within 48 hours).

## 2. App Store Connect: business details

At <https://appstoreconnect.apple.com> → **Business** (formerly *Agreements, Tax, and Banking*):

- The free-apps agreement is part of the developer agreement you already accepted.
- **Paid apps or in-app purchases** (later): accept the *Paid Apps Agreement*, add a bank account and the tax
  forms (e.g. W-8BEN outside the US), and apply for the **App Store Small Business Program** so Apple takes 15 %
  instead of 30 %.
- **EU trader status** (Digital Services Act): declare whether you're a *trader*. Apps without a declaration
  can't be offered in the EU. Traders have their address, phone number and email shown on the EU App Store page.
  Apple's help counts in-app purchases as a sign of a trade, so with the tips PocketFish most likely is one: declare
  it with the same address as the legal notice on agilewithai.com (already public), a phone number and
  PocketFish@AgileWithAI.com. (Only without the tips would "not a trader" be arguable; ask a tax adviser if unsure.)
- **Legal notice (Impressum):** German law wants it within two taps of a commercial app. The app's About screen,
  the support page and the privacy policy link to agilewithai.com/legal-notice; in App Store Connect, set the
  *Marketing URL* to agilewithai.com too.

## 3. Publish the privacy and support pages

App Store Connect needs public URLs for both.

They come from the public source repository, which the GPL needs anyway (your `PocketFish` repository stays
private: the recognition models and their training are not published).

1. On GitHub: **New repository** → name `PocketFish-source`, **Public**, no README, no licence (it gets
   both from the export) → Create.
2. In `~/work/PocketFish`: `npm run publish-source`. It exports the last commit without `public/models` and
   `ml/`, checks that, and pushes it to `PocketFish-source`. Run it again for every build you upload.
3. In `PocketFish-source` on GitHub: Settings → **Pages** → Source: **GitHub Actions**. Its `pages.yml` then
   publishes just the two pages on every publish.
4. Check that these open:
   - <https://imansoltan.github.io/PocketFish-source/privacy.html>
   - <https://imansoltan.github.io/PocketFish-source/support.html>

## 4. Prepare the Xcode project

On the Mac, in the project folder:

```bash
git pull --no-edit <bundle file or origin> main   # latest code
npm ci
npm run release-check                        # fix every ✗ it reports
npm run build && npx cap sync ios
npx cap open ios
```

In Xcode, select the **App** project → **App** target:

1. **Signing & Capabilities** → *Team*: your paid team (not "Personal Team"); keep *Automatically manage signing*.
   *Bundle Identifier*: the final ID from step 0.
2. **General** → *Supported Destinations*: remove **iPad** (and the "Designed for iPad" Mac / Vision entries).
   iPhone-only keeps version 1.0 simple: no iPad screenshots, no iPad layout review.
3. **General** → *Identity*: *Display Name* (the name under the icon), *Version* `1.0`, *Build* `1`.
   Every upload needs a higher build number; a new release needs a higher version.
4. Commit those changes (`git commit -am "Release settings"`), so `release-check` sees a clean tree.

## 5. Create the app record

App Store Connect → **Apps** → **+** → **New App**:

- Platform **iOS**, the **name**, primary language (e.g. English (U.S.)).
- **Bundle ID**: pick it from the list. If it isn't there, build once in Xcode with your paid team (Xcode
  registers it) or add it at developer.apple.com → *Certificates, IDs & Profiles* → *Identifiers* → **+** →
  *App IDs* → *App* → explicit bundle ID, no extra capabilities.
- **SKU**: any internal code, e.g. `POCKETFISH1`. **User access**: Full access.

Then fill in, using [`listing.md`](listing.md):

- **App Information**: subtitle, categories, content rights, age rating, privacy policy URL.
- **App Privacy**: *Get Started* → "Do you or your third-party partners collect data from this app?" → **No**
  → publish. The label then reads *Data Not Collected*.
- **Pricing and Availability**: *Free*; all countries (or a selection). Under *iPhone and iPad Apps on Apple
  Silicon Macs* you can untick Mac availability if you don't want to test it there.
- **Version 1.0**: screenshots (drag the eight files from `store/screenshots` into the 6.9" slot), promotional
  text, description, keywords, support URL, marketing URL, copyright, and **App Review Information** (your
  contact details, the notes and `store/review-sample.jpg` as attachment). No sign-in is needed.

### German, Spanish and French

The app is in English, German, Spanish and French: it follows the iPhone's language (iPhone Settings → Apps →
PocketFish → Language can pick another one just for the app), and the app's own Settings → Language overrides
both. The App Store page can be in those languages too: each one is a *localization* of the listing, with
its own texts and screenshots.

1. On the **App Information** page, the language menu at the top right shows *English (U.S.)*. Open it and
   pick **German** (in the list of languages not added yet). Fill in name and subtitle from
   [`listing.de.md`](listing.de.md) and the privacy policy URL (the same as in English) → **Save**.
2. On the **version page** pick German in the same menu and fill in promotional text, description,
   keywords and support URL, and drag the files from `store/screenshots/de/` into the 6.9" slot → **Save**.
3. The same for **Spanish (Spain)** and **Spanish (Mexico)** with [`listing.es.md`](listing.es.md) and
   `store/screenshots/es/`, and for **French** and **French (Canada)** with [`listing.fr.md`](listing.fr.md)
   and `store/screenshots/fr/`.

A language without its own screenshots shows the English ones. App Review only reads the review notes, which
stay in English, and the name in every language has to be free on the App Store, like the English one. For
an update, each language gets its own *What's New* text. `npm run release-check` checks the length of every
field in every language.

### Tips (in-app purchases)

Everything in PocketFish is free; the iPhone app takes optional tips under Settings → Help & feedback → Support
PocketFish. They are three *consumable* in-app purchases that unlock nothing. The app shows them with the App
Store's own price in the customer's currency (StoreKit 2, `ios/App/App/StorePlugin.swift`: no third-party SDK, no
server, so the App Privacy answer stays *Data Not Collected*).

1. **Business → Agreements**: accept the *Paid Apps Agreement* and add your bank account and tax forms. Without
   it, App Store Connect doesn't offer paid items, and the tips don't load in the app.
2. Join the **App Store Small Business Program** (developer.apple.com → Programs): Apple then keeps 15 % instead
   of 30 %.
3. Your app → **Monetization → In-App Purchases → +**, type **Consumable**, three times:

   | reference name | product ID | price |
   | --- | --- | --- |
   | Tip small | `com.agilewithai.pocketfish.tip.small` | $1.99 |
   | Tip medium | `com.agilewithai.pocketfish.tip.medium` | $4.99 |
   | Tip large | `com.agilewithai.pocketfish.tip.large` | $9.99 |

   The product IDs must match `TIP_IDS` in `src/app/config.ts` exactly; they can't be changed later. Apple sets
   the prices for other countries from the US price.
4. For each one, under **Localization**, add the display name and description (max 35 and 55 characters):

   | | small | medium | large |
   | --- | --- | --- | --- |
   | English | Small tip · *A small thank-you for PocketFish* | Medium tip · *A thank-you that helps PocketFish grow* | Large tip · *A big thank-you for PocketFish* |
   | German | Kleines Trinkgeld · *Ein kleines Dankeschön für PocketFish* | Mittleres Trinkgeld · *Ein Dankeschön, das PocketFish wachsen lässt* | Großes Trinkgeld · *Ein großes Dankeschön für PocketFish* |
   | Spanish | Propina pequeña · *Un pequeño agradecimiento para PocketFish* | Propina mediana · *Un agradecimiento que ayuda a PocketFish a crecer* | Propina grande · *Un gran agradecimiento para PocketFish* |
   | French | Petit pourboire · *Un petit merci pour PocketFish* | Pourboire moyen · *Un merci qui aide PocketFish à grandir* | Gros pourboire · *Un grand merci pour PocketFish* |

   (The app shows its own names for the tips, in the app's language; these appear on the App Store and in
   Apple's payment sheet.)
5. **Review Information**: a screenshot of the Support PocketFish screen (take it on the iPhone from a TestFlight
   build) and the note *Optional tip; unlocks nothing, every feature is free.*
6. Test in TestFlight: once the three tips are *Ready to Submit*, the TestFlight build shows their prices and the
   payment sheet says *[Sandbox]*; nothing is charged. In the Xcode Simulator or a debug build they only appear
   with the same App Store Connect setup.
7. The first time, add the three tips to the version under **In-App Purchases and Subscriptions** on the version
   page, so they're reviewed together with it.

## 6. Upload a build

In Xcode:

1. Choose **Any iOS Device (arm64)** as the run destination.
2. **Product → Archive**. The Organizer opens when it's done.
3. **Distribute App → App Store Connect → Distribute** (automatic signing). Xcode uploads the build.
4. Wait for the email that the build has finished processing (usually 10–30 minutes).
5. `npm run publish-source`: the GPL asks for the source of every version you distribute (TestFlight testers
   included), so add it to the public repository (step 3).

**Or from the Terminal, in one go:** `npm run testflight` builds the web app, copies it into the iOS project,
runs the release check, archives and uploads, with the same automatic signing and build numbers as the
Organizer. It uses the team chosen in Xcode (or `TEAM_ID=XXXXXXXXXX npm run testflight`, the Team ID is on
developer.apple.com → Account → Membership details) and the Apple account signed in to Xcode → Settings →
Accounts. Without Xcode's account, it can use an App Store Connect API key instead (App Store Connect →
Users and Access → Integrations → App Store Connect API → **+**, role *App Manager*): put the downloaded
`.p8` file somewhere safe outside the repository and run
`ASC_KEY_PATH=~/keys/AuthKey_ABC123.p8 ASC_KEY_ID=ABC123 ASC_ISSUER_ID=<issuer id> npm run testflight`.

## 7. Test it with TestFlight (recommended)

Two ways to have the app on your iPhone, for different jobs:

| | Xcode → Run | TestFlight |
| --- | --- | --- |
| what it installs | a debug build, straight from the Mac (cable or Wi-Fi) | the release build, exactly as the App Store will ship it |
| how long it lasts | about a year with a paid team (7 days with a free one) | 90 days per build; each upload starts again |
| best for | trying a change right away | living with the app for days or weeks, and other testers |
| updates | press Run again | upload a build; the TestFlight app updates it (automatically if you allow it) |

Debug builds start slower while Xcode's debugger is attached (the sluggish first launch). To judge speed
from Xcode, use *Product → Scheme → Edit Scheme → Run*: Build Configuration **Release** and untick *Debug
executable* — or simply use TestFlight.

**Internal testing (you, and anyone on your App Store Connect team, up to 100 people)** — no review:

1. Upload a build (step 6). In the distribution options keep **Manage Version and Build Number** on, so Xcode
   raises the build number for you; every upload needs a new one.
2. App Store Connect → your app → **TestFlight** → *Internal Testing* → **+** → a group (e.g. "Me"), turn on
   *Automatic distribution*, add yourself.
3. On the iPhone: install **TestFlight** from the App Store, open the invitation (email) → *Install*.
   Delete any copy of the app installed from Xcode first, or the two get in each other's way.

**External testing (friends, up to 10,000 people, by email or a public link)**:

1. *TestFlight* → **Test Information**: beta app description, feedback email (PocketFish@AgileWithAI.com),
   a privacy policy URL (it has to be public — see step 3), and the review contact.
2. *External Testing* → **+** → a group → add the build → submit it for **Beta App Review** (usually within a
   day; later builds of the same version are often approved automatically).
3. Invite by email, or turn on the **public link** and share it (on the website, for example).

**While testing**: testers take a screenshot in the app and tap *Share Beta Feedback* — it lands in App Store
Connect → TestFlight → *Feedback*, crashes under *Crashes* and in Xcode → *Organizer*. Go through: scanning
(camera, *Choose from photos*, *Paste*), Analyze, Solve, Play, puzzles, sounds, links, Settings → Privacy
(privacy policy, *Delete all data*), the feedback mail — and once in flight mode.

## 8. Submit for review

On the version page: **Build** → select the build → **Save** → **Add for Review** → **Submit to App Review**.
Review usually takes one or two days. Choose whether the app is released automatically when approved or by you.

Things that commonly get apps rejected, and where PocketFish stands:

| reason | status |
| --- | --- |
| crashes or broken features | test the TestFlight build on a real iPhone |
| placeholder content | none left; `release-check` would fail on a placeholder support address |
| privacy policy not reachable in the app | Settings → Help & feedback → Privacy policy |
| broken support / privacy URLs | publish them first (step 3) |
| unclear permission texts | camera and photo texts are in `ios/App/App/Info.plist`, translated in `ios/App/App/<language>.lproj/InfoPlist.strings` |
| poor iPad layout | iPhone-only (step 4) |
| other apps' names in keywords or description | keywords avoid them; the description only mentions sites the app links to |
| GPL source not available | `npm run publish-source` after each upload puts that version in the public github.com/ImanSoltan/PocketFish-source (About → Source code); About → Licences shows the GPL notice and where Stockfish's source is |
| tips that look like they unlock something | the tip screen says they unlock nothing, and the review note says so too |
| privacy manifest | not needed for the app itself (its own code uses no "required reason" APIs); Capacitor and the plugins bring their own `PrivacyInfo.xcprivacy` |

If it is rejected, the message in App Store Connect says why; fix it, upload a new build if code changed, and
reply or resubmit.

## 9. After the release

- Copy the app's **Apple ID** (App Store Connect → App Information) into `APP_STORE_ID` in `src/app/config.ts`:
  the next version then shows *Rate on the App Store* in Settings.
- Tag the release in git (`git tag v1.0.0 && git push --tags`) so the GPL source of every version is on GitHub.
- Updates: raise the version and build in Xcode, archive, upload, add "What's New" text, submit.
- Read and answer reviews in App Store Connect; crash reports appear in Xcode → *Organizer*.

## Price

Free, with optional tips (above, *Tips*): every feature stays free and a tip unlocks nothing. A paid "Pro" was
considered and left out for now: most training features (puzzles, play against the engine) are free in other apps
such as lichess, so a paywall on them would cost more downloads and goodwill than it earns. A one-time Pro purchase
can come later with features only PocketFish has, such as importing a whole book page or a PDF, or collections per
book with PGN export (it then also needs *Restore purchases*). A subscription only makes sense with ongoing costs,
and PocketFish has no servers.
