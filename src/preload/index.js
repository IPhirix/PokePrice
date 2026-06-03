const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  searchCards: (query) => ipcRenderer.invoke('cards:search', query),
  searchCardsAdvanced: (query) => ipcRenderer.invoke('cards:search-advanced', query),
  listCards: () => ipcRenderer.invoke('cards:list'),
  addCard: (tcgCard, condition, quantity, section, purchasePrice, binder, addedDate) =>
    ipcRenderer.invoke('cards:add', tcgCard, condition, quantity, section, purchasePrice, binder, addedDate),
  removeCard: (id) => ipcRenderer.invoke('cards:remove', id),
  updateCard: (id, updates) => ipcRenderer.invoke('cards:update', id, updates),
  getPriceHistory: (cardId) => ipcRenderer.invoke('prices:history', cardId),
  refreshPrices: (cardId, section) => ipcRenderer.invoke('prices:refresh', cardId, section),
  getPortfolio: (binder) => ipcRenderer.invoke('prices:portfolio', binder),
  setManualPrice: (cardId, price) => ipcRenderer.invoke('prices:setManual', cardId, price),
  clearPriceHistory: () => ipcRenderer.invoke('prices:clearHistory'),
  updateHistoryEntry: (cardId, date, price) => ipcRenderer.invoke('prices:updateEntry', cardId, date, price),
  deleteHistoryEntry: (cardId, date) => ipcRenderer.invoke('prices:deleteEntry', cardId, date),
  applyDefaultTargets: (opts) => ipcRenderer.invoke('cards:applyDefaultTargets', opts),
  clearAllTargets: (field) => ipcRenderer.invoke('cards:clearAllTargets', field),
  getTriggeredAlerts: () => ipcRenderer.invoke('alerts:getTriggered'),
  listSets: () => ipcRenderer.invoke('sets:list'),
  listBinders: (section) => ipcRenderer.invoke('binders:list', section),
  addBinder: (section, name) => ipcRenderer.invoke('binders:add', section, name),
  deleteBinder: (section, name) => ipcRenderer.invoke('binders:delete', section, name),
  renameBinder: (section, oldName, newName) => ipcRenderer.invoke('binders:rename', section, oldName, newName),

  exportCards: (opts) => ipcRenderer.invoke('cards:export', opts),
  sellCard: (id, soldInfo) => ipcRenderer.invoke('cards:sell', id, soldInfo),
  listSoldCards: () => ipcRenderer.invoke('cards:listSold'),

  listTrades: () => ipcRenderer.invoke('trades:list'),
  saveTrade: (trade) => ipcRenderer.invoke('trades:save', trade),
  updateTrade: (id, trade) => ipcRenderer.invoke('trades:update', id, trade),
  deleteTrade: (id) => ipcRenderer.invoke('trades:delete', id),
  executeTrade: (payload) => ipcRenderer.invoke('trades:execute', payload),
  undoTrade: (id) => ipcRenderer.invoke('trades:undo', id),

  searchSealed: (query) => ipcRenderer.invoke('sealed:search', query),
  addSealedProduct: (product, section, purchasePrice, binder) => ipcRenderer.invoke('sealed:add', product, section, purchasePrice, binder),
  etbLookup: (name) => ipcRenderer.invoke('etb:lookup', name),
  etbGetAll: () => ipcRenderer.invoke('etb:getAll'),

  getAccountStats: () => ipcRenderer.invoke('account:getStats'),
  clearAccountData: (target) => ipcRenderer.invoke('account:clear', target),
  deleteAccount: () => ipcRenderer.invoke('account:delete'),
  getActivity: () => ipcRenderer.invoke('account:getActivity'),
  removeActivity: (id) => ipcRenderer.invoke('account:removeActivity', id),
  appendActivity: (entry) => ipcRenderer.invoke('account:appendActivity', entry),

  getAppVersion: () => ipcRenderer.invoke('app:version'),
  getLocale: () => ipcRenderer.invoke('app:locale'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (s) => ipcRenderer.invoke('settings:set', s),
  pickProfileImage: () => ipcRenderer.invoke('profile:pickImage'),
  sendTestEmail: () => ipcRenderer.invoke('email:test'),
  getAllConditionPrices: (cardId) => ipcRenderer.invoke('prices:allConditions', cardId),
  getPriceForTcgCard: (opts) => ipcRenderer.invoke('prices:forTcgCard', opts),
  getCardVariations: (name, number, setName) => ipcRenderer.invoke('cards:getVariations', name, number, setName),

  onPricesRefreshing: (cb) => ipcRenderer.on('prices:refreshing', cb),
  onPricesProgress: (cb) => ipcRenderer.on('prices:progress', (_e, data) => cb(data)),
  onPricesRefreshed: (cb) => ipcRenderer.on('prices:refreshed', cb),
  onCardsChanged: (cb) => ipcRenderer.on('cards:changed', cb),

  getCardShows: (stateCode, stateName) => ipcRenderer.invoke('cardshows:fetch', stateCode, stateName),
  getGeocodeBatch: (data) => ipcRenderer.invoke('geocode:batch', data),
  onGeocodeUpdate: (cb) => {
    const handler = (_e, data) => cb(data)
    ipcRenderer.on('geocode:update', handler)
    return () => ipcRenderer.removeListener('geocode:update', handler)
  },
  listUpcomingShows: () => ipcRenderer.invoke('upcoming:list'),
  addUpcomingShow: (show) => ipcRenderer.invoke('upcoming:add', show),
  removeUpcomingShow: (showId) => ipcRenderer.invoke('upcoming:remove', showId),

  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),

  windowMinimize: () => ipcRenderer.send('window:minimize'),
  windowMaximize: () => ipcRenderer.send('window:maximize'),
  windowClose: () => ipcRenderer.send('window:close'),

  auth: {
    isSetup: () => ipcRenderer.invoke('auth:isSetup'),
    isSessionValid: () => ipcRenderer.invoke('auth:isSessionValid'),
    createUser: (data) => ipcRenderer.invoke('auth:createUser', data),
    login: (data) => ipcRenderer.invoke('auth:login', data),
    logout: () => ipcRenderer.invoke('auth:logout'),
    getUsername: () => ipcRenderer.invoke('auth:getUsername'),
    getUserList: () => ipcRenderer.invoke('auth:getUserList'),
    getSecurityQuestion: () => ipcRenderer.invoke('auth:getSecurityQuestion'),
    getSecurityQuestionForUser: (data) => ipcRenderer.invoke('auth:getSecurityQuestionForUser', data),
    verifySecurityAnswer: (data) => ipcRenderer.invoke('auth:verifySecurityAnswer', data),
    verifySecurityAnswerForUser: (data) => ipcRenderer.invoke('auth:verifySecurityAnswerForUser', data),
    sendResetEmail: (data) => ipcRenderer.invoke('auth:sendResetEmail', data),
    verifyEmailCode: (data) => ipcRenderer.invoke('auth:verifyEmailCode', data),
    resetPassword: (data) => ipcRenderer.invoke('auth:resetPassword', data),
    changePassword: (data) => ipcRenderer.invoke('auth:changePassword', data),
    updateSecurityQuestion: (data) => ipcRenderer.invoke('auth:updateSecurityQuestion', data),
    setStayLoggedIn: (val) => ipcRenderer.invoke('auth:setStayLoggedIn', val),
    getStayLoggedIn: () => ipcRenderer.invoke('auth:getStayLoggedIn'),
  }
})
