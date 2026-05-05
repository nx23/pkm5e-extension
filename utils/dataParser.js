/**
 * Data Parser Module
 * Extracts Pokemon and Trainer information from poke5e.app
 * 
 * Trainer Page Structure:
 * - Has "Trainer Id" and "Species"
 * - Abilities appear after "Home Region"
 * - Saves section appears after abilities
 * - Skills section appears after saves
 */

const DataParser = (() => {
  /**
   * Parse ability scores from the sheet
   * Format: "STR\n10 (+0)" with newlines between name and score
   * @returns {Object} Ability scores and modifiers
   */
  function parseAbilityScores() {
    const abilities = {};
    // AttributeBlock.svelte: <dt><abbr title="Strength">STR</abbr></dt><dd>18 (+4)</dd>
    document.querySelectorAll('dl dt:has(abbr)').forEach(dt => {
      const abbr = dt.querySelector('abbr');
      if (!abbr) return;
      const stat = abbr.innerText.trim().toUpperCase();
      const dd = dt.nextElementSibling;
      if (!dd) return;
      const score = parseInt(dd.innerText);
      const modMatch = dd.innerText.match(/\(([+-]?\d+)\)/);
      if (modMatch) {
        abilities[stat] = { score, modifier: parseInt(modMatch[1]) };
        log(`✓ Parsed ${stat}: score=${score}, modifier=${modMatch[1]}`);
      } else {
        log(`✗ Could not parse ${stat}`);
      }
    });
    log('Parsed abilities:', abilities);
    return abilities;
  }

  /**
   * Parse saves from the sheet
   * Saves section format: "Saves\nSTR +0\nDEX +5" etc
   * @returns {Object} Save modifiers
   */
  function parseSaves() {
    const saves = {};
    // SkillsInfo.svelte: <div class="upper"><dl><dt><span>⦿</span><span>STR</span></dt><dd>+7</dd>
    const saveDts = document.querySelectorAll('div.upper dl dt');
    if (saveDts.length === 0) {
      log('✗ Could not find Saves section');
      return saves;
    }
    saveDts.forEach(dt => {
      const nameSpan = dt.querySelector('span:last-child');
      if (!nameSpan) return;
      const stat = nameSpan.innerText.trim().toUpperCase();
      const dd = dt.nextElementSibling;
      if (!dd) return;
      const modifier = parseInt(dd.innerText.trim());
      if (!isNaN(modifier)) {
        saves[stat] = modifier;
        log(`✓ Parsed save ${stat}: ${modifier >= 0 ? '+' : ''}${modifier}`);
      }
    });
    log('Parsed saves:', saves);
    return saves;
  }

  /**
   * Parse skills from the sheet
   * Skills section format: "Skills\nAthletics +4\nAcrobatics +1" etc
   * @returns {Object} Skill bonuses keyed by skill name
   */
  function parseSkills() {
    const skills = {};
    // SkillsInfo.svelte: <div class="cap"><dl><dt><span>⦿</span><span>Acrobatics</span></dt><dd>+7</dd>
    const skillDts = document.querySelectorAll('div.cap dl dt');
    if (skillDts.length === 0) {
      log('✗ Could not find Skills section');
      return skills;
    }
    skillDts.forEach(dt => {
      const nameSpan = dt.querySelector('span:last-child');
      if (!nameSpan) return;
      const skill = nameSpan.innerText.trim();
      const dd = dt.nextElementSibling;
      if (!dd) return;
      const modifier = parseInt(dd.innerText.trim());
      if (!isNaN(modifier)) {
        skills[skill] = modifier;
        log(`✓ Parsed skill ${skill}: ${modifier >= 0 ? '+' : ''}${modifier}`);
      }
    });
    log('Parsed skills:', skills);
    return skills;
  }

  /**
   * Determine if current view is Trainer or Pokemon sheet
   * Trainer: Has "Species" and "Trainer Id"
   * @returns {string} 'trainer' or 'pokemon'
   */
  function identifySheetType() {
    const bodyText = document.body.innerText;
    
    // Check for Trainer indicators
    if (bodyText.includes('Trainer Id') && bodyText.includes('Species')) {
      log('✓ Sheet type: TRAINER');
      return 'trainer';
    }
    
    // Check for Pokemon indicators
    log('✓ Sheet type: POKEMON');
    return 'pokemon';
  }

  /**
   * Get the character name for the current page.
   * - Trainer page: name before "Trainer Id" in body text
   * - Pokemon page: pokemon name from page title ("Alolan Marowak | Pokemon 5e Reference")
   *   plus trainer name from heading "X's Pokemon"
   * @returns {string} Character name
   */
  function getCharacterName() {
    const pageTitle = document.title;
    
    // Pokemon page: title is "Alolan Marowak | Pokemon 5e Reference"
    const name = pageTitle.split('|')[0].trim();
    log(`✓ Character name (trainer): ${name}`);

    return name;
  }

  /**
   * Get the current sheet name/title
   * @returns {string} Sheet title
   */
  function getSheetTitle() {
    let title = document.title;
    
    // Try to find heading in body (usually first substantial text)
    const bodyText = document.body.innerText;
    const lines = bodyText.split('\n').filter(line => line.trim().length > 0);
    
    // First non-empty line is usually the name
    if (lines.length > 0) {
      title = lines[0].trim();
    }

    log('Sheet title:', title);
    return title;
  }

  /**
   * Get current HP and Max HP
   * @returns {Object} {current, max}
   */
  function getHitPoints() {
    const bodyText = document.body.innerText;
    // Match pattern like "91 / 91" or "100 / 100"
    const hpRegex = /^(\d+)\s*\/\s*(\d+)$/m;
    const match = bodyText.match(hpRegex);
    
    if (match) {
      log(`✓ HP: ${match[1]} / ${match[2]}`);
      return {
        current: parseInt(match[1]),
        max: parseInt(match[2])
      };
    }
    
    log('✗ Could not parse HP');
    return { current: 0, max: 0 };
  }

  /**
   * Get complete sheet data
   * @returns {Object} All parsed data
   */
  function getCompleteSheetData() {
    const data = {
      timestamp: Date.now(),
      sheetType: identifySheetType(),
      title: getSheetTitle(),
      abilities: parseAbilityScores(),
      saves: parseSaves(),
      skills: parseSkills(),
      hitPoints: getHitPoints()
    };

    log('=== COMPLETE SHEET DATA ===', data);
    return data;
  }

  /**
   * Debug function to understand page structure
   * Shows what the parser is seeing
   */
  function debugPageStructure() {
    const bodyText = document.body.innerText;
    const isTrainerPage = bodyText.includes('Trainer Id') && bodyText.includes('Species');
    const hasAbilityScores = document.querySelectorAll('dl dt:has(abbr)').length > 0;
    const hasSavesSection = document.querySelectorAll('div.upper dl dt').length > 0;
    const hasSkillsSection = document.querySelectorAll('div.cap dl dt').length > 0;
    const isPokemonPage = hasAbilityScores;

    const debug = {
      pageTitle: document.title,
      characterName: getCharacterName(),
      bodyTextLength: bodyText.length,
      isTrainerPage,
      isPokemonPage,
      pageType: isTrainerPage ? '🧑 TRAINER' : isPokemonPage ? '🐱 POKEMON' : '❓ UNKNOWN',
      indicators: { hasAbilityScores, hasSavesSection, hasSkillsSection },
      first1000Chars: bodyText.substring(0, 1000),
    };

    console.log('[DataParser DEBUG]', debug);
    return debug;
  }

  // Public API
  return {
    parseAbilityScores,
    parseSaves,
    parseSkills,
    identifySheetType,
    getCharacterName,
    getSheetTitle,
    getHitPoints,
    getCompleteSheetData,
    debugPageStructure
  };
})();
