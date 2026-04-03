import { useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Trash2, Copy, AlertCircle } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import type { LogEntry } from '@/types'

const LOG_ICONS: Record<LogEntry['type'], string> = {
  info:    'ℹ️', success: '✅', warn: '⚠️',
  error:   '❌', api:     '🌐', llm: '🤖', storage: '💾',
}
const LOG_COLORS: Record<LogEntry['type'], string> = {
  info:    'text-white/60', success: 'text-green-400',
  warn:    'text-yellow-400', error:  'text-red-400',
  api:     'text-eu-sky',   llm:     'text-purple-400',
  storage: 'text-eu-muted',
}

export default function LogTab() {
  const { logs, clearLogs } = useAppStore()
  const bottomRef = useRef<HTMLDivElement>(null)
  const errorCount = logs.filter(l => l.type === 'error').length

  function copyLog() {
    const text = logs.map(l =>
      `[${l.timestamp.toLocaleTimeString()}] [${l.type.toUpperCase()}] ${l.message}`
    ).join('\n')
    navigator.clipboard.writeText(text)
  }

  return (
    <div className="flex flex-col h-full px-4 py-5 gap-4">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2">
        <p className="text-sm font-semibold text-white flex-1">Application Log</p>
        {errorCount > 0 && (
          <div className="flex items-center gap-1.5 bg-red-500/15 border border-red-500/20 rounded-full px-2.5 py-1">
            <AlertCircle size={12} className="text-red-400" />
            <span className="text-xs text-red-400">{errorCount} error{errorCount !== 1 ? 's' : ''}</span>
          </div>
        )}
        <button className="btn-ghost px-3 py-2" onClick={copyLog}>
          <Copy size={14} />
        </button>
        <button className="btn-ghost px-3 py-2 text-red-400/60" onClick={clearLogs}>
          <Trash2 size={14} />
        </button>
      </motion.div>

      {/* Log list */}
      <div className="flex-1 glass overflow-y-auto">
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <span className="text-3xl mb-2">📋</span>
            <p className="text-xs text-eu-muted">No log entries yet</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {logs.map((entry, i) => (
              <motion.div key={entry.id}
                initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i * 0.02, 0.3) }}
                className="flex items-start gap-2.5 px-3 py-2.5">
                <span className="text-sm shrink-0 mt-0.5">{LOG_ICONS[entry.type]}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs leading-relaxed ${LOG_COLORS[entry.type]}`}>{entry.message}</p>
                  <p className="text-[10px] text-white/20 mt-0.5 font-mono">
                    {entry.timestamp.toLocaleTimeString('it-IT')}
                  </p>
                </div>
              </motion.div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>
    </div>
  )
}
