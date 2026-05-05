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
    const abilityNames = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
    const bodyText = document.body.innerText;
    
    abilityNames.forEach(ability => {
      // Match ability name followed by score and modifier
      const abilityRegex = new RegExp(`${ability}\\s+(\\d+)\\s*\\(([+-]?\\d+)\\)`, 'i');
      const match = bodyText.match(abilityRegex);
      
      if (match) {
        abilities[ability] = {
          score: parseInt(match[1]),
          modifier: parseInt(match[2])
        };
        log(`✓ Parsed ${ability}: score=${match[1]}, modifier=${match[2]}`);
      } else {
        log(`✗ Could not parse ${ability}`);
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
    const abilityNames = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
    const bodyText = document.body.innerText;
    
    // Find the Saves section by looking for "Saves" keyword
    const savesIndex = bodyText.indexOf('Saves');
    if (savesIndex === -1) {
      log('✗ Could not find Saves section');
      return saves;
    }
    
    // Extract text from Saves to Skills
    const skillsIndex = bodyText.indexOf('Skills');
    const savesSection = skillsIndex > savesIndex 
      ? bodyText.substring(savesIndex, skillsIndex)
      : bodyText.substring(savesIndex);
    
    abilityNames.forEach(ability => {
      // Look for save modifier in format like "STR +5" or "STR +0"
      const saveRegex = new RegExp(`${ability}\\s+([+-]\\d+)`, 'i');
      const match = savesSection.match(saveRegex);
      
      if (match) {
        saves[ability] = parseInt(match[1]);
        log(`✓ Parsed save ${ability}: ${match[1]}`);
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
    const skillNames = [
      'Acrobatics', 'Animal Handling', 'Arcana', 'Athletics',
      'Deception', 'History', 'Insight', 'Intimidation',
      'Investigation', 'Medicine', 'Nature', 'Perception',
      'Performance', 'Persuasion', 'Religion', 'Sleight Of Hand',
      'Stealth', 'Survival'
    ];

    const bodyText = document.body.innerText;
    
    // Find the Skills section
    const skillsIndex = bodyText.indexOf('Skills');
    if (skillsIndex === -1) {
      log('✗ Could not find Skills section');
      return skills;
    }
    
    // Extract text from Skills onwards
    const skillsSection = bodyText.substring(skillsIndex);

    skillNames.forEach(skill => {
      // Look for skill in format like "Athletics +4" or "Sleight Of Hand +1"
      const skillRegex = new RegExp(`${skill}\\s+([+-]\\d+)`, 'i');
      const match = skillsSection.match(skillRegex);
      
      if (match) {
        skills[skill] = parseInt(match[1]);
        log(`✓ Parsed skill ${skill}: ${match[1]}`);
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
    
    // Check for Trainer page indicators
    const isTrainerPage = bodyText.includes('Trainer Id') && bodyText.includes('Species');
    const isPokemonPage = bodyText.includes('Type') && bodyText.includes('Nature');
    
    const debug = {
      pageTitle: document.title,
      characterName: getCharacterName(),
      bodyTextLength: bodyText.length,
      isTrainerPage: isTrainerPage,
      isPokemonPage: isPokemonPage,
      pageType: isTrainerPage ? '🧑 TRAINER' : isPokemonPage ? '🐱 POKEMON' : '❓ UNKNOWN',
      indicators: {
        hasTrainerId: bodyText.includes('Trainer Id'),
        hasSpecies: bodyText.includes('Species'),
        hasType: bodyText.includes('Type'),
        hasNature: bodyText.includes('Nature'),
        hasSavesSection: bodyText.includes('Saves'),
        hasSkillsSection: bodyText.includes('Skills'),
        hasAbilityScores: !!bodyText.match(/\b(STR|DEX|CON|INT|WIS|CHA)\s+\d+/)
      },
      first1000Chars: bodyText.substring(0, 1000),
      allText: bodyText
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
