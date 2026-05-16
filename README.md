# Pokemon 5e Roll20 Extension

If you enjoy the extension and want to support its development:

<a href='https://ko-fi.com/N4N71Z6D5V' target='_blank'><img height='36' style='border:0px;height:36px;' src='https://storage.ko-fi.com/cdn/kofi6.png?v=6' border='0' alt='Buy Me a Coffee at ko-fi.com' /></a>

[Chrome WebStore - Poke5eRoll20](https://chromewebstore.google.com/detail/alellhfnhemmnlbdaaafegkgohkiioik?utm_source=item-share-cb)
<br/>
[Firefox Add-ons - pokemon-5e-roll20](https://addons.mozilla.org/pt-BR/firefox/addon/pokemon-5e-roll20/)

A Web Browser Extension (Manifest V3) that integrates [Pokemon 5e](https://poke5e.app/) character sheets with [Roll20](https://roll20.net/), enabling one-click dice rolling directly from abilities, saves, skills, and attacks.

No more copy-pasting formulas. Click a stat or move on your Pokemon sheet and the dice command appears in Roll20 chat instantly.

## Features

### Version 1.3

**Rolls**
- **Ability Checks** — Click ability scores to roll `1d20+modifier` (e.g. `Scyther | STR check`)
- **Saving Throws** — Click saves to roll `1d20+save` (e.g. `Scyther | STR save`)
- **Skill Checks** — Click skills to roll `1d20+bonus` (e.g. `Scyther | Acrobatics`)
- **Attack Rolls** — Click a move name to send a Roll20 card with Attack and Damage inline rolls:
  - Attack field: `[[1d20+7]]`, Damage field: `[[1d6]]`
  - Card header: `Scyther | Quick Attack`
- **Save DC Moves** — Click save-based moves to display a formatted card with DC and damage
- **Info-only Moves** — Moves without a to-hit or DC display a summary card

**Critical Hits**
- On a natural 20, damage dice are doubled automatically (e.g. `2d6+4` → `4d6+4`)
- Detection uses Roll20's `.critsuccess` class via MutationObserver — no timing hacks

**Advantage / Disadvantage**
- Hold **Shift** before clicking → rolls `2d20kh1` (keep highest), label shows `ADV`
- Hold **Ctrl** before clicking → rolls `2d20kl1` (keep lowest), label shows `DIS`
- The dice icon changes to green (Shift) or red (Ctrl) to indicate the current mode

**Visual Feedback on poke5e.app**
- A floating dice icon appears next to any rollable element on hover
- The icon is positioned via JavaScript and rendered above all site UI (uses `position: fixed` on `<body>`, so `overflow: hidden` on site elements cannot clip it)
- Temporary toast notifications confirm each roll or report errors

**Roll Formatting on Roll20**
- All rolls use Roll20's `&{template:default}` card format — results appear as a styled panel with a header and labelled fields, not as plain text
- The card header always shows `Character | Move/Stat` (e.g. `Marowak | Bone Club`)
- Attack cards include inline **Attack** and **Damage** fields side by side
- Save DC cards include the **DC** and optional **Damage** inline roll
- Info cards show **Type**, **Time**, **Range**, **Duration**, and **Effect** fields
- Ability/save/skill rolls display the dice result directly in the card field

**SPA Navigation**
- Automatically reinjects click handlers when you switch Pokémon on poke5e.app (no page reload needed)

**Firefox Support**
- Fully compatible with Firefox (Manifest V3)
- The background service worker routes messages between poke5e.app and Roll20 content scripts; it performs no DOM access and responds quickly, minimising exposure to MV3 service worker lifecycle issues

**Other Bonus (Popup Settings)**
- **Attack Bonus** — a flat bonus added to every attack to-hit roll (e.g. a `+2` item bonus)
- **Save DC Bonus** — a flat bonus added to every save DC value before the card is sent
- Both values are set in the extension popup and persist across sessions via `chrome.storage.sync`

**Planned Features**
- Spell save DC calculations
- Critical hit highlighting

## Installation

### From Source (Development)

1. Clone the repository:
   ```bash
   git clone https://github.com/nx23/pkm5e-extension.git
   cd pkm5e-extension
   ```

2. Open Chrome and go to `chrome://extensions/`

3. Enable **Developer mode** (top-right toggle)

4. Click **Load unpacked** and select the `pkm5e-extension` folder

5. Visit `https://poke5e.app/` — you should see a "Pokemon 5e Roll20 Extension Active" notification


## Quick Start

1. Open both tabs:
   - `https://poke5e.app/` — your character sheet
   - `https://roll20.net/` — your campaign

2. Click the extension icon in the toolbar and confirm **Roll20 Tab: Connected**

3. On your Pokemon sheet, hover over any ability, save, skill, or move name — a dice icon appears to the left

4. Click to inject the roll formula into Roll20 chat

## Usage

### Ability Checks, Saves, and Skills

Hover over any rollable element and click. A Roll20 card appears in chat with the result.

| Roll type | Card header | Card field |
|---|---|---|
| Ability check | `Scyther \| STR check` | `STR check = [[1d20+4]]` |
| Saving throw | `Scyther \| STR save` | `STR save = [[1d20+5]]` |
| Skill check | `Scyther \| Acrobatics` | `Acrobatics = [[1d20+7]]` |

### Attacks

Click a move name to send a single Roll20 card with all fields at once.

**Attack move** (`Scyther | Bone Club`):

| Field | Value |
|---|---|
| Attack | `[[1d20+8]]` |
| Damage (2d8+5) | `[[2d8+5]]` |
| Type | Normal |
| Range | Melee |
| Effect | *move description…* |

**Save DC move** (`Marowak | Flame Wheel`):

| Field | Value |
|---|---|
| DEX Save DC | 16 |
| Damage (2d8+8) | `[[2d8+8]]` |

**Info-only move** (no attack or DC): sends a card with Type, Time, Range, Duration, and Effect only.

If a natural 20 is rolled in the Attack field, a follow-up **Crit Bonus** card with doubled damage dice is sent automatically.

### Other Bonus

Open the extension popup to set flat bonuses that are applied automatically on every roll:

| Field | Applies to |
|---|---|
| **Attack Bonus** | Added to the to-hit modifier on every attack move roll |
| **Save DC Bonus** | Added to the DC value on every save DC move card |

Example: with Attack Bonus `+2`, a move with `toHit=7` sends `1d20+9` in the Attack field. Values persist via `chrome.storage.sync` and survive browser restarts.

### Advantage and Disadvantage

Hold the modifier key **before** clicking:

| Key | Effect | Dice |
|---|---|---|
| Shift | Advantage | `2d20kh1` |
| Ctrl | Disadvantage | `2d20kl1` |
| *(none)* | Normal | `1d20` |

The card header will include `ADV` or `DIS` after the character name, e.g.:  
`Scyther ADV | Quick Attack` — Attack field: `[[2d20kh1+7]]`

## Troubleshooting

**Clickable elements aren't appearing**
- Refresh the poke5e.app tab after loading the extension
- Make sure you are on a character sheet, not just a Pokédex page

**Roll20 chat doesn't receive the roll**
- Refresh the Roll20 tab and wait for the campaign to fully load
- Check the extension popup — if Roll20 shows as disconnected, reload the Roll20 tab

**Handlers disappear after switching Pokémon**
- This should not happen — the extension watches for SPA navigation and reinjects automatically
- If it does, refresh the poke5e.app tab

### Logs

Both content scripts log to the browser console prefixed with `[PKM5e Roll20 Extension]`:

```
[PKM5e Roll20 Extension] Content script loaded on poke5e.app
[PKM5e Roll20 Extension] Injected 18 ability handlers
[PKM5e Roll20 Extension] Injected 6 save handlers
[PKM5e Roll20 Extension] Injected 15 skill handlers
[PKM5e Roll20 Extension] ✓ Attack handler injected: Bubble (toHit=5, damage=2d6+4)
```

Open DevTools (F12) on poke5e.app or roll20.net to see them.

## Project Structure

```
pkm5e-extension/
├── manifest.json              # Extension manifest (Manifest V3)
├── background.js              # Service worker — keepalive, settings storage (rolls bypass it)
├── README.md                  # This file
│
├── content-scripts/
│   ├── poke5e.js             # Runs on poke5e.app — dice icon, roll dispatch
│   └── roll20.js             # Runs on roll20.net — formula injection, formatting
│
├── utils/
│   ├── logger.js             # Shared logging utility
│   ├── dataParser.js         # Extracts ability scores, saves, skills, moves
│   ├── clickInjector.js      # Injects click handlers on rollable elements
│   └── storage.js            # Settings persistence (chrome.storage)
│
├── popup/
│   ├── popup.html            # Extension popup UI
│   ├── popup.js              # Popup logic (connection status)
│   └── popup.css             # Popup styles
│
├── styles/
│   └── poke5e-overlay.css    # Styles injected into poke5e.app
│
└── assets/
    ├── d20.png               # Default dice icon
    ├── d20-adv.png           # Dice icon when Shift is held (advantage)
    ├── d20-dadv.png          # Dice icon when Ctrl is held (disadvantage)
    └── icon-16.png           # Extension toolbar icon
```

## Architecture

```
User clicks rollable element on poke5e.app
    ↓
clickInjector.js reads modifier keys (Shift/Ctrl) and fetches bonuses from background
    ↓
Sends ROLL_REQUEST or ATTACK_REQUEST to background.js via chrome.runtime.sendMessage
    ↓
background.js finds the Roll20 tab and forwards via chrome.tabs.sendMessage
    ↓
roll20.js injects &{template:default} card into Roll20 chat
    ↓
For attack cards: MutationObserver watches for natural 20, sends Crit Bonus card
    ↓
User sees formatted card in Roll20 chat
```

> **Note:** The background service worker acts as a **message router** between the poke5e.app and Roll20 content scripts. It has no DOM access — it only looks up the Roll20 tab ID and forwards the request via `chrome.tabs.sendMessage`. It also handles `GET_BONUSES` (reads `chrome.storage.sync`) and the `alarms` keepalive.

### Message Flow

**Standard Roll (Ability/Save/Skill):**

```javascript
// 1. clickInjector.js → background.js
chrome.runtime.sendMessage({
  type: 'ROLL_REQUEST',
  data: {
    rollType: 'check' | 'save' | 'skill',
    stat: 'STR' | 'Acrobatics' | ...,
    modifier: 5,
    totalModifier: 5,        // modifier + attackBonus/saveDcBonus from popup
    label: 'STR check',
    characterName: { character: 'Scyther' },
    advantage: false,
    disadvantage: false
  }
})

// 2. background.js → roll20.js  (chrome.tabs.sendMessage)
{ type: 'EXECUTE_ROLL', data: rollData }

// 3. roll20.js injects card into chat:
&{template:default} {{name=Scyther | STR check}} {{STR check=[[1d20+5]]}}
```

**Attack Roll:**

```javascript
// 1. clickInjector.js → background.js
chrome.runtime.sendMessage({
  type: 'ATTACK_REQUEST',
  data: {
    moveName: 'Quick Attack',
    toHit: 7,                // already includes attackBonus from popup
    damageDice: '1d6',
    isSaveMove: false,
    moveType: 'Normal',
    moveRange: 'Melee',
    characterName: { character: 'Scyther' }
  }
})

// 2. background.js → roll20.js  (chrome.tabs.sendMessage)
{ type: 'EXECUTE_ATTACK', data: attackData }

// 3. roll20.js injects a single card:
&{template:default} {{name=Scyther | Quick Attack}} {{Attack=[[1d20+7]]}} {{Damage (1d6)=[[1d6]]}} {{Type=Normal}} {{Range=Melee}}
```

## Technical Details

### DOM Structure Detection

The extension uses **CSS selectors** to identify and interact with poke5e.app elements:

| Element | Selector | Example HTML |
|---------|----------|---------------|
| Ability Scores | `dl dt:has(abbr)` | `<dt><abbr>STR</abbr></dt><dd>18 (+4)</dd>` |
| Saving Throws | `div.upper dl dt` | `<div class="upper"><dl><dt>STR</dt><dd>+7</dd>` |
| Skills | `div.cap dl dt` | `<div class="cap"><dl><dt>Acrobatics</dt><dd>+7</dd>` |
| Moves (Attack) | `dl.move-stats-info` | `<dl class="move-stats-info"><dt>Attack</dt><dd>+7</dd>` |
| Move Name | `.flex-span.bold a` | `<span class="flex-span bold"><a>Quick Attack</a>` |

### Message Routing

1. **poke5e.js / clickInjector.js** — Content scripts on poke5e.app
   - Injects handlers via ClickInjector
   - Watches for SPA navigation (URL polling every 500ms)
   - Auto-reinjects handlers on Pokémon switch
   - Sends `ROLL_REQUEST` or `ATTACK_REQUEST` via `chrome.runtime.sendMessage` on click

2. **background.js** — Service worker (Manifest V3)
   - **Message router** — receives from poke5e.app content script, finds the Roll20 tab, and forwards via `chrome.tabs.sendMessage`
   - Handles `GET_BONUSES` (reads `attackBonus` / `saveDcBonus` from `chrome.storage.sync`)
   - Handles `alarms` keepalive

3. **roll20.js** — Content script on roll20.net
   - Listens for `EXECUTE_ROLL` and `EXECUTE_ATTACK` via `chrome.runtime.onMessage`
   - Injects `&{template:default}` cards into Roll20 chat
   - Uses MutationObserver to detect natural 20 and send a follow-up Crit Bonus card

### Critical Hit Detection

After injecting an attack card, `watchForCritBonus` sets up a MutationObserver:

1. Waits for the Roll20 template card to appear in the DOM (up to 5 s timeout)
2. Checks if the first `tbody` row's inline-roll result has the `.fullcrit` class (natural 20)
3. If so, sends a follow-up `&{template:default}` card with doubled damage dice:  
   `{{name=Scyther | Quick Attack}} {{Crit Bonus (1d6)=[[1d6]]}}`
4. The observer disconnects after the first card is processed (or on timeout)

### SPA Navigation Detection

The extension uses **URL polling** to detect SPA navigation:
- Checks `location.href` every 500ms
- When URL changes, waits 800ms for SvelteKit to render
- Calls `attemptInitialization()` with retry logic (up to 10 attempts, 1s delays)
- Automatically re-injects all handlers on new page

This approach works reliably because content scripts run in an isolated world and can't intercept `history.pushState` calls.

## API Reference

### DataParser (utils/dataParser.js)

**Sheet Data Extraction**
```javascript
DataParser.getCompleteSheetData()       // Get all parsed data: {abilities, saves, skills, hp, characterName}
DataParser.parseAbilityScores()         // Get STR, DEX, CON, INT, WIS, CHA with scores and modifiers
DataParser.parseSaves()                 // Get save bonuses for all abilities
DataParser.parseSkills()                // Get skill bonuses
DataParser.getCharacterName()           // Get character/Pokemon name from sheet
DataParser.getHitPoints()               // Get current/max HP
DataParser.debugPageStructure()         // Get indicator flags: hasAbilityScores, hasSavesSection, hasSkillsSection
```

### ClickInjector (utils/clickInjector.js)

**Handler Injection**
```javascript
ClickInjector.injectAllHandlers()       // Set up all click handlers (abilities, saves, skills, attacks)
ClickInjector.reinjectHandlers()        // Reinject handlers (called after DOM changes, SPA nav)
ClickInjector.sendRollRequest(context)  // Send ROLL_REQUEST to background worker
ClickInjector.showNotification(msg, type) // Display notification ('info', 'success', 'error')
```

**Context object for sendRollRequest:**
```javascript
{
  rollType: 'check' | 'save' | 'skill',  // Type of roll
  stat: 'STR' | 'Acrobatics' | ...,     // Ability or skill name
  modifier: 5,                            // Roll modifier
  characterName: { character: 'Name' }   // Character context (optional)
}
```

### StorageManager (utils/storage.js)

**Settings & History**
```javascript
StorageManager.getSetting(key, defaultValue)  // Get a setting from Chrome storage
StorageManager.setSetting(key, value)         // Save a setting
StorageManager.getAllSettings()               // Get all settings object
```

### Roll20Integration (content-scripts/roll20.js)

**Roll Injection**
```javascript
Roll20Integration.setupMessageListener()      // Register chrome.runtime.onMessage listener
Roll20Integration.injectRollIntoChat(config)  // Build and send &{template:default} card (ability/save/skill)
Roll20Integration.findChatInput()             // Get Roll20 chat input element
Roll20Integration.showNotification(msg, type) // Display Roll20 notification
```

### CSS Classes

**poke5e-rollable**
- Applied to clickable elements (abilities, saves, skills, attacks)
- Triggers hover effects and cursor change

**poke5e-hover**
- Applied during hover state
- Shows dice emoji and highlight effect
- Background image: `assets/d20.png`

## Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Test thoroughly
5. Commit: `git commit -m 'Add amazing feature'`
6. Push: `git push origin feature/amazing-feature`
7. Open a Pull Request

## License

This extension is released under the **MIT License**, which allows you to freely use, modify, and distribute the code with proper attribution.

## Support & Feedback

- 🐛 **Report Bugs**: [GitHub Issues](https://github.com/nx23/pkm5e-extension/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/nx23/pkm5e-extension/discussions)
- 📧 **Email**: gbotareli@gmail.com

## Changelog

### Version 1.3 (Current)
- ✨ **Roll20 card layout** — All rolls (ability checks, saves, skills, attacks, save DCs) now use Roll20's `&{template:default}` card format, displaying a header with the character and move name and labelled inline-roll fields
- ✨ **Attack cards** — Single card with Attack and Damage inline rolls, plus Type/Range/Effect metadata
- ✨ **Save DC cards** — Card showing the save type, DC value, and optional inline damage roll
- ✨ **Info-only moves** — Card with move metadata (Type, Time, Range, Duration, Effect) for moves with no roll
- ✨ **Firefox support** — Fully compatible with Firefox Manifest V3; background service worker acts as a lightweight message router with no DOM access
- 🔒 **Security hardening** — All character and move names embedded in Roll20 template strings are sanitised, preventing Roll20 template injection via crafted sheet data
- 🐛 Fixed popup status always showing "Not Found" — now queries tabs directly without a background round-trip
- 🐛 Fixed rolls silently failing in Firefox due to service worker being suspended before responding
- 🐛 Fixed `http://` host entries in manifest (HTTPS only)

### Version 1.2
- ✨ **Critical Hits** — Natural 20 doubles damage dice automatically (e.g. `2d6+4` → `4d6+4`)
- ✨ **Advantage / Disadvantage** — Hold Shift or Ctrl before clicking to roll `2d20kh1` / `2d20kl1`
- ✨ **ADV / DIS label** — Roll label in Roll20 chat reflects the modifier (e.g. `ADV Quick Attack | Attack`)
- 🎨 **Dice icon states** — Icon changes to green (advantage) or red (disadvantage) while key is held
- 🐛 Fixed dice icon being clipped by `overflow: hidden` on poke5e.app — now uses a body-level `position: fixed` element

### Version 1.1
- ✨ **Attack Rolls** — Click move names to roll hit and damage
- ✨ Damage dice displayed in roll label (e.g., "Damage (1d6)")
- 🐛 Fixed STAB alert icon appearing in damage formulas
- 🐛 Fixed handler injection not rerunning on Pokemon switch (SPA navigation)
- 🐛 Fixed roll formatting broken after attack feature implementation
- 🎨 Improved observer detection with universal " | " separator pattern

### Version 1.0 (Initial Release)
- ✨ Basic ability checks
- ✨ Saving throw rolling
- ✨ Skill check rolling
- ✨ Roll20 chat integration
- ✨ Popup UI with settings
- ✨ Roll history tracking


## Acknowledgments

Special thanks to:

- **[Auroratide](https://github.com/Auroratide)** — Created the amazing [Pokemon 5e](https://poke5e.app/)
- **[Roll20](https://roll20.net/)** — Excellent platform for TTRPG campaigns
- **[irfansusanto20](https://www.flaticon.com/authors/irfansusanto20)** — D20 icon design
- **[Freepik](https://www.flaticon.com/authors/freepik)** — Additional icon assets

---

**Made with ❤️ for Pokemon 5e**
