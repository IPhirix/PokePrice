import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info?.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="h-full flex flex-col items-center justify-center gap-4 bg-surface-900 text-slate-400 p-8">
          <svg className="w-12 h-12 text-red-500/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <div className="text-center">
            <p className="text-white font-semibold text-lg mb-1">Something went wrong</p>
            <p className="text-slate-500 text-sm mb-1 font-mono">{this.state.error?.message}</p>
          </div>
          <button
            onClick={() => this.setState({ error: null })}
            className="px-5 py-2 bg-accent hover:bg-accent-hover text-black font-bold rounded-lg text-sm transition-colors"
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
