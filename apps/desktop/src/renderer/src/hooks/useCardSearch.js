import { useState, useEffect } from 'react'

export function useCardSearch({ initialPageSize = 40, pageIncrement = 20, extraQuery = '' } = {}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [searchCommitted, setSearchCommitted] = useState(false)
  const [displayCount, setDisplayCount] = useState(initialPageSize)
  const [error, setError] = useState(null)

  useEffect(() => { setDisplayCount(initialPageSize) }, [results]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleQueryChange(e) {
    setQuery(e.target.value)
    setSearchCommitted(false)
  }

  function search(q) {
    const full = extraQuery ? `${q} ${extraQuery}` : q
    return window.api.searchCardsAdvanced(full).catch(() => [])
  }

  async function handleSearch() {
    const q = query.trim()
    if (!q && !extraQuery) return
    setSearching(true)
    setSearchCommitted(true)
    setResults([])
    setError(null)
    try {
      // Filters only — no name query
      if (!q) {
        const merged = await window.api.searchCardsAdvanced(extraQuery).catch(() => [])
        setResults(merged)
        return
      }
      // "Charizard #4" or "Charizard #04" — explicit card number
      const hashMatch = q.match(/^(.*?)\s*#(\w+)\s*$/)
      if (hashMatch) {
        const name = hashMatch[1].trim()
        const rawNum = hashMatch[2]
        const targetNum = parseInt(rawNum, 10)
        const isNumeric = !isNaN(targetNum)
        if (name) {
          const allCards = await search(`name:"${name}*"`)
          const matched = []; const rest = []
          for (const c of allCards) {
            const cn = String(c.number || '')
            const hits = isNumeric ? parseInt(cn, 10) === targetNum : cn.toUpperCase() === rawNum.toUpperCase()
            if (hits) matched.push(c); else rest.push(c)
          }
          setResults(matched.length > 0 && rest.length > 0
            ? [...matched, { _divider: true, id: '__divider__' }, ...rest]
            : [...matched, ...rest])
        } else {
          const numVariants = isNumeric
            ? [...new Set([rawNum, String(targetNum), String(targetNum).padStart(3, '0')])]
            : [rawNum]
          const batches = await Promise.all(numVariants.map((v) => search(`number:"${v}"`)))
          const seen = new Set(); const merged = []
          for (const batch of batches) for (const c of batch) if (!seen.has(c.id)) { seen.add(c.id); merged.push(c) }
          setResults(merged)
        }
        return
      }
      // "Charizard 4" — trailing number may be card number or set identifier
      const trailingMatch = q.match(/^(.+?)\s+(\d+)\s*$/)
      if (trailingMatch) {
        const name = trailingMatch[1].trim()
        const rawNum = trailingMatch[2]
        const targetNum = parseInt(rawNum, 10)
        const [allCards, setCards] = await Promise.all([
          search(`name:"${name}*"`),
          search(`name:"${name}*" set.name:"${rawNum}"`),
        ])
        const seen = new Set(); const matched = []; const rest = []
        for (const c of allCards) if (parseInt(String(c.number || ''), 10) === targetNum && !seen.has(c.id)) { seen.add(c.id); matched.push(c) }
        for (const c of setCards) if (!seen.has(c.id)) { seen.add(c.id); rest.push(c) }
        for (const c of allCards) if (!seen.has(c.id)) { seen.add(c.id); rest.push(c) }
        setResults(matched.length > 0 && rest.length > 0
          ? [...matched, { _divider: true, id: '__divider__' }, ...rest]
          : [...matched, ...rest])
        return
      }
      // Plain text: search by card name, set name, and every word-split name+set combo in parallel
      const words = q.split(/\s+/)
      const allSearches = [
        search(`name:"${q}*"`),
        search(`set.name:"${q}"`),
      ]
      for (let i = 1; i < words.length; i++) {
        const namePart = words.slice(0, i).join(' ')
        const setPart = words.slice(i).join(' ')
        allSearches.push(search(`name:"${namePart}*" set.name:"${setPart}"`))
      }
      const allBatches = await Promise.all(allSearches)
      const seen = new Set(); const merged = []
      for (const batch of allBatches) for (const card of batch) if (!seen.has(card.id)) { seen.add(card.id); merged.push(card) }
      setResults(merged)
    } catch {
      setError('Search failed. Check your internet connection.')
      setResults([])
    } finally {
      setSearching(false)
    }
  }

  function loadMore() {
    setDisplayCount((prev) => Math.min(prev + pageIncrement, results.length))
  }

  function clearSearch() {
    setQuery('')
    setResults([])
    setSearchCommitted(false)
    setDisplayCount(initialPageSize)
    setError(null)
  }

  return { query, results, searching, searchCommitted, displayCount, error, handleQueryChange, handleSearch, loadMore, clearSearch }
}
