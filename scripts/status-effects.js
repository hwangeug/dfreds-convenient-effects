import CustomEffectsHandler from './effects/custom-effects-handler.js';
import EffectHelpers from './effects/effect-helpers.js';
import Settings from './settings.js';

/**
 * Handles the status effects present on the token HUD
 */
export default class StatusEffects {
  constructor() {
    this._customEffectsHandler = new CustomEffectsHandler();
    this._effectsHelper = new EffectHelpers();
    this._settings = new Settings();
  }

  /**
   * Initialize the token status effects based on the user configured settings.
   */
  initialize() {
    const modifyStatusEffects = this._settings.modifyStatusEffects;

    if (modifyStatusEffects === 'replace') {
      CONFIG.statusEffects = this._fetchStatusEffects();
    } else if (modifyStatusEffects === 'add') {
      CONFIG.statusEffects = CONFIG.statusEffects.concat(
        this._fetchStatusEffects()
      );
    }
  }

  _fetchStatusEffects() {
    let statusEffects = this._settings.statusEffectNames
      .map((name) => {
        return game.dfreds.effectInterface.findEffectByName(name);
      })
      .filter((effect) => effect)
      .map((effect) => {
        return {
          id: this._effectsHelper.getId(effect.name),
          ...effect.toObject(),
        };
      });

    if (this._settings.statusEffectsSortOrder === 'alphabetical') {
      return statusEffects.sort((a, b) => {
        let nameA = a.name.toLowerCase();
        let nameB = b.name.toLowerCase();

        if (nameA < nameB) return -1;
        if (nameA > nameB) return 1;
        return 0;
      });
    } else {
      return statusEffects;
    }
  }

  /**
   * This function is called when a token status effect is toggled. If the
   * status effect is one added by the convenient effect module, it is handled
   * here. Otherwise, the original wrapper function is used.
   *
   * @param {Token5e} token - the token to toggle the effect on
   * @param {fn} wrapper - the original onToggleEffect function
   * @param {any[]} args - any arguments provided with the original onToggleEffect function
   */
  onToggleEffect({ token, wrapper, args }) {
    const [event] = args;
    const statusEffectId = event.currentTarget.dataset.statusId;
    if (statusEffectId.startsWith('Convenient Effect: ')) {
      event.preventDefault();
      event.stopPropagation();
      const effectName = statusEffectId.replace('Convenient Effect: ', '');

      game.dfreds.effectInterface.toggleEffect(effectName, {
        overlay: args.length > 1 && args[1]?.overlay,
        uuids: [token.actor.uuid],
      });
    } else {
      wrapper(...args);
    }
  }

  /**
   * This function is called when the status effect view is shown. It does
   * essentially the same thing that the original method does, except that it
   * keys the resulting object based on the ID of the status effect, rather than
   * the icon.
   *
   * @param {Token5e} token - the token to get the status effects for
   * @param {fn} wrapper - the original getStatusEffectChoices function
   * @param {any[]} args - any arguments provided with the original getStatusEffectChoices function
   * @returns {Object} object mapping for all the status effects
   */
  getStatusEffectChoices({ token, wrapper, args }) {
    if (this._settings.modifyStatusEffects === 'none') {
      return wrapper(...args);
    }

    const doc = token.document;

    // Get statuses which are active for the token actor
    const actor = token.actor || null;
    const statuses = actor
      ? actor.effects.reduce((obj, effect) => {
          for (const id of effect.statuses) {
            obj[id] = { id, overlay: !!effect.getFlag('core', 'overlay') };
          }
          return obj;
        }, {})
      : {};

    // Prepare the list of effects from the configured defaults and any additional effects present on the Token
    const tokenEffects = foundry.utils.deepClone(doc.effects) || [];
    if (doc.overlayEffect) tokenEffects.push(doc.overlayEffect);
    return CONFIG.statusEffects.concat(tokenEffects).reduce((obj, e) => {
      const id = e.id; // NOTE: added this

      const src = e.icon ?? e;
      if (id in obj) return obj; // NOTE: changed from src to id
      const status = statuses[e.id] || {};
      const isActive = !!status.id || doc.effects.includes(src);
      const isOverlay = !!status.overlay || doc.overlayEffect === src;

      // NOTE: changed key from src to id
      obj[id] = {
        id: e.id ?? '',
        title: e.name ? game.i18n.localize(e.name) : null,
        src,
        isActive,
        isOverlay,
        cssClass: [
          isActive ? 'active' : null,
          isOverlay ? 'overlay' : null,
        ].filterJoin(' '),
      };
      return obj;
    }, {});
  }

  /**
   * This function is called when the status effects are refreshed. It does
   * essentially the same thing as the original method does, except that it
   * bases the status on the token.dataset.statusId rather than the src
   * attribute
   *
   * Refresh the currently active state of all status effect icons in the Token
   * HUD selector.
   *
   * @param {TokenHUD} tokenHud - the token HUD application
   */
  refreshStatusIcons(tokenHud) {
    const effects = tokenHud.element.find('.status-effects')[0];
    const statuses = tokenHud._getStatusEffectChoices();
    for (let img of effects.children) {
      // NOTE: changed from img.getAttribute('src') to img.dataset.statusId
      const status = statuses[img.dataset.statusId] || {};
      img.classList.toggle('overlay', !!status.isOverlay);
      img.classList.toggle('active', !!status.isActive);
    }
  }
}
