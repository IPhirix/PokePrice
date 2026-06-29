import { useState, useEffect, useImperativeHandle, forwardRef } from 'react'

const FolderSelector = forwardRef(function FolderSelector({ section, value, onChange, className = '', compact = false }, ref) {
  const [folders, setFolders] = useState([])
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [dupError, setDupError] = useState(false)

  useEffect(() => {
    if (section) {
      window.api.listFolders(section).then(setFolders).catch(() => {})
    }
  }, [section])

  // Called by parent add-handlers so a typed-but-uncreated folder is saved
  useImperativeHandle(ref, () => ({
    async ensureAndGetFolder() {
      if (!showNew || !newName.trim()) return value || null
      const name = newName.trim()
      if (folders.some((f) => f.toLowerCase() === name.toLowerCase())) {
        setDupError(true)
        return null
      }
      await window.api.addFolder(section, name)
      const fresh = await window.api.listFolders(section)
      setFolders(fresh)
      setShowNew(false)
      setNewName('')
      setDupError(false)
      onChange(name)
      return name
    }
  }), [showNew, newName, value, section, onChange, folders])

  async function createFolder() {
    const name = newName.trim()
    if (!name) return
    if (folders.some((f) => f.toLowerCase() === name.toLowerCase())) {
      setDupError(true)
      return
    }
    setCreating(true)
    setDupError(false)
    try {
      await window.api.addFolder(section, name)
      const fresh = await window.api.listFolders(section)
      setFolders(fresh)
      setShowNew(false)
      setNewName('')
      onChange(name)
    } finally {
      setCreating(false)
    }
  }

  if (showNew) {
    return (
      <div className={`flex flex-col gap-1 ${className}`}>
        <div className="flex items-center gap-1">
          <input
            autoFocus
            value={newName}
            onChange={(e) => { setNewName(e.target.value); setDupError(false) }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') createFolder()
              if (e.key === 'Escape') { setShowNew(false); setNewName(''); setDupError(false) }
            }}
            placeholder="Folder name…"
            className={`flex-1 bg-surface-700 border rounded px-2.5 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none ${dupError ? 'border-red-500 focus:border-red-500' : 'border-surface-500 focus:border-accent'}`}
          />
          <button
            onClick={createFolder}
            disabled={!newName.trim() || creating}
            className="bg-accent disabled:opacity-50 text-black text-xs px-2.5 py-1.5 rounded font-semibold"
          >
            {creating ? '…' : 'Create'}
          </button>
          <button
            onClick={() => { setShowNew(false); setNewName(''); setDupError(false) }}
            className="text-slate-500 hover:text-white text-sm px-1.5"
          >
            ✕
          </button>
        </div>
        {dupError && <p className="text-red-400 text-xs">A folder with this name already exists.</p>}
      </div>
    )
  }

  const sizeClasses = compact ? 'rounded px-2 py-1.5' : 'rounded-lg px-3 py-2.5'
  return (
    <select
      value={value || ''}
      onChange={(e) => {
        if (e.target.value === '__new__') { setShowNew(true) }
        else { onChange(e.target.value) }
      }}
      className={`bg-surface-700 border border-surface-500 text-sm text-white focus:outline-none focus:border-accent ${sizeClasses} ${className}`}
    >
      <option value="">No folder</option>
      {folders.map((f) => (
        <option key={f} value={f}>{f}</option>
      ))}
      <option value="__new__">+ New folder…</option>
    </select>
  )
})

export default FolderSelector
