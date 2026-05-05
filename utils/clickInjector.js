/**
 * Click Injector Module
 * Adds click handlers to rollable elements on poke5e.app
 */

const ClickInjector = (() => {
  const ROLLABLE_CLASS = 'poke5e-rollable';
  const HOVER_CLASS = 'poke5e-hover';

  /**
   * Create a roll context from the clicked element
   * @param {HTMLElement} element - The element that was clicked
   * @param {string} rollType - Type of roll (save, skill, ability, attack)
   * @returns {Object} Roll context
   */
  function createRollContext(element, rollType) {
    const text = element.innerText.trim();
    let stat = null;
    let modifier = 0;

    // Determine which ability/stat
    const abilityMatch = text.match(/(STR|DEX|CON|INT|WIS|CHA)/i);
    if (abilityMatch) {
      stat = abilityMatch[1].toUpperCase();
    }

    // Parse modifier from element text first
    const modifierMatch = text.match(/([+-]\d+)/);
    if (modifierMatch) {
      modifier = parseInt(modifierMatch[1]);
    } else if (stat && rollType === 'check') {
      // Ability check: get modifier from parsed ability scores
      const abilities = DataParser.parseAbilityScores();
      if (abilities && abilities[stat] !== undefined) {
        modifier = abilities[stat].modifier;
        log(`✓ Got ${stat} check modifier from parser: ${modifier}`);
      }
    } else if (stat && rollType === 'save') {
      // If no modifier found in text, try to get from parsed saves
      const saves = DataParser.parseSaves();
      if (saves && saves[stat] !== undefined) {
        modifier = saves[stat];
        log(`✓ Got ${stat} save modifier from parser: ${modifier}`);
      }
    } else if (rollType === 'skill') {
      // For skills, try to get from parsed skills
      const skills = DataParser.parseSkills();
      if (skills) {
        // Find the skill in the parsed data
        for (const skillName in skills) {
          if (text.includes(skillName)) {
            modifier = skills[skillName];
            stat = skillName; // Set stat to skill name for better logging
            log(`✓ Got ${skillName} skill modifier from parser: ${modifier}`);
            break;
          }
        }
      }
    }

    const context = {
      rollType: rollType,
      stat: stat,
      modifier: modifier,
      label: text,
      timestamp: Date.now()
    };

    log('Created roll context:', context);
    return context;
  }

  /**
   * Send roll request to background worker
   * @param {Object} rollContext - The roll context
   */
  function sendRollRequest(rollContext) {
    try {
      // Verify extension context
      if (!chrome.runtime || !chrome.runtime.sendMessage) {
        showNotification('✗ Extension context not available', 'error');
        log('Error: Chrome extension context not available');
        return;
      }
      
      log('Sending ROLL_REQUEST to background:', rollContext);
      
      chrome.runtime.sendMessage({
        type: 'ROLL_REQUEST',
        data: {
          rollType: rollContext.rollType,
          stat: rollContext.stat,
          modifier: rollContext.modifier,
          label: rollContext.rollType === 'skill'
            ? rollContext.stat
            : `${rollContext.stat} ${rollContext.rollType}`,
          diceFormula: `1d20+${rollContext.modifier}`,
          characterName: DataParser.getCharacterName(),
          sheetData: DataParser.getCompleteSheetData()
        }
      }, response => {
        log('Response received from background:', response);
        
        if (chrome.runtime.lastError) {
          const errorMsg = chrome.runtime.lastError.message;
          log('❌ Chrome error:', errorMsg);
          showNotification(`✗ Extension error: ${errorMsg}`, 'error');
          return;
        }
        
        if (response && response.success) {
          log('✓ Roll executed successfully');
          showNotification('✓ Roll sent to Roll20', 'success');
        } else {
          const error = response?.error || response?.message || 'Unknown error';
          log('❌ Roll failed:', error);
          showNotification(`✗ ${error}`, 'error');
        }
      });
    } catch (error) {
      log('❌ Exception in sendRollRequest:', error.message);
      showNotification(`✗ Error: ${error.message}`, 'error');
    }
  }

  /**
   * Show temporary notification
   * @param {string} message - Message to show
   * @param {string} type - 'success', 'error', 'info'
   */
  function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `poke5e-notification poke5e-notification-${type}`;
    notification.innerText = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      border-radius: 4px;
      font-family: Arial, sans-serif;
      font-size: 14px;
      z-index: 10000;
      animation: slideIn 0.3s ease;
      ${type === 'success' ? 'background: #4CAF50; color: white;' : ''}
      ${type === 'error' ? 'background: #f44336; color: white;' : ''}
      ${type === 'info' ? 'background: #2196F3; color: white;' : ''}
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  /**
   * Add hover effects to rollable elements
   * @param {HTMLElement} element - Element to highlight
   */
  function addHoverEffect(element) {
    element.classList.add(HOVER_CLASS);
    element.style.cursor = 'pointer';
    element.title = 'Click to roll (Extension enabled)';
    
    element.addEventListener('mouseenter', () => {
      element.style.opacity = '0.8';
      element.style.textDecoration = 'underline';
    });
    
    element.addEventListener('mouseleave', () => {
      element.style.opacity = '1';
      element.style.textDecoration = 'none';
    });
  }

  /**
   * Find and inject ability score clicks (Stats section).
   * Source: AttributeBlock.svelte → <dl><dt><abbr title="Strength">STR</abbr></dt><dd>18 (+4)</dd>
   * Selector: dl dt:has(abbr)
   */
  function injectAbilityHandlers() {
    let injected = 0;
    document.querySelectorAll('dl dt:has(abbr)').forEach(dt => {
      if (dt.classList.contains(ROLLABLE_CLASS)) return;
      const abbr = dt.querySelector('abbr');
      if (!abbr) return;
      const stat = abbr.innerText.trim().toUpperCase();
      const dd = dt.nextElementSibling;
      if (!dd) return;
      const modMatch = dd.innerText.match(/\(([+-]?\d+)\)/);
      if (!modMatch) return;
      const modifier = parseInt(modMatch[1]);

      dt.classList.add(ROLLABLE_CLASS);
      addHoverEffect(dt);
      dt.addEventListener('click', (e) => {
        e.stopPropagation();
        sendRollRequest({ rollType: 'check', stat, modifier });
      });
      injected++;
      log(`✓ Ability check handler injected: ${stat} (${modifier >= 0 ? '+' : ''}${modifier})`);
    });
    log(`Injected ${injected} ability check handlers`);
  }

  /**
   * Find and inject saves section clicks.
   * Source: SkillsInfo.svelte → <div class="upper"><dl><dt><span>⦿</span><span>STR</span></dt><dd>+7</dd>
   * Selector: div.upper dl dt
   */
  function injectSavesHandlers() {
    let injected = 0;
    document.querySelectorAll('div.upper dl dt').forEach(dt => {
      if (dt.classList.contains(ROLLABLE_CLASS)) return;
      const nameSpan = dt.querySelector('span:last-child');
      if (!nameSpan) return;
      const stat = nameSpan.innerText.trim().toUpperCase();
      const dd = dt.nextElementSibling;
      if (!dd) return;
      const modifier = parseInt(dd.innerText.trim());
      if (isNaN(modifier)) return;

      dt.classList.add(ROLLABLE_CLASS);
      addHoverEffect(dt);
      dt.addEventListener('click', (e) => {
        e.stopPropagation();
        sendRollRequest({ rollType: 'save', stat, modifier });
      });
      injected++;
      log(`✓ Save handler injected: ${stat} (${modifier >= 0 ? '+' : ''}${modifier})`);
    });
    log(`Injected ${injected} save handlers`);
  }

  /**
   * Find and inject skills section clicks.
   * Source: SkillsInfo.svelte → <div class="cap"><dl><dt><span>⦿</span><span>Acrobatics</span></dt><dd>+7</dd>
   * Selector: div.cap dl dt
   */
  function injectSkillsHandlers() {
    let injected = 0;
    document.querySelectorAll('div.cap dl dt').forEach(dt => {
      if (dt.classList.contains(ROLLABLE_CLASS)) return;
      const nameSpan = dt.querySelector('span:last-child');
      if (!nameSpan) return;
      const skill = nameSpan.innerText.trim();
      const dd = dt.nextElementSibling;
      if (!dd) return;
      const modifier = parseInt(dd.innerText.trim());
      if (isNaN(modifier)) return;

      dt.classList.add(ROLLABLE_CLASS);
      addHoverEffect(dt);
      dt.addEventListener('click', (e) => {
        e.stopPropagation();
        sendRollRequest({ rollType: 'skill', stat: skill, modifier });
      });
      injected++;
      log(`✓ Skill handler injected: ${skill} (${modifier >= 0 ? '+' : ''}${modifier})`);
    });
    log(`Injected ${injected} skill handlers`);
  }

  /**
   * Find and inject attack handlers on move names.
   * Source: MoveDetails.svelte + MoveStatsInfo.svelte
   * Structure:
   *   <div class="hrow ..."><span class="flex-span bold"><a href="...">Quick Attack</a></span></div>
   *   <dl class="move-stats-info">
   *     <div><dt>Attack</dt><dd>+7 to Hit</dd></div>
   *     <div><dt>Damage</dt><dd>1d6</dd></div>
   *   </dl>
   */
  function injectAttackHandlers() {
    let injected = 0;

    // Each move block has a .move-stats-info dl with Attack and/or Damage divs
    document.querySelectorAll('dl.move-stats-info').forEach(statsDl => {
      // Find the to-hit value: div containing <dt>Attack</dt>
      let toHit = null;
      let damageDice = null;

      statsDl.querySelectorAll('div').forEach(div => {
        const dt = div.querySelector('dt');
        const dd = div.querySelector('dd');
        if (!dt || !dd) return;
        const label = dt.innerText.trim().toLowerCase();
        if (label === 'attack') {
          // "+7 to Hit" → extract the number
          const match = dd.innerText.match(/([+-]?\d+)/);
          if (match) toHit = parseInt(match[1]);
        } else if (label === 'damage' || label === 'healing') {
          // "1d6" or "2d6 + 3"
          damageDice = dd.innerText.trim().replace(/\s+/g, '');
        }
      });

      // No attack stat = move without a hit roll (e.g. pure save moves), skip
      if (toHit === null && damageDice === null) return;

      // Find the move name link — it's in the .hrow above this dl
      // The dl is a sibling of .move-stats (its parent div), which is inside .vstack
      const moveContainer = statsDl.closest('.vstack');
      if (!moveContainer) return;
      const nameLink = moveContainer.querySelector('.flex-span.bold a, .flex-span a');
      if (!nameLink) return;
      if (nameLink.classList.contains(ROLLABLE_CLASS)) return;

      const moveName = nameLink.innerText.trim();

      nameLink.classList.add(ROLLABLE_CLASS);
      addHoverEffect(nameLink);

      nameLink.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const characterName = DataParser.getCharacterName();
        chrome.runtime.sendMessage({
          type: 'ATTACK_REQUEST',
          data: {
            moveName,
            characterName,
            toHit,
            damageDice,
          }
        }, response => {
          if (chrome.runtime.lastError) {
            log('❌ Chrome error:', chrome.runtime.lastError.message);
            showNotification(`✗ ${chrome.runtime.lastError.message}`, 'error');
            return;
          }
          if (response && response.success) {
            showNotification(`⚔ ${moveName} rolled!`, 'success');
          } else {
            showNotification(`✗ ${response?.error || 'Unknown error'}`, 'error');
          }
        });
      });

      injected++;
      log(`✓ Attack handler injected: ${moveName} (toHit=${toHit}, damage=${damageDice})`);
    });

    log(`Injected ${injected} attack handlers`);
  }

  /**
   * Main injection function - call this to set up all handlers
   */
  function injectAllHandlers() {
    log('Injecting click handlers...');
    
    try {
      injectAbilityHandlers();
      injectSavesHandlers();
      injectSkillsHandlers();
      injectAttackHandlers();
      log('✓ Click handlers injected successfully');
      showNotification('Pokemon 5e Roll20 Extension Active', 'info');
    } catch (error) {
      log('✗ Error injecting handlers:', error);
      showNotification('Extension error - check console', 'error');
    }
  }

  /**
   * Reinject handlers (useful after DOM changes)
   */
  function reinjectHandlers() {
    log('Reinjectin handlers...');
    injectAllHandlers();
  }

  // Public API
  return {
    injectAllHandlers,
    reinjectHandlers,
    createRollContext,
    sendRollRequest,
    showNotification
  };
})();
