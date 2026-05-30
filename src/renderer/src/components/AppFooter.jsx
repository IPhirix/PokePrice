import { useState, useEffect } from 'react'

const MODAL_CONTENT = {
  'Help Center / Q&A': {
    title: 'Help Center & Q&A',
    body: (
      <div className="space-y-4">
        <div>
          <p className="font-semibold text-slate-200 mb-1">How do I add a card to my portfolio?</p>
          <p className="text-slate-400">Use the search bar at the top of the app to find any Pokémon card, then click "Add to Portfolio" or "Add to Watchlist".</p>
        </div>
        <div>
          <p className="font-semibold text-slate-200 mb-1">How are prices updated?</p>
          <p className="text-slate-400">Prices are pulled from PriceCharting and refresh automatically every day at 8am. You can also trigger a manual refresh from the Dashboard.</p>
        </div>
        <div>
          <p className="font-semibold text-slate-200 mb-1">What conditions are supported?</p>
          <p className="text-slate-400">Raw, PSA 10, PSA 9, PSA 8, CGC 10, and CGC 9 grades are all supported.</p>
        </div>
        <div>
          <p className="font-semibold text-slate-200 mb-1">How do I set price alerts?</p>
          <p className="text-slate-400">Open any card's detail page and set a target buy or sell price. You'll be notified when prices cross those thresholds.</p>
        </div>
        <div>
          <p className="font-semibold text-slate-200 mb-1">Can I track multiple currencies?</p>
          <p className="text-slate-400">Yes — open Settings and choose your preferred currency. Prices will be converted using live exchange rates.</p>
        </div>
      </div>
    )
  },
  'Contact Us': {
    title: 'Contact Us',
    body: (
      <div className="space-y-4">
        <p className="text-slate-400">Have a question, bug report, or feature request? We'd love to hear from you.</p>
        <div className="bg-surface-800 rounded-lg p-4 space-y-2">
          <p className="text-slate-300 text-sm"><span className="text-slate-500">Email</span><br />support@pokeprice.app</p>
        </div>
        <p className="text-slate-500 text-sm">We typically respond within 1–2 business days. For faster support, join the Discord community.</p>
      </div>
    )
  },
  'Join Discord': {
    title: 'Join Our Discord',
    body: (
      <div className="space-y-4 text-center">
        <div className="text-5xl">💬</div>
        <p className="text-slate-300 font-semibold text-lg">Connect with the PokePrice community</p>
        <p className="text-slate-400">Get help, share your collection, discuss market trends, and be the first to hear about new features.</p>
        <a
          href="https://discord.gg/pokeprice"
          target="_blank"
          rel="noreferrer"
          className="inline-block mt-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold transition-colors"
        >
          Join the Server
        </a>
      </div>
    )
  },
  'About Us': {
    title: 'About PokePrice',
    body: (
      <div className="space-y-4">
        <p className="text-slate-400">PokePrice is a desktop app built for Pokémon card collectors who want to track the value of their collections with precision and ease.</p>
        <p className="text-slate-400">We pull real-time market data from trusted sources so you always know what your cards are worth — whether they're raw or graded.</p>
        <div className="bg-surface-800 rounded-lg p-4 space-y-1">
          <p className="text-slate-500 text-xs uppercase tracking-widest mb-2">Features</p>
          <ul className="text-slate-400 text-sm space-y-1 list-disc list-inside">
            <li>Portfolio &amp; watchlist tracking</li>
            <li>Historical price charts</li>
            <li>Graded card support (PSA, CGC)</li>
            <li>Multi-currency support</li>
            <li>Daily automatic price refreshes</li>
            <li>Trade analyzer</li>
          </ul>
        </div>
      </div>
    )
  },
  'Privacy Policy': {
    title: 'Privacy Policy',
    body: (
      <div className="space-y-4 text-sm">
        <p className="text-slate-400">Last updated: May 2026</p>
        <p className="text-slate-400">PokePrice is a local desktop application. Your card data, portfolio, and settings are stored entirely on your own device and are never uploaded to any server.</p>
        <div>
          <p className="font-semibold text-slate-200 mb-1">Data We Collect</p>
          <p className="text-slate-400">We do not collect personal information. Price data is fetched from third-party APIs (PriceCharting) using your API key, which is stored locally on your device.</p>
        </div>
        <div>
          <p className="font-semibold text-slate-200 mb-1">Third-Party Services</p>
          <p className="text-slate-400">PokePrice connects to PriceCharting and the Pokémon TCG API to retrieve card data and pricing. Please review their respective privacy policies for details on their data practices.</p>
        </div>
        <div>
          <p className="font-semibold text-slate-200 mb-1">Changes</p>
          <p className="text-slate-400">We may update this policy from time to time. Continued use of the app constitutes acceptance of any changes.</p>
        </div>
      </div>
    )
  },
  'Terms & Conditions': {
    title: 'Terms & Conditions',
    body: (
      <div className="space-y-4 text-sm">
        <p className="text-slate-400">Last updated: May 2026</p>
        <div>
          <p className="font-semibold text-slate-200 mb-1">Use of the App</p>
          <p className="text-slate-400">PokePrice is provided for personal, non-commercial use. You may not reverse-engineer, redistribute, or resell this software.</p>
        </div>
        <div>
          <p className="font-semibold text-slate-200 mb-1">Price Data Disclaimer</p>
          <p className="text-slate-400">Prices displayed are sourced from third-party marketplaces and are estimates only. PokePrice makes no guarantee of accuracy and is not responsible for any financial decisions made based on this data.</p>
        </div>
        <div>
          <p className="font-semibold text-slate-200 mb-1">Limitation of Liability</p>
          <p className="text-slate-400">PokePrice is provided "as is" without warranty of any kind. We are not liable for any damages arising from use of the application.</p>
        </div>
        <div>
          <p className="font-semibold text-slate-200 mb-1">Contact</p>
          <p className="text-slate-400">Questions about these terms? Email us at support@pokeprice.app.</p>
        </div>
      </div>
    )
  }
}

const NAV_LINKS = ['Help Center / Q&A', 'Contact Us', 'Join Discord', 'About Us', 'Privacy Policy', 'Terms & Conditions']

function FooterModal({ link, onClose }) {
  const content = MODAL_CONTENT[link]
  if (!content) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative w-full max-w-xl mx-4 bg-surface-900 border border-surface-700 rounded-xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-700">
          <span className="font-bold text-slate-100">{content.title}</span>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 transition-colors text-lg leading-none"
          >
            ✕
          </button>
        </div>
        <div className="px-5 py-4">
          {content.body}
        </div>
      </div>
    </div>
  )
}

export default function AppFooter({ refreshKey }) {
  const [version, setVersion] = useState('')
  const [activeModal, setActiveModal] = useState(null)

  useEffect(() => {
    window.api.getAppVersion().then(setVersion)
  }, [])

  return (
    <>
      <div className="flex-shrink-0 flex items-center px-5 py-2.5 bg-surface-900 border-t border-surface-600">
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] font-black tracking-[0.18em] uppercase text-slate-500">PokePrice</span>
          <span className="text-slate-700 select-none">·</span>
          <span className="text-[11px] text-slate-600">v{version}</span>
        </div>
        <div className="flex items-center justify-center flex-1">
          {NAV_LINKS.map((link, i) => (
            <span key={link} className="flex items-center">
              {i > 0 && <span className="text-slate-700 text-[11px] select-none px-2">·</span>}
              <button
                onClick={() => setActiveModal(link)}
                className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors whitespace-nowrap px-2"
              >
                {link}
              </button>
            </span>
          ))}
        </div>
      </div>

      {activeModal && (
        <FooterModal link={activeModal} onClose={() => setActiveModal(null)} />
      )}
    </>
  )
}
