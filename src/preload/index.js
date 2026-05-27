const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  searchCards: (query) => ipcRenderer.invoke('cards:search', query),
  searchCardsAdvanced: (query) => ipcRenderer.invoke('cards:search-advanced', query),
  listCards: () => ipcRenderer.invoke('cards:list'),
  addCard: (tcgCard, condition, quantity, section, purchasePrice, binder) =>
    ipcRenderer.invoke('cards:add', tcgCard, condition, quantity, section, purchasePrice, binder),
  removeCard: (id) => ipcRenderer.invoke('cards:remove', id),
  updateCard: (id, updates) => ipcRenderer.invoke('cards:update', id, updates),
  getPriceHistory: (cardId) => ipcRenderer.invoke('prices:history', cardId),
  refreshPrices: (cardId, section) => ipcRenderer.invoke('prices:refresh', cardId, section),
  refreshFromCsv: () => ipcRenderer.invoke('prices:refreshCsv'),
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

  getCloudDates: () => ipcRenderer.invoke('prices:cloudDates'),
  backfillCard: (cardId) => ipcRenderer.invoke('prices:backfillCard', cardId),

  getAccountStats: () => ipcRenderer.invoke('account:getStats'),
  clearAccountData: (target) => ipcRenderer.invoke('account:clear', target),
  deleteAccount: () => ipcRenderer.invoke('account:delete'),
  getActivity: () => ipcRenderer.invoke('account:getActivity'),
  removeActivity: (id) => ipcRenderer.invoke('account:removeActivity', id),

  getAppVersion: () => ipcRenderer.invoke('app:version'),
  getLocale: () => ipcRenderer.invoke('app:locale'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (s) => ipcRenderer.invoke('settings:set', s),
  searchPriceCharting: (query) => ipcRenderer.invoke('pc:search', query),
  getAllConditionPrices: (cardId) => ipcRenderer.invoke('prices:allConditions', cardId),

  onPricesRefreshing: (cb) => ipcRenderer.on('prices:refreshing', cb),
  onPricesProgress: (cb) => ipcRenderer.on('prices:progress', (_e, data) => cb(data)),
  onPricesRefreshed: (cb) => ipcRenderer.on('prices:refreshed', cb),

  windowMinimize: () => ipcRenderer.send('window:minimize'),
  windowMaximize: () => ipcRenderer.send('window:maximize'),
  windowClose: () => ipcRenderer.send('window:close')
})
