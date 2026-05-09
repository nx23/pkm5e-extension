# Pokemon 5e Roll20 Extension

If you enjoy the extension and want to support its development:

<a href='https://ko-fi.com/N4N71Z6D5V' target='_blank'><img height='36' style='border:0px;height:36px;' src='https://storage.ko-fi.com/cdn/kofi6.png?v=6' border='0' alt='Buy Me a Coffee at ko-fi.com' /></a>

[Chrome WebStore - Poke5eRoll20](https://chromewebstore.google.com/detail/alellhfnhemmnlbdaaafegkgohkiioik?utm_source=item-share-cb)

A Web Browser Extension (Manifest V3) that integrates [Pokemon 5e](https://poke5e.app/) character sheets with [Roll20](https://roll20.net/), enabling one-click dice rolling directly from abilities, saves, skills, and attacks.

No more copy-pasting formulas. Click a stat or move on your Pokemon sheet and the dice command appears in Roll20 chat instantly.

## Features

### Version 1.2

**Rolls**
- **Ability Checks** — Click ability scores to roll `1d20+modifier` (e.g. `Scyther | STR check`)
- **Saving Throws** — Click saves to roll `1d20+save` (e.g. `Scyther | STR save`)
- **Skill Checks** — Click skills to roll `1d20+bonus` (e.g. `Scyther | Acrobatics`)
- **Attack Rolls** — Click a move name to roll hit and damage automatically:
  - Hit: `1d20+7 [Scyther | Quick Attack | Attack]`
  - Damage: `1d6 [Scyther | Quick Attack | Damage (1d6)]`
  - STAB alert icons are stripped from damage dice automatically

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
- Extension rolls are styled with a distinct visual theme injected into Roll20's chat
- Character name and roll label are extracted from the formula and displayed as a header
- Critical successes and critical failures receive color highlights

**SPA Navigation**
- Automatically reinjects click handlers when you switch Pokémon on poke5e.app (no page reload needed)

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

Hover over any rollable element and click. The formula is sent directly to Roll20 chat.

| Roll type | Example formula |
|---|---|
| Ability check | `1d20+4 [Scyther \| STR check]` |
| Saving throw | `1d20+5 [Scyther \| STR save]` |
| Skill check | `1d20+7 [Scyther \| Acrobatics]` |

### Attacks

Click a move name to trigger two automatic rolls: hit, then damage.

```
1d20+7 [Scyther | Quick Attack | Attack]
1d6+2  [Scyther | Quick Attack | Damage (1d6+2)]
```

The damage roll waits for Roll20 to render the attack message before firing — critical detection then doubles the damage dice if a natural 20 is found.

### Advantage and Disadvantage

Hold the modifier key **before** clicking:

| Key | Effect | Dice |
|---|---|---|
| Shift | Advantage | `2d20kh1` |
| Ctrl | Disadvantage | `2d20kl1` |
| *(none)* | Normal | `1d20` |

The label in Roll20 chat will include `ADV` or `DIS` after the character name, e.g.:  
`1d20+7 [Scyther | ADV Quick Attack | Attack]`

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
├── background.js              # Service worker — routes messages between tabs
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
clickInjector.js reads modifier keys (Shift/Ctrl) and builds roll context
    ↓
Sends ROLL_REQUEST or ATTACK_REQUEST to background.js
    ↓
background.js finds the active Roll20 tab, forwards as EXECUTE_ROLL / EXECUTE_ATTACK
    ↓
roll20.js injects /roll command into Roll20 chat input and fires send
    ↓
Roll20.js injects /roll formula into chat input
    ↓
MarkExtensionRoll() applies poke5e-roll CSS class
    ↓
Observer pattern catches missed rolls and applies styling
    ↓
User sees formatted dice formula in chat (can press Enter to send)
```

### Message Flow

**Standard Roll (Ability/Save/Skill):**

```javascript
// poke5e.js sends ROLL_REQUEST:
{
  type: 'ROLL_REQUEST',
  data: {
    rollType: 'check' | 'save' | 'skill',
    stat: 'STR' | 'Acrobatics' | etc,
    modifier: 5,
    label: 'STR check',
    characterName: { character: 'Scyther' }
  }
}

// roll20.js receives via background.js and injects:
/roll 1d20+5 [Scyther | STR check]
```

**Attack Roll:**

```javascript
// poke5e.js sends ATTACK_REQUEST:
{
  type: 'ATTACK_REQUEST',
  data: {
    moveName: 'Quick Attack',
    toHit: 7,
    damageDice: '1d6',
    characterName: { character: 'Scyther' }
  }
}

// roll20.js injects two rolls:
/roll 1d20+7 [Scyther | Quick Attack | Attack]      // Hit roll
/roll 1d6 [Scyther | Quick Attack | Damage (1d6)]   // Damage (400ms delay)
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

1. **poke5e.js** — Content script listening on poke5e.app
   - Injects handlers via ClickInjector
   - Watches for SPA navigation (URL polling every 500ms)
   - Auto-reinjects handlers on Pokemon switch

2. **background.js** — Service worker (Manifest V3)
   - Routes ROLL_REQUEST and ATTACK_REQUEST messages
   - Maintains list of active tabs
   - Finds and forwards messages to Roll20 tab

3. **roll20.js** — Content script listening on roll20.net
   - Receives roll commands from background.js
   - Injects formulas into Roll20 chat input
   - Applies CSS styling with observer pattern

### Roll Styling

The extension applies the `poke5e-roll` CSS class through two mechanisms:

1. **Immediate marking** (0/50/200ms delays)
   - `markExtensionRoll()` finds the last `.message.rollresult` and marks it
   - Used for standard rolls and attack hit rolls

2. **Observer pattern** (fallback)
   - MutationObserver watches for new messages in `#chat`
   - Detects rolls by checking formula text for " | " separator or poke5e keywords
   - Applies styling to any missed rolls

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
Roll20Integration.injectRollIntoChat(config)  // Inject formula and apply styling
Roll20Integration.generateDiceFormula(config) // Generate /roll command
Roll20Integration.markExtensionRoll()         // Apply poke5e-roll class to last message
Roll20Integration.findChatInput()             // Get Roll20 chat input element
Roll20Integration.showNotification(msg, type) // Display Roll20 notification
```

### CSS Classes

**poke5e-rollable**
- Applied to clickable elements (abilities, saves, skills, attacks)
- Triggers hover effects and cursor change

**poke5e-roll**
- Applied to roll result messages in Roll20 chat
- Styled in [styles/poke5e-overlay.css](styles/poke5e-overlay.css)
- Used to distinguish extension rolls from regular chat messages

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

### Version 1.2 (Current)
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
