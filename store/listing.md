# App Store listing

Texts to paste into App Store Connect. Character limits are Apple's; the counts below are for
the English texts.

Two threads run through the listing: PocketFish is the companion for every chess book (scan a diagram, ask
Stockfish, check your answer, play on), and it is private: most scanner apps send your photo to a server,
PocketFish reads it on the phone. The App Store shows the *Data Not Collected* label next to it.

## App name (max 30)

`PocketFish: Chess Scanner` (25). Under the icon the phone shows just *PocketFish* (the display name in
`ios/App/App/Info.plist`).

## Subtitle (max 30)

`Companion for every chess book` (30) — or, leading with privacy, `Private, offline chess scanner` (30).

## Promotional text (max 170, can be changed any time without review)

The companion for every chess book: scan a diagram, ask Stockfish, check your answer or play the position on. All on your iPhone: no account, no ads, no internet. (162)

## Description (max 4000)

The companion for every chess book. Point your camera at a diagram in a book, a magazine or on a screen, or pick a screenshot: PocketFish recognises the board and every piece right on your iPhone and opens the position on an interactive board, ready to analyse, to solve or to play on. Nothing is uploaded, and it works without an internet connection.

MADE FOR YOUR CHESS BOOKS
• Check your answer to a puzzle in the book before you turn to the solutions
• Ask Stockfish about the move the author doesn’t explain
• Play a position on from the page against the engine
• Reads printed diagrams old and new, even engraved ones from a century ago

PRIVATE BY DESIGN
• Board recognition and the Stockfish engine run entirely on your iPhone
• Works offline, even in flight mode
• Photos are never uploaded and never saved to your photo library; PocketFish doesn't even ask for access to it
• No account, no ads, no analytics, no tracking
• Turn off recent scans, or delete everything PocketFish stored with one tap

ANALYZE
• Stockfish, one of the strongest chess engines, runs right on your phone
• Evaluation, depth and up to five best lines, with arrows for the top moves
• Play moves, go back and forth, flip the board, see opening names
• Copy the position as FEN or open it on lichess.org or chess.com

SOLVE
• Hide the engine and find the best move yourself — perfect for puzzle books
• Every move gets a verdict: best, good, inaccuracy, mistake or blunder
• Ask for a hint, see the solution, or keep going while the engine replies
• Keep a streak and count how many positions you solved at the first try

PUZZLES
• Thousands of rated puzzles on your phone, from the lichess.org puzzle database — no internet needed
• Your puzzle rating rises and falls with every puzzle, so they stay just hard enough
• Practise one theme: mates in 1, 2 or 3, forks, pins, sacrifices, endgames and more
• A new puzzle of the day, and your weakest themes at a glance

PLAY
• Play any position out against Stockfish — a scanned diagram, a puzzle or the starting position
• Eight levels, from beginner to full strength
• Take back, switch sides, then go through the game with the engine

SMART SCANNING
• Finds the board automatically, even in tilted photos; adjust the corners with a magnifier if needed
• Works with printed book diagrams (also old engraved ones), magazines and screenshots — take a photo, pick one, or paste a copied screenshot
• Knows whose move it is when a king is in check, detects diagrams printed from Black's side and suggests castling rights
• Fix anything that was misread in a tap

MAKE IT YOURS
• Six piece sets, nine board colours and five colour schemes, including dark mode
• Move sounds and haptics

Everything in PocketFish is free. If you like it, you can leave an optional tip in Settings.

In English, German, Spanish and French.

PocketFish's source code is free software under the GNU GPL v3 and on GitHub, so anyone can check what the app does; the trained recognition models are not part of it. Chess engine: Stockfish (GPLv3) by the Stockfish developers. PocketFish is an independent app, not affiliated with or endorsed by the Stockfish project.

Requires iOS 16.4 or later.

## Keywords (max 100, comma-separated, no spaces; words in the name and subtitle count already)

`scanner,stockfish,puzzle,analysis,board,diagram,fen,camera,engine,tactics,offline,private,photo` (95)

Don't use other apps' names or trademarks (lichess, chess.com, ChessExpert…) as keywords — App Review rejects that.
If the subtitle already says *private* and *offline*, use the free space for `training,position` instead.

## What's new (version 1.0)

First release.

## URLs

- Support URL: `https://imansoltan.github.io/PocketFish-source/support.html`
- Privacy policy URL: `https://imansoltan.github.io/PocketFish-source/privacy.html`
- Marketing URL: https://agilewithai.com (later the PocketFish page there); it also leads to the legal notice

Both pages are in `public/` and go live when GitHub Pages is enabled (see `store/README.md`).

## Other fields

- **Copyright:** `2026 Iman Soltanzadeh`
- **Primary category:** Games → Board · **Secondary:** Education
- **Age rating:** answer *None* / *No* to everything → 4+. *Unrestricted web access*: No (the app only opens a few specific links: lichess.org, chess.com, GitHub).
- **Content rights:** the app contains third-party content (Stockfish, piece sets, opening names, the lichess puzzles) under open licences — answer that you have the rights to use it.
- **App Privacy:** *Data Not Collected* (nothing leaves the device; feedback is sent by the user from their own mail app).
- **Encryption:** already declared in Info.plist (`ITSAppUsesNonExemptEncryption = NO`), so no question on upload.

## App Review information

Notes:

> PocketFish needs no account and makes no network connections of its own (only the optional tips go through StoreKit): recognition, the chess engine and the puzzles are on the device, so it also works in flight mode. To try scanning, tap the camera button and photograph the chess diagram in the attached image (shown on another screen), or save the image to Photos and choose "Choose from photos". After the scan, tap Analyze to see Stockfish's analysis, or Solve to find the best move yourself; the Play tab plays the position out against the engine. The in-app purchases are optional tips (Settings → Help & feedback → Support PocketFish): consumables that unlock nothing, as every feature is free. The puzzle button at the bottom right opens rated puzzles; the gear at the top right opens Settings. lichess.org / chess.com only open when the user taps those links. Source code: https://github.com/ImanSoltan/PocketFish-source (GPLv3; the trained recognition models are not included).

Attachment: `store/review-sample.jpg`.

## Screenshots

`store/screenshots/0-book.jpg` … `8-themes.jpg` (nine): 1320 × 2868 px, the 6.9-inch iPhone size (App Store
Connect scales them down for smaller iPhones). Regenerate after UI or name changes:
`npm run build && node scripts/store-screenshots.mjs` (or `… de`, `es`, `fr`, `all` for the other languages,
in `store/screenshots/<language>/`; their texts are in `listing.de.md`, `listing.es.md`, `listing.fr.md`).

| file | caption |
| --- | --- |
| `0-book` | The companion for every chess book — scan a diagram, ask Stockfish, play on |
| `1-scan` | Straight from the page — books, magazines or screenshots |
| `2-review` | Every piece, recognised — check it and fix anything in a tap |
| `3-analyze` | What the book doesn’t explain — Stockfish shows the best moves and lines |
| `4-solve` | Solve the book’s puzzles — every answer graded, hints when you need them |
| `5-puzzles` | Rated puzzles, offline — thousands of tactics and a daily puzzle |
| `6-play` | Play on from the page — against Stockfish, from beginner to full strength |
| `7-private` | Private by design — no account, no tracking, works offline |
| `8-themes` | Make it yours — 6 piece sets, 5 colour schemes, dark mode |

## Name

**PocketFish** — Stockfish in your pocket, working offline. A web search in October 2026 found no app or
brand with this name. Names must be unique on the App Store, so App Store Connect has the final word when
you create the app record; a search in a trademark database (e.g. the EUIPO's or USPTO's) is worth it too.

The ideas that were considered:

| name | why | already out there |
| --- | --- | --- |
| **PocketFish** ✓ chosen | Stockfish in your pocket — fits "offline" perfectly; chess players call engines "the fish" | nothing found |
| **Bookfish** | book + Stockfish, like *bookworm*: made for chess books | nothing found |
| **FishEye** | the camera's fisheye lens + Stockfish's eye on the position | no chess app; fisheye camera apps exist |
| **Inkfish** | reads printed ink diagrams + Stockfish (and an inkfish is a cuttlefish) | an iPad drawing game "Inkfish" |
| **ScanMate** | scan + checkmate: says what it does | several "ScanMate" document / QR scanners ✗ |
| **Knight Vision** | "night vision" pun | "KnightVision – Chess" (Stockfish + board scanning) ✗ |
| **ChessLens** | a lens for chess | the "Chess Lens" web app and "KnightLens: Chess Analysis" ✗ |
| **Chessy** | the working name: friendly, but generic | likely used elsewhere |

Taglines: *"Stockfish in your pocket. No internet, no tracking."* · *"Your photos never leave your
phone."* · *"Works in flight mode."* Avoid "Stockfish" itself in the name (it's the engine's name, and
"Stockfish Chess" already exists).
