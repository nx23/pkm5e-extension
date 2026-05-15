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
   * @param {MouseEvent} event - The click event (para detectar Shift/Ctrl)
   * @returns {Object} Roll context
   */
  function createRollContext(element, rollType, event) {
    const text = element.innerText.trim();
    let stat = null;
    let modifier = 0;

    // Read modifier state from the click event AND from body classes (set by key listeners
    // in poke5e.js). The body class is a more reliable source when the browser intercepts
    // Shift+Click on <a> elements (e.g. "open in new window" behaviour in Chrome).
    const hasAdvantage    = (event && event.shiftKey) || document.body.classList.contains('poke5e-advantage');
    const hasDisadvantage = (event && event.ctrlKey)  || document.body.classList.contains('poke5e-disadvantage');

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
      timestamp: Date.now(),
      advantage: hasAdvantage,
      disadvantage: hasDisadvantage
    };

    log('Created roll context:', context);
    return context;
  }

  /**
   * Send a message to the background service worker via a long-lived port.
   * chrome.runtime.connect() reliably wakes the service worker in Firefox MV3,
   * unlike sendMessage() which fails silently when the worker is suspended.
   * @param {Object} payload - Message to send
   * @param {Function} [callback] - Called with the response
   */
  function sendViaPort(payload, callback) {
    try {
      const port = chrome.runtime.connect({ name: 'poke5e-roll' });
      let responded = false;

      port.onDisconnect.addListener(() => {
        if (!responded) {
          responded = true;
          const err = chrome.runtime.lastError;
          if (err) log('Port disconnected with error:', err.message);
          if (callback) callback({ success: false, error: (err && err.message) || 'Port disconnected without response' });
        }
      });
      port.onMessage.addListener((response) => {
        responded = true;
        port.disconnect();
        if (callback) callback(response);
      });
      port.postMessage(payload);
    } catch (error) {
      log('❌ sendViaPort error:', error.message);
      if (callback) callback({ success: false, error: error.message });
    }
  }

  /**
   * Send roll request to Roll20 via storage
   * @param {Object} rollContext - The roll context
   */
  function sendRollRequest(rollContext) {
    try {
      if (!chrome.runtime || !chrome.runtime.connect) {
        showNotification('✗ Extension context not available', 'error');
        log('Error: Chrome extension context not available');
        return;
      }

      log('Sending ROLL_REQUEST to background:', rollContext);

      // Read bonuses directly from storage — no round-trip through the background needed
      chrome.storage.sync.get(['attackBonus', 'saveDcBonus'], (result) => {
        if (chrome.runtime.lastError) {
          log('⚠ Could not retrieve bonuses:', chrome.runtime.lastError);
        }

        const attackBonus = parseInt(result?.attackBonus) || 0;
        const saveDcBonus = parseInt(result?.saveDcBonus) || 0;

        let extraBonus = 0;
        if (rollContext.rollType === 'attack') {
          extraBonus = attackBonus;
          log(`✓ Applying attack bonus: +${attackBonus}`);
        } else if (rollContext.rollType === 'save') {
          extraBonus = saveDcBonus;
          log(`✓ Applying save DC bonus: +${saveDcBonus}`);
        }

        const totalModifier = rollContext.modifier + extraBonus;

        const rollData = {
          rollType: rollContext.rollType,
          stat: rollContext.stat,
          modifier: rollContext.modifier,
          extraBonus,
          totalModifier,
          label: rollContext.rollType === 'skill'
            ? rollContext.stat
            : `${rollContext.stat} ${rollContext.rollType}`,
          diceFormula: `1d20+${totalModifier}`,
          characterName: DataParser.getCharacterName(),
          advantage: rollContext.advantage,
          disadvantage: rollContext.disadvantage
        };

        log('Writing ROLL_REQUEST to storage:', rollData);
        chrome.storage.local.set({
          pkm5eRollRequest: { type: 'ROLL_REQUEST', data: rollData, nonce: Date.now() }
        }, () => {
          if (chrome.runtime.lastError) {
            log('❌ Storage write failed:', chrome.runtime.lastError.message);
            showNotification('✗ Failed to send roll', 'error');
          } else {
            log('✓ Roll request sent via storage');
            showNotification('✓ Roll sent to Roll20', 'success');
          }
        });
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
        const rollContext = createRollContext(dt, 'check', e);
        sendRollRequest({ rollType: 'check', stat, modifier, ...rollContext });
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
        const rollContext = createRollContext(dt, 'save', e);
        sendRollRequest({ rollType: 'save', stat, modifier, ...rollContext });
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
        const rollContext = createRollContext(dt, 'skill', e);
        sendRollRequest({ rollType: 'skill', stat: skill, modifier, ...rollContext });
      });
      injected++;
      log(`✓ Skill handler injected: ${skill} (${modifier >= 0 ? '+' : ''}${modifier})`);
    });
    log(`Injected ${injected} skill handlers`);
  }

  /**
   * Find and inject click handlers on all move names.
   * Handles attack, save DC and info-only moves (no roll).
   * Source: MoveDetails.svelte
   * Structure:
   *   div.vstack (outer card)
   *     div.vstack.bg-by-type (coloured header)
   *       div.hrow > span.flex-span.bold > a  ← nameLink
   *       div.hrow.tiny-font > span.flex-span  ← type
   *     div.move-stats > dl.move-stats-info    ← only for attack/save/damage moves
   *     div.smaller-font                       ← Power/Range/Time/Duration/Description
   */
  function injectAttackHandlers() {
    let injected = 0;

    // Entry point: every move name link
    document.querySelectorAll('.flex-span.bold a').forEach(nameLink => {
      if (nameLink.classList.contains(ROLLABLE_CLASS)) return;

      // Walk up: nameLink → span → div.hrow → div.vstack(inner) → div.vstack(outer)
      const innerVstack = nameLink.closest('.vstack');
      if (!innerVstack) return;
      const moveContainer = innerVstack.parentElement?.classList?.contains('vstack')
        ? innerVstack.parentElement
        : innerVstack;

      // Guard: must have a .smaller-font section to be a move card (avoids false positives)
      if (!moveContainer.querySelector('.smaller-font')) return;

      const moveName = nameLink.innerText.trim();
      if (!moveName) return;

      // Extract stats from dl.move-stats-info (only present for attack/save/damage moves)
      let toHit = null, saveDC = null, saveType = null, damageDice = null;
      const statsDl = moveContainer.querySelector('dl.move-stats-info');
      if (statsDl) {
        statsDl.querySelectorAll('div').forEach(div => {
          const dt = div.querySelector('dt');
          const dd = div.querySelector('dd');
          if (!dt || !dd) return;
          const label = dt.innerText.trim().toLowerCase();

          if (label === 'attack') {
            const match = dd.innerText.match(/([+-]?\d+)/);
            if (match) toHit = parseInt(match[1]);
          } else if (label.includes('save')) {
            const saveMatch = label.match(/(str|dex|con|int|wis|cha)/i);
            if (saveMatch) {
              saveType = saveMatch[1].toUpperCase();
              const dcMatch = dd.innerText.match(/DC\s*(\d+)/i);
              if (dcMatch) saveDC = parseInt(dcMatch[1]);
            }
          } else if (label === 'damage' || label === 'healing') {
            damageDice = dd.innerText.trim()
              .replace(/\s+/g, '')
              .replace(/[^0-9d+\-*\/().]/gi, '');
          }
        });
      }

      // Extract move metadata
      let moveType = null;
      const typeRow = moveContainer.querySelector('.hrow.tiny-font');
      if (typeRow) {
        const typeSpan = typeRow.querySelector('.flex-span');
        if (typeSpan) moveType = typeSpan.innerText.trim();
      }

      let moveTime = null, moveRange = null, moveDuration = null, moveDescription = null;
      const detailsSection = moveContainer.querySelector('.smaller-font');
      if (detailsSection) {
        detailsSection.querySelectorAll('dt').forEach(dt => {
          const label = dt.innerText.trim().toLowerCase();
          const dd = dt.nextElementSibling;
          if (!dd) return;
          const val = dd.innerText.trim();
          if (label === 'time') moveTime = val;
          else if (label === 'range') moveRange = val;
          else if (label === 'duration') moveDuration = val;
        });
        const descEl = detailsSection.querySelector('.description');
        if (descEl) {
          moveDescription = descEl.innerText.trim().replace(/\s+/g, ' ');
        }
      }

      nameLink.classList.add(ROLLABLE_CLASS);
      addHoverEffect(nameLink);

      nameLink.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const rollContext = createRollContext(nameLink, 'attack', e);
        const characterName = DataParser.getCharacterName();

        // Read bonuses directly from storage — no round-trip through the background needed
        chrome.storage.sync.get(['attackBonus', 'saveDcBonus'], (result) => {
          if (chrome.runtime.lastError) {
            log('⚠ Could not retrieve bonuses:', chrome.runtime.lastError);
          }

          const attackBonus = parseInt(result?.attackBonus) || 0;
          const saveDcBonus = parseInt(result?.saveDcBonus) || 0;

          const commonData = {
            moveName,
            characterName,
            damageDice,
            moveType,
            moveTime,
            moveRange,
            moveDuration,
            moveDescription,
            advantage: rollContext.advantage,
            disadvantage: rollContext.disadvantage
          };

          let payload;
          if (saveDC !== null) {
            const totalDC = saveDC + saveDcBonus;
            if (saveDcBonus !== 0) log(`✓ Adding save DC bonus: ${saveDC} + ${saveDcBonus} = ${totalDC}`);
            payload = { type: 'ATTACK_REQUEST', data: { ...commonData, isSaveMove: true, saveType, saveDC: totalDC, baseSaveDC: saveDC, saveDcBonus } };
          } else if (toHit !== null) {
            const totalToHit = toHit + attackBonus;
            if (attackBonus !== 0) log(`✓ Adding attack bonus: ${toHit} + ${attackBonus} = ${totalToHit}`);
            payload = { type: 'ATTACK_REQUEST', data: { ...commonData, isSaveMove: false, toHit: totalToHit, baseToHit: toHit, attackBonus } };
          } else {
            payload = { type: 'ATTACK_REQUEST', data: { ...commonData, isSaveMove: false, toHit: null, saveDC: null } };
          }

          const emoji = saveDC !== null ? '💨' : toHit !== null ? '⚔' : '✓';
          const suffix = toHit !== null || saveDC !== null ? 'rolled!' : 'sent!';
          log('Writing ATTACK_REQUEST to storage:', payload);
          chrome.storage.local.set({
            pkm5eRollRequest: { ...payload, nonce: Date.now() }
          }, () => {
            if (chrome.runtime.lastError) {
              log('❌ Storage write failed:', chrome.runtime.lastError.message);
              showNotification('✗ Failed to send', 'error');
            } else {
              log('✓ Attack request sent via storage');
              showNotification(`${emoji} ${moveName} ${suffix}`, 'success');
            }
          });
        });
      });

      injected++;
      if (saveDC !== null) {
        log(`✓ Save move handler injected: ${moveName} (${saveType} Save DC=${saveDC}, damage=${damageDice})`);
      } else if (toHit !== null) {
        log(`✓ Attack handler injected: ${moveName} (toHit=${toHit}, damage=${damageDice})`);
      } else {
        log(`✓ Info-only handler injected: ${moveName}`);
      }
    });

    log(`Injected ${injected} move handlers`);
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
    log('Reinjecting handlers...');
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
