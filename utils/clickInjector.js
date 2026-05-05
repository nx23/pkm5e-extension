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
          label: `${rollContext.stat} ${rollContext.rollType}`,
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
   * Find and inject saves section clicks
   * More robust approach: Find elements containing save patterns
   */
  function injectSavesHandlers() {
    const abilityNames = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
    let injected = 0;

    // Find all elements that might contain ability saves
    const allElements = document.querySelectorAll('*');
    const processedElements = new Set();

    allElements.forEach(el => {
      // Skip if already processed
      if (processedElements.has(el)) return;
      if (el.classList.contains(ROLLABLE_CLASS)) return;
      if (el.children.length > 0) return; // Skip containers, look for leaf elements

      const text = el.innerText?.trim() || '';
      
      // Look for patterns like "STR +5" or just "STR" in save sections
      abilityNames.forEach(ability => {
        const saveRegex = new RegExp(`^${ability}\\s*[+-]?\\d*$`);
        
        if (saveRegex.test(text) || (text.includes(ability) && text.match(/[+-]\d+/))) {
          // Found a save element!
          el.classList.add(ROLLABLE_CLASS);
          addHoverEffect(el);
          processedElements.add(el);
          
          el.addEventListener('click', (e) => {
            e.stopPropagation();
            const context = createRollContext(el, 'save');
            if (context.stat) {
              sendRollRequest(context);
            }
          });
          
          injected++;
          log(`✓ Save handler injected: ${text}`);
        }
      });
    });

    log(`Injected ${injected} save handlers`);
  }

  /**
   * Find and inject skills section clicks
   * More robust approach: Find elements containing skill patterns
   */
  function injectSkillsHandlers() {
    const skillNames = [
      'Acrobatics', 'Animal Handling', 'Arcana', 'Athletics',
      'Deception', 'History', 'Insight', 'Intimidation',
      'Investigation', 'Medicine', 'Nature', 'Perception',
      'Performance', 'Persuasion', 'Religion', 'Sleight Of Hand',
      'Stealth', 'Survival'
    ];

    let injected = 0;
    const processedElements = new Set();

    // Find all elements that might contain skill bonuses
    const allElements = document.querySelectorAll('*');

    allElements.forEach(el => {
      // Skip if already processed
      if (processedElements.has(el)) return;
      if (el.classList.contains(ROLLABLE_CLASS)) return;
      if (el.children.length > 0) return; // Skip containers

      const text = el.innerText?.trim() || '';

      skillNames.forEach(skill => {
        // Match skill name with optional bonus: "Athletics +4" or "Sleight Of Hand +1"
        const skillRegex = new RegExp(`^${skill}\\s*[+-]?\\d*$`, 'i');
        
        if (skillRegex.test(text) || (text.includes(skill) && text.match(/[+-]\d+/))) {
          // Found a skill element!
          el.classList.add(ROLLABLE_CLASS);
          addHoverEffect(el);
          processedElements.add(el);
          
          el.addEventListener('click', (e) => {
            e.stopPropagation();
            const context = createRollContext(el, 'skill');
            context.skill = skill;
            sendRollRequest(context);
          });
          
          injected++;
          log(`✓ Skill handler injected: ${text}`);
        }
      });
    });

    log(`Injected ${injected} skill handlers`);
  }

  /**
   * Main injection function - call this to set up all handlers
   */
  function injectAllHandlers() {
    log('Injecting click handlers...');
    
    try {
      injectSavesHandlers();
      injectSkillsHandlers();
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
