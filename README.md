# Pokemon 5e Roll20 Extension

A Chrome Extension that seamlessly integrates [Pokemon 5e](https://poke5e.app/) character sheets with [Roll20](https://roll20.net/), enabling **one-click dice rolling directly from your character abilities, saves, skills, and attacks**.

**No more copy-pasting formulas!** Click an ability save, attack, or skill on your Pokemon 5e sheet and watch the dice formula instantly appear in Roll20 chat.

> **Current Version: 1.1** — Now with attack rolls and automatic handler reinjection on Pokemon switch!

## Features

✨ **Current Version (1.1)**

**Core Functionality**
- 🎲 **Ability Checks** — Click ability scores to roll d20+modifier (e.g., "Scyther | STR check")
- 💾 **Saving Throws** — Click ability saves to roll d20+save modifier (e.g., "Scyther | STR save")
- 🎯 **Skill Checks** — Click skills to roll d20+bonus (e.g., "Scyther | Acrobatics")
- ⚔️ **Attack Rolls** — Click move names to roll d20+toHit (hit) and damage dice (e.g., "Quick Attack | Damage (1d6)")
  - Automatically shows damage dice used in the label
  - Handles STAB indicators correctly
- 🎨 **Automatic Formatting** — Rolls styled with `poke5e-roll` CSS class for visual distinction
- 🔄 **SPA Navigation** — Automatically reinjects handlers when switching Pokémon on poke5e.app

**Platform Integration**
- Automatic dice injection into Roll20 chat
- Real-time connection status checking

🚀 **Planned Features**
- Advantage/disadvantage toggling
- Spell save DC calculations
- Custom hotkeys
- Sound notifications
- Critical hit highlighting

## Installation

### From Source (Development)

1. **Clone the repository**
   ```bash
   git clone https://github.com/nx23/pkm5e-extension.git
   cd pkm5e-extension
   ```

2. **Load in Chrome**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (top right)
   - Click "Load unpacked"
   - Select the `pkm5e-extension` folder

3. **Verify Installation**
   - Visit `https://poke5e.app/`
   - You should see a notification: "Pokemon 5e Roll20 Extension Active"
   - The extension icon should appear in your toolbar

### From Chrome Web Store (Coming Soon)

Once published, you'll be able to install directly from the Chrome Web Store.

## Quick Start

### Setup Steps

1. **Open both tabs:**
   - Tab 1: Pokemon 5e character sheet (https://poke5e.app/)
   - Tab 2: Roll20 campaign (https://roll20.net/)

2. **Check connection:**
   - Click the extension icon 🎲 in your toolbar
   - Should show: "Roll20 Tab: 🟢 Connected"
   - If red (🟤), refresh your Roll20 tab and try again

3. **Make your first roll:**
   - On the Pokemon 5e sheet, find any **Saves** section
   - Hover over "STR" (or any ability)
   - You'll see a dice emoji (🎲) and pointer cursor
   - Click it
   - Look at your Roll20 tab — the formula appears in chat input!
   - Press Enter to send the roll or make edits
## Usage Guide

### Rolling Ability Checks

1. Find the **Ability Scores** section on your Pokemon 5e sheet
2. Hover over any ability (e.g., "STR 18 (+4)")
3. Visual feedback:
   - Element highlights (slight enlargement)
   - A dice emoji (🎲) appears on hover
   - Cursor changes to pointer
4. Click to inject the check into Roll20 chat
5. Formula: `1d20+4 [CharName | STR check]`

### Rolling Saving Throws

1. Navigate to the **Saves** section on your Pokemon 5e sheet
2. Hover over any ability save (e.g., "STR +5")
3. Click to inject the save roll
4. Formula: `1d20+5 [CharName | STR save]`

### Rolling Skill Checks

1. Navigate to the **Skills** section
2. Hover over any skill to see the rollable indicator
3. Click to inject the skill check formula
4. Formula: `1d20+7 [CharName | Acrobatics]`

### Rolling Attacks

1. Navigate to the **Moves** section
2. Hover over any move name (e.g., "Quick Attack")
3. Click to execute the attack:
   - **Hit Roll**: `1d20+7 [CharName | Quick Attack | Attack]`
   - **Damage Roll**: `1d6 [CharName | Quick Attack | Damage (1d6)]` (400ms delay)
4. Both rolls are automatically formatted with extension styling

## Troubleshooting

### Common Issues

**Extension loads but I don't see the extension icon**
- Make sure the extension is enabled in `chrome://extensions/`
- Try refreshing the poke5e.app tab

**Clickable elements aren't appearing**
- Refresh both the poke5e.app and Roll20 tabs
- Check that you're viewing the character sheet (not just the Pokémon Pokédex)
- Open Developer Console (F12) on poke5e.app and check for error messages

**Rolls inject into chat but don't appear in Roll20**
- Refresh your Roll20 tab
- Make sure your Roll20 campaign is loaded and you have access to the chat
- Check that another extension isn't blocking Roll20 chat messages

**Rolls appear but aren't formatted (no background color)**
- This was a bug in v1.0, fixed in v1.1 — update your extension
- If issue persists, go to `chrome://extensions/` and click the refresh icon on this extension

**Handlers disappear when I switch Pokémon**
- This was fixed in v1.1 — update your extension
- The extension now auto-reinjects handlers every 500ms on URL changes (SPA navigation)

**Damage dice shows weird characters (e.g., "2d8+7ⓘ")**
- This was fixed in v1.1 — update your extension
- The extension now strips STAB alert icons automatically

### Checking Logs

Logs are printed to the browser console with the `[PKM5e Roll20 Extension]` prefix:

```
[PKM5e Roll20 Extension] Initialization attempt 1/10...
[PKM5e Roll20 Extension] ✓ Página carregou! Inicializando handlers...
[PKM5e Roll20 Extension] Injected 18 ability handlers
[PKM5e Roll20 Extension] Injected 6 save handlers
[PKM5e Roll20 Extension] Injected 15 skill handlers
```

## Project Structure

```
pkm5e-extension/
├── manifest.json              # Extension configuration
├── background.js              # Service worker (message routing)
├── PROJECT_PLAN.md            # Detailed development plan
├── README.md                  # This file
│
├── content-scripts/
│   ├── poke5e.js             # Main script for poke5e.app
│   └── roll20.js             # Main script for roll20.net
│
├── utils/
│   ├── dataParser.js         # Pokemon sheet data extraction
│   ├── clickInjector.js      # Click handler injection
│   └── storage.js            # Settings persistence
│
├── popup/
│   ├── popup.html            # Extension popup UI
│   ├── popup.js              # Popup logic
│   └── popup.css             # Popup styles
│
├── styles/
│   └── poke5e-overlay.css    # Content script styling
│
└── assets/
    ├── icon-16.png           # Icon 16x16
    ├── icon-48.png           # Icon 48x48
    └── icon-128.png          # Icon 128x128 (add these)
```

### Architecture Overview

```
User clicks on poke5e.app element (ability/save/skill/attack)
    ↓
ClickInjector detects click event
    ↓
Sends ROLL_REQUEST/ATTACK_REQUEST message to background.js
    ↓
Background.js finds Roll20 tab and forwards message
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

## Configuration

### User Settings (Stored in Chrome)

Located in: **Chrome → Settings → Advanced → Privacy and security → Site settings → Cookies and data**

Available settings:
- `extensionEnabled`: Toggle entire extension (default: true)
- `notificationStyle`: 'toast' | 'badge' | 'console' (default: 'toast')
- `enableDebug`: Enable debug logging (default: false)
- `soundEnabled`: Play sound on successful rolls (default: false)
- `rollNotationStyle`: 'verbose' | 'concise' (default: 'verbose')

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
StorageManager.addToRollHistory(rollData)     // Log a roll to history
StorageManager.getRollHistory(limit)          // Retrieve last N rolls
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

### Version 1.1 (Current)
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

### Version 1.2 (Planned)
- 🎯 Advantage/disadvantage support
- 🎯 Spell save DC calculations


## Acknowledgments

Special thanks to:

- **[Auroratide](https://github.com/Auroratide)** — Created the amazing [Pokemon 5e](https://poke5e.app/) ruleset and SvelteKit app
- **[Roll20](https://roll20.net/)** — Excellent platform for TTRPG campaigns
- **[Chrome Extensions Docs](https://developer.chrome.com/docs/extensions/)** — Comprehensive API documentation
- **[irfansusanto20](https://www.flaticon.com/authors/irfansusanto20)** — D20 icon design
- **[Freepik](https://www.flaticon.com/authors/freepik)** — Additional icon assets

---

**Made with ❤️ for Pokemon 5e**
