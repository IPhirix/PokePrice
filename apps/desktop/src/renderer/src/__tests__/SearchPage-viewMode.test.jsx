/**
 * Regression test for the mixed grid/table results bug.
 *
 * Bug: on the Advanced Search "Items" tab, sealed-product results were always
 * rendered as a hardcoded row-list, regardless of the grid/table toggle. A
 * name search that matched both cards and sealed products showed the card
 * results in whichever format the toggle selected, but the sealed products
 * below always rendered as list rows — producing a page with a grid on top
 * and table-like rows underneath at the same time.
 *
 * These tests assert that for a search returning both cards and sealed
 * products, exactly one visual format (grid OR table) is present at once,
 * matching the active view-mode toggle.
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { CurrencyProvider } from '../context/CurrencyContext'
import SearchPage from '../pages/SearchPage'

const mockCard = {
  id: 'swsh1-1',
  name: 'Zekrom',
  number: '1',
  set: { id: 'swsh1', name: 'Sword & Shield', series: 'Sword & Shield' },
  images: { small: null },
}

const mockSealedProduct = {
  id: 'p1',
  name: 'Zekrom Premium Collection',
  setName: 'Sword & Shield',
  prices: { market: 24.99 },
}

function installApiMock() {
  global.fetch = vi.fn(() => Promise.resolve({ json: () => Promise.resolve({}) }))
  global.window.api = {
    listCards: vi.fn().mockResolvedValue([]),
    listSets: vi.fn().mockResolvedValue([]),
    listBinders: vi.fn().mockResolvedValue([]),
    getSettings: vi.fn().mockResolvedValue({}),
    getLocale: vi.fn().mockResolvedValue('en-US'),
    setSettings: vi.fn().mockResolvedValue(undefined),
    searchCardsAdvanced: vi.fn((q) => {
      // Background per-card detail enrichment and the unresolved
      // set.name:"Zekrom" fallback both return nothing here — only the
      // plain name search should surface the card.
      if (q.includes('id:"') || q.includes('set.name:')) return Promise.resolve([])
      return Promise.resolve([mockCard])
    }),
    searchSealed: vi.fn().mockResolvedValue({ products: [mockSealedProduct] }),
  }
}

function renderSearchPage() {
  return render(
    <CurrencyProvider>
      <SearchPage initialQuery="Zekrom" onCardAdded={() => {}} />
    </CurrencyProvider>,
  )
}

describe('SearchPage — grid/table results never mix', () => {
  beforeEach(() => {
    installApiMock()
  })

  it('renders both the card and the sealed product as grid tiles (not table rows) in grid mode', async () => {
    renderSearchPage()

    const cardName = await screen.findByText('Zekrom')
    const sealedName = await screen.findByText('Zekrom Premium Collection')

    // Neither result may live inside a <table> while grid mode is active —
    // this is exactly what the bug produced for the sealed product.
    expect(cardName.closest('table')).toBeNull()
    expect(sealedName.closest('table')).toBeNull()
    expect(document.querySelector('table')).toBeNull()

    // Both must live inside the css-grid results container.
    expect(cardName.closest('.grid-cols-2')).not.toBeNull()
    expect(sealedName.closest('.grid-cols-2')).not.toBeNull()
  })

  it('renders both the card and the sealed product as table rows (not grid tiles) in table mode', async () => {
    renderSearchPage()

    await screen.findByText('Zekrom')
    await screen.findByText('Zekrom Premium Collection')

    fireEvent.click(screen.getByRole('button', { name: /table/i }))

    const cardName = await screen.findByText('Zekrom')
    const sealedName = await screen.findByText('Zekrom Premium Collection')

    // Both must now live inside a <tr>, inside a <table> — never a css-grid tile.
    expect(cardName.closest('tr')).not.toBeNull()
    expect(sealedName.closest('tr')).not.toBeNull()
    expect(cardName.closest('table')).not.toBeNull()
    expect(sealedName.closest('table')).not.toBeNull()
    expect(document.querySelector('.grid-cols-2')).toBeNull()
  })
})
