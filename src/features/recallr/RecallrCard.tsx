import { useEffect, useMemo, useRef, useState } from 'react'

import { useLocalStorageState } from '../../lib/useLocalStorageState'
import { cn } from '../../lib/utils'
import { normalizeForCompare } from './compare'

type RecallrMode = 'copy' | 'initials' | 'every5' | 'quiz'

const MODE_LABEL: Record<RecallrMode, string> = {
  copy: 'Copy',
  initials: 'Initials',
  every5: 'Every 5',
  quiz: 'Quiz',
}

const MODE_LEVEL: Record<RecallrMode, number> = {
  copy: 1,
  initials: 2,
  every5: 3,
  quiz: 4,
}

function firstHintChar(word: string) {
  const m = word.match(/[A-Za-z0-9]/)
  return m?.[0] ?? ''
}

const STORAGE_VERSION = '3'
const STORAGE_VERSION_KEY = 'recallr:storageVersion'

export function RecallrCard() {
  const [mode, setMode] = useLocalStorageState<RecallrMode>('recallr:mode', 'copy')
  const [draftScript, setDraftScript] = useLocalStorageState('recallr:script:draft', '')
  const [submittedScript, setSubmittedScript] = useLocalStorageState('recallr:script:submitted', '')

  const [currentTyped, setCurrentTyped] = useLocalStorageState('recallr:currentWord', '')
  const [running, setRunning] = useLocalStorageState('recallr:running', false)
  const [progressIndex, setProgressIndex] = useLocalStorageState('recallr:progressIndex', 0)
  const [wrongIndices, setWrongIndices] = useLocalStorageState<number[]>(
    'recallr:wrongIndices',
    [],
  )
  const [lastWrong, setLastWrong] = useState(false)
  const typingRef = useRef<HTMLInputElement | null>(null)
  const draftRef = useRef<HTMLTextAreaElement | null>(null)

  function maskWord(word: string) {
    const norm = normalizeForCompare(word)
    if (!norm) return '____'
    const lead = firstHintChar(word) || norm[0]!
    return lead + '_'.repeat(Math.max(0, norm.length - 1))
  }

  // Ensure first-launch defaults (and reset old persisted state once).
  useEffect(() => {
    try {
      const existing = localStorage.getItem(STORAGE_VERSION_KEY)
      if (existing === STORAGE_VERSION) return

      localStorage.setItem(STORAGE_VERSION_KEY, STORAGE_VERSION)

      // Clear potentially stale session keys from earlier iterations.
      localStorage.removeItem('recallr:script:draft')
      localStorage.removeItem('recallr:script:submitted')
      localStorage.removeItem('recallr:currentWord')
      localStorage.removeItem('recallr:running')
      localStorage.removeItem('recallr:progressIndex')
      localStorage.removeItem('recallr:wrongIndices')
      localStorage.removeItem('recallr:mode')

      // Reset in-memory state to match default blank screen.
      setMode('copy')
      setDraftScript('')
      setSubmittedScript('')
      setCurrentTyped('')
      setRunning(false)
      setProgressIndex(0)
      setWrongIndices([])
      setLastWrong(false)
    } catch {
      // ignore (privacy mode / disabled storage)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const referenceWords = useMemo(
    () => submittedScript.trim().split(/\s+/).filter(Boolean),
    [submittedScript],
  )

  const wrongSet = useMemo(() => new Set(wrongIndices), [wrongIndices])
  const correctCount = useMemo(() => {
    const revealed = Math.min(progressIndex, referenceWords.length)
    let wrong = 0
    for (const idx of wrongIndices) if (idx >= 0 && idx < revealed) wrong += 1
    return Math.max(0, revealed - wrong)
  }, [progressIndex, referenceWords.length, wrongIndices])

  // If script changes (new submission), reset progress.
  useEffect(() => {
    const hasScript = submittedScript.trim().length > 0
    if (!hasScript) {
      setRunning(false)
      setProgressIndex(0)
      setWrongIndices([])
      setCurrentTyped('')
      setLastWrong(false)
      return
    }

    // New script submitted: reset session state, but don't force running=false
    // (Start should submit + run in one click).
    setProgressIndex(0)
    setWrongIndices([])
    setCurrentTyped('')
    setLastWrong(false)
  }, [submittedScript, setCurrentTyped, setProgressIndex, setRunning, setWrongIndices])

  const expectedRaw = referenceWords[progressIndex] ?? ''
  const expectedNormalized = useMemo(() => normalizeForCompare(expectedRaw), [expectedRaw])
  const typedNormalized = useMemo(() => normalizeForCompare(currentTyped), [currentTyped])

  // As soon as the typed word equals expected word, advance.
  useEffect(() => {
    if (!submittedScript) return
    if (!running) return
    if (!expectedNormalized) return
    if (!typedNormalized) {
      setLastWrong(false)
      return
    }

    if (typedNormalized === expectedNormalized) {
      setProgressIndex((i) => Math.min(i + 1, referenceWords.length))
      setCurrentTyped('')
      setLastWrong(false)
    } else if (expectedNormalized.startsWith(typedNormalized)) {
      setLastWrong(false)
    } else {
      // Don't mark wrong while user is still mid-word and could still match.
      setLastWrong(true)
    }
  }, [
    submittedScript,
    running,
    expectedNormalized,
    typedNormalized,
    referenceWords.length,
    setProgressIndex,
    setCurrentTyped,
  ])

  const score = useMemo(() => {
    if (!referenceWords.length) return 0
    return Math.round((correctCount / referenceWords.length) * 100)
  }, [correctCount, referenceWords.length])

  const onStart = () => {
    const next = draftScript.trim()
    if (!next) return
    setSubmittedScript(next)
    setDraftScript('')
    setRunning(true)
    setProgressIndex(0)
    setWrongIndices([])
    requestAnimationFrame(() => typingRef.current?.focus())
  }

  const onStop = () => {
    setRunning(false)
    setSubmittedScript('')
    setProgressIndex(0)
    setWrongIndices([])
    setCurrentTyped('')
    setLastWrong(false)
    requestAnimationFrame(() => draftRef.current?.focus())
  }

  const onNextWord = () => {
    if (!running) return
    if (progressIndex >= referenceWords.length) return
    setWrongIndices((prev) => (prev.includes(progressIndex) ? prev : [...prev, progressIndex]))
    setProgressIndex((i) => Math.min(i + 1, referenceWords.length))
    setCurrentTyped('')
    setLastWrong(false)
  }

  // Auto-stop when finished.
  useEffect(() => {
    if (!running) return
    if (referenceWords.length > 0 && progressIndex >= referenceWords.length) {
      setRunning(false)
      setCurrentTyped('')
      setLastWrong(false)
      // Put the original text back so "Start" is immediately available again.
      setDraftScript(submittedScript)
    }
  }, [
    progressIndex,
    referenceWords.length,
    running,
    setRunning,
    setCurrentTyped,
    setDraftScript,
    submittedScript,
    mode,
    setMode,
  ])

  const nextWordEnabled = running && progressIndex < referenceWords.length

  const onSelectMode = (id: RecallrMode) => {
    // Manual progression: changing mode resets session state, but keeps draft text
    // (which is already restored after completion).
    setMode(id)
    setRunning(false)
    setProgressIndex(0)
    setWrongIndices([])
    setCurrentTyped('')
    setLastWrong(false)
    // Ensure the display clears until Start is pressed again.
    setSubmittedScript('')
    requestAnimationFrame(() => draftRef.current?.focus())
  }

  return (
    <div className="h-full w-full flex flex-col gap-4 min-h-0">
      <div className="w-full bg-white border shadow-sm rounded-xl p-1">
        <div className="grid grid-cols-4 gap-1">
          {(Object.keys(MODE_LABEL) as RecallrMode[]).map((id) => (
            <button
              key={id}
              className={cn(
                'w-full px-3 py-2 rounded-lg text-sm font-semibold text-center',
                mode === id ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100',
              )}
              onClick={() => onSelectMode(id)}
            >
              {MODE_LEVEL[id]}. {MODE_LABEL[id]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 w-full flex flex-row gap-6">
      {/* Left Panel - Display */}
      <div className="w-3/5 bg-white p-6 shadow-md rounded-2xl flex flex-col min-h-0 overflow-hidden">
        <div className="text-xl leading-relaxed whitespace-pre-wrap space-y-2 flex-1 min-h-0 overflow-y-auto pr-2">
            {referenceWords.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {referenceWords.map((w, idx) => (
                  idx < progressIndex ? (
                    <span
                      key={idx}
                      className={wrongSet.has(idx) ? 'text-red-500' : 'text-green-600'}
                    >
                      {w}
                    </span>
                  ) : mode === 'copy' ? (
                    <span key={idx} className="text-black">
                      {w}
                    </span>
                  ) : mode === 'initials' ? (
                    <span key={idx} className="text-black select-none">
                      {maskWord(w)}
                    </span>
                  ) : mode === 'every5' ? (
                    <span
                      key={idx}
                      className={(idx + 1) % 5 === 0 ? 'text-black' : 'text-black blur-sm select-none'}
                    >
                      {w}
                    </span>
                  ) : (
                    <span key={idx} className="text-black blur-sm select-none">
                      {w}
                    </span>
                  )
                ))}
              </div>
            ) : null}
        </div>
      </div>

      {/* Right Panel - Input + Typing + Score */}
      <div className="w-2/5 flex flex-col min-h-0 gap-3">
        {/* Input + Typing */}
        <div className="bg-white p-6 shadow-md rounded-2xl shrink-0">
          <h2 className="text-2xl font-semibold mb-1">Input Text</h2>
          <textarea
            ref={(el) => {
              draftRef.current = el
            }}
            value={draftScript}
            onChange={(e) => setDraftScript(e.target.value)}
            placeholder="Paste your reference script here..."
            className="w-full h-[120px] p-4 bg-white border rounded-2xl resize-none text-base font-normal placeholder:text-gray-400 text-black"
            disabled={running}
          />

          <div className="flex justify-between mt-3 gap-3">
            <button
              onClick={onStart}
              className={`w-full py-2 text-white rounded ${
                !running && draftScript.trim()
                  ? 'bg-green-500 hover:bg-green-600'
                  : 'bg-gray-400 cursor-not-allowed'
              }`}
              disabled={running || !draftScript.trim()}
            >
              Start
            </button>

            <button
              onClick={onStop}
              className={`w-full py-2 text-white rounded ${
                running ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-400 cursor-not-allowed'
              }`}
              disabled={!running}
            >
              Stop
            </button>

            <button
              onClick={onNextWord}
              disabled={!nextWordEnabled}
              className={`w-full py-2 rounded ${
                nextWordEnabled
                  ? 'bg-yellow-400 hover:bg-yellow-500 text-black'
                  : 'bg-gray-400 text-white cursor-not-allowed'
              }`}
            >
              Next Word
            </button>
          </div>

          <div className="mt-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xl font-semibold">Type</h3>
            </div>
            <input
              ref={(el) => {
                typingRef.current = el
              }}
              value={currentTyped}
              onChange={(e) => setCurrentTyped(e.target.value)}
              placeholder={
                running
                  ? 'Type next word...'
                  : submittedScript.trim()
                    ? 'Press Start to begin...'
                    : 'Start by pasting text...'
              }
              disabled={!running || progressIndex >= referenceWords.length}
              className={cn(
                'w-full h-10 px-4 bg-white border rounded-2xl text-base font-normal placeholder:text-gray-400 text-black',
                lastWrong && 'border-red-500/60 ring-1 ring-red-500/20',
              )}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
            />
          </div>
        </div>

        {/* Score Panel */}
        <div className="bg-white p-6 shadow-md rounded-2xl flex flex-col flex-1 min-h-0">
          <h2 className="text-2xl font-semibold mb-1">Scoring</h2>
          <div className="bg-white border rounded-2xl flex-1 flex items-center justify-center min-h-0 overflow-hidden">
            <p className="text-6xl font-bold text-gray-800 leading-none">{score}%</p>
          </div>
        </div>
      </div>
    </div>
    </div>
  )
}

