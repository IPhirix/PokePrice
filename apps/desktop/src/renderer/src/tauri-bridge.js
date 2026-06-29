import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'

export function setupTauriBridge() {
  window.api = {
    // ── Auth ──────────────────────────────────────────────────────────────────
    auth: {
      isSetup: () => invoke('auth_is_setup'),
      isSessionValid: () => invoke('auth_is_session_valid'),
      createUser: (d) => invoke('auth_create_user', d),
      login: (d) => invoke('auth_login', d),
      logout: () => invoke('auth_logout'),
      getUsername: () => invoke('auth_get_username'),
      getUserList: () => invoke('auth_get_user_list'),
      getSecurityQuestion: () => invoke('auth_get_security_question'),
      getSecurityQuestionForUser: (d) => invoke('auth_get_security_question_for_user', d),
      verifySecurityAnswer: (d) => invoke('auth_verify_security_answer', d),
      verifySecurityAnswerForUser: (d) => invoke('auth_verify_security_answer_for_user', d),
      sendResetEmail: (d) => invoke('auth_send_reset_email', d),
      verifyEmailCode: (d) => invoke('auth_verify_email_code', d),
      resetPassword: (d) => invoke('auth_reset_password', d),
      changePassword: (d) => invoke('auth_change_password', d),
      updateSecurityQuestion: (d) => invoke('auth_update_security_question', d),
      setStayLoggedIn: (val) => invoke('auth_set_stay_logged_in', { stayLoggedIn: val }),
      getStayLoggedIn: () => invoke('auth_get_stay_logged_in'),
    },

    // ── Settings ──────────────────────────────────────────────────────────────
    getSettings: () => invoke('settings_get'),
    setSettings: (s) => invoke('settings_set', { s }),

    // ── Cards ─────────────────────────────────────────────────────────────────
    listCards: () => invoke('cards_list'),
    listSoldCards: () => invoke('cards_list_sold'),
    addCard: (tcgCard, condition, quantity, section, purchasePrice, binder, addedDate) =>
      invoke('cards_add', { tcgCard, condition, quantity, section, purchasePrice, binder, addedDate }),
    removeCard: (id) => invoke('cards_remove', { id }),
    updateCard: (id, updates) => invoke('cards_update', { id, updates }),
    sellCard: (id, soldInfo) => invoke('cards_sell', { id, soldInfo }),
    applyDefaultTargets: (upPct, downPct, force) =>
      invoke('cards_apply_default_targets', { upPct, downPct, force }),
    clearAllTargets: (field) => invoke('cards_clear_all_targets', { field }),

    // ── Binders ───────────────────────────────────────────────────────────────
    listBinders: (section) => invoke('binders_list', { section }),
    addBinder: (section, name) => invoke('binders_add', { section, name }),
    deleteBinder: (section, name) => invoke('binders_delete', { section, name }),
    renameBinder: (section, oldName, newName) => invoke('binders_rename', { section, oldName, newName }),

    // ── Account ───────────────────────────────────────────────────────────────
    getAccountStats: () => invoke('account_get_stats'),
    appendActivity: (entry) => invoke('account_append_activity', { entry }),
    getActivity: () => invoke('account_get_activity'),
    removeActivity: (id) => invoke('account_remove_activity', { id }),
    clearAccountData: (target) => invoke('account_clear', { target }),
    deleteAccount: () => invoke('account_delete'),
    getTriggeredAlerts: () => invoke('alerts_get_triggered'),

    // ── Prices ────────────────────────────────────────────────────────────────
    getPriceHistory: (cardId) => invoke('prices_history', { cardId }),
    setManualPrice: (cardId, price) => invoke('prices_set_manual', { cardId, price }),
    updateHistoryEntry: (cardId, date, price) => invoke('prices_update_entry', { cardId, date, price }),
    deleteHistoryEntry: (cardId, date) => invoke('prices_delete_entry', { cardId, date }),
    clearPriceHistory: () => invoke('prices_clear_history'),
    getPortfolio: (binder) => invoke('prices_portfolio', { binder }),
    refreshPrices: (cardId, section) => invoke('prices_refresh', { cardId, section }),
    getAllConditionPrices: (cardId) => invoke('prices_all_conditions', { cardId }),
    getPriceForTcgCard: (opts) => invoke('prices_for_tcg_card', { opts }),
    diagnosePrices: () => invoke('prices_diagnose'),

    // ── Trades ────────────────────────────────────────────────────────────────
    listTrades: () => invoke('trades_list'),
    saveTrade: (trade) => invoke('trades_save', { trade }),
    updateTrade: (id, trade) => invoke('trades_update', { id, trade }),
    deleteTrade: (id) => invoke('trades_delete', { id }),
    executeTrade: (payload) => invoke('trades_execute', { payload }),
    undoTrade: (tradeId) => invoke('trades_undo', { tradeId }),

    // ── Shows / Geocode ───────────────────────────────────────────────────────
    listUpcomingShows: () => invoke('upcoming_list'),
    addUpcomingShow: (show) => invoke('upcoming_add', { show }),
    removeUpcomingShow: (showId) => invoke('upcoming_remove', { showId }),
    getCardShows: (stateCode, stateName) => invoke('card_shows_fetch', { stateCode, stateName }),
    getGeocodeBatch: (data) => invoke('geocode_batch', { data }),

    // ── Event stubs (Electron IPC pattern — Tauri events not yet wired) ─────────
    onPricesRefreshing: (_cb) => () => {},
    onPricesProgress: (_cb) => () => {},
    onPricesRefreshed: (_cb) => () => {},
    onCardsChanged: (_cb) => () => {},
    onGeocodeUpdate: (_cb) => () => {},

    // ── Window controls ───────────────────────────────────────────────────────
    windowMinimize: () => getCurrentWindow().minimize(),
    windowMaximize: () => getCurrentWindow().toggleMaximize(),
    windowClose: () => getCurrentWindow().close(),

    // ── Misc / App ────────────────────────────────────────────────────────────
    getAppVersion: () => invoke('app_version'),
    getLocale: () => invoke('app_locale'),
    openExternal: (url) => invoke('shell_open_external', { url }),
    searchCards: (query) => invoke('cards_search', { query }),
    searchCardsAdvanced: (q) => invoke('cards_search_advanced', { q }),
    getCardById: (id) => invoke('cards_get_by_id', { id }),
    getCardVariations: (name, number, setName) =>
      invoke('cards_get_variations', { name, number, setName }),
    exportCards: (opts) => invoke('cards_export', { opts }),
    listSets: () => invoke('sets_list'),
    etbLookup: (name) => invoke('etb_lookup', { name }),
    etbGetAll: () => invoke('etb_get_all'),
    searchSealed: (query) => invoke('sealed_search', { query }),
    addSealedProduct: (product, section, purchasePrice, binder) =>
      invoke('sealed_add', { product, section, purchasePrice, binder }),
    sendTestEmail: () => invoke('email_test'),
    pickProfileImage: () => invoke('pick_profile_image'),
  }
}
