import { useCallback, useEffect, useRef, useState } from 'react'
import Cover from './Cover'
import { CloseIcon, CheckIcon, PlusIcon } from './Icons'
import { startScanner, cameraAvailable, cameraMessage, isValidBarcode, cleanBarcode } from '../lib/barcode'
import { searchByBarcode, itemKey } from '../lib/discogs'

const RESUME_MS = 1100 // pause après un ajout, avant de scanner le suivant

function Corner({ className }) {
  return <span aria-hidden="true" className={`absolute h-7 w-7 border-sun ${className}`} />
}

// Scanner de codes-barres : vise le dos de la pochette, le disque s'ajoute à ta
// collection (ou à tes souhaits) et on enchaîne avec le suivant.
// statusOf(item) : 'wish' | 'owned' | null ; onAdd(item, status) et onGotIt(item)
// renvoient le disque enregistré (ou null en cas d'échec).
export default function BarcodeScanner({ statusOf, onAdd, onGotIt, onClose, offline }) {
  const videoRef = useRef(null)
  const scannerRef = useRef(null)
  const pausedRef = useRef(false)
  const lastRef = useRef({ code: null, at: 0 })
  const resumeTimer = useRef(null)

  const [camera, setCamera] = useState(cameraAvailable() ? 'starting' : 'off') // starting | on | off
  const [cameraError, setCameraError] = useState(cameraAvailable() ? null : cameraMessage({ name: 'NotFoundError' }))
  const [phase, setPhase] = useState('scan') // scan | looking | result | notfound
  const [code, setCode] = useState(null)
  const [result, setResult] = useState(null) // { items, notVinyl }
  const [busyKey, setBusyKey] = useState(null)
  const [done, setDone] = useState(null) // { key, status } : ajout réussi, en attente du suivant
  const [lookupError, setLookupError] = useState(null)
  const [manual, setManual] = useState('')
  const [manualError, setManualError] = useState(null)
  const [session, setSession] = useState([]) // disques ajoutés pendant ce scan

  const resume = useCallback(() => {
    clearTimeout(resumeTimer.current)
    pausedRef.current = false
    setPhase('scan')
    setResult(null)
    setCode(null)
    setDone(null)
    setLookupError(null)
  }, [])

  // Code lu (caméra ou saisie) -> recherche sur Discogs
  const lookup = useCallback(async (raw) => {
    const value = cleanBarcode(raw)
    pausedRef.current = true
    setCode(value)
    setPhase('looking')
    setLookupError(null)
    setDone(null)
    navigator.vibrate?.(40)
    try {
      const found = await searchByBarcode(value)
      setResult(found)
      setPhase(found.items.length ? 'result' : 'notfound')
    } catch (e) {
      setLookupError(e.message)
      setPhase('notfound')
    }
  }, [])

  const onDetected = useCallback(
    (raw) => {
      if (pausedRef.current) return
      const value = cleanBarcode(raw)
      if (!isValidBarcode(value)) return // lecture ratée : on attend une meilleure image
      // Le même code juste après un ajout : on l'ignore quelques secondes
      const now = Date.now()
      if (value === lastRef.current.code && now - lastRef.current.at < 4000) return
      lastRef.current = { code: value, at: now }
      lookup(value)
    },
    [lookup]
  )

  // Caméra
  useEffect(() => {
    if (!cameraAvailable()) return
    let cancelled = false
    startScanner(videoRef.current, onDetected)
      .then((s) => {
        if (cancelled) return s.stop()
        scannerRef.current = s
        setCamera('on')
      })
      .catch((e) => {
        if (cancelled) return
        setCamera('off')
        setCameraError(cameraMessage(e))
      })
    return () => {
      cancelled = true
      scannerRef.current?.stop()
      scannerRef.current = null
    }
  }, [onDetected])

  useEffect(() => () => clearTimeout(resumeTimer.current), [])

  // Fermeture avec Échap
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function add(item, status) {
    const key = itemKey(item)
    setBusyKey(key)
    const current = statusOf(item)
    const saved = current === 'wish' && status === 'owned' ? await onGotIt(item) : await onAdd(item, status)
    setBusyKey(null)
    if (!saved) return
    setDone({ key, status })
    setSession((s) => [{ ...item, status, at: Date.now() }, ...s.filter((x) => itemKey(x) !== key)])
    lastRef.current = { code, at: Date.now() }
    resumeTimer.current = setTimeout(resume, RESUME_MS)
  }

  function submitManual(e) {
    e.preventDefault()
    const value = cleanBarcode(manual)
    if (!isValidBarcode(value)) {
      setManualError('Ce code ne semble pas valide : vérifie les 12 ou 13 chiffres sous les barres.')
      return
    }
    setManualError(null)
    setManual('')
    lookup(value)
  }

  const scanning = phase === 'scan' && camera === 'on'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/85 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Scanner un code-barres"
        className="animate-pop flex max-h-[96vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-accent text-ink shadow-2xl shadow-black/60 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-5 sm:px-6">
          <div>
            <h3 className="font-display text-4xl font-black uppercase leading-[0.85]">
              Scanne tes
              <br />
              disques.
            </h3>
            <p className="mt-2 text-sm text-ink/75">Vise le code-barres au dos de la pochette.</p>
          </div>
          <button onClick={onClose} aria-label="Fermer" className="-mr-1 rounded-full p-1.5 text-ink/80 transition hover:bg-ink/15 hover:text-ink">
            <CloseIcon width={22} height={22} />
          </button>
        </div>

        <div className="nice-scroll min-h-0 flex-1 overflow-y-auto px-5 pb-5 sm:px-6">
          {/* Caméra */}
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-black">
            <video
              ref={videoRef}
              muted
              playsInline
              autoPlay
              aria-label="Image de la caméra"
              className={`h-full w-full object-cover transition-opacity duration-300 ${camera === 'on' ? 'opacity-100' : 'opacity-0'}`}
            />

            {camera === 'on' && (
              <div aria-hidden="true" className="pointer-events-none absolute inset-x-[12%] inset-y-[22%]">
                <Corner className="left-0 top-0 rounded-tl-lg border-l-4 border-t-4" />
                <Corner className="right-0 top-0 rounded-tr-lg border-r-4 border-t-4" />
                <Corner className="bottom-0 left-0 rounded-bl-lg border-b-4 border-l-4" />
                <Corner className="bottom-0 right-0 rounded-br-lg border-b-4 border-r-4" />
                {scanning && <span className="scan-line absolute inset-x-2 h-0.5 rounded-full bg-coral shadow-[0_0_14px_2px_rgba(236,91,62,0.8)]" />}
              </div>
            )}

            {camera === 'starting' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-sm text-ink/80">
                <span className="vinyl-disc animate-rotate block h-10 w-10" />
                Ouverture de la caméra…
              </div>
            )}
            {camera === 'off' && (
              <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm leading-relaxed text-ink/85">
                {cameraError}
              </div>
            )}

            {/* Pendant la recherche, l'image se fige derrière un voile */}
            {phase !== 'scan' && camera === 'on' && <div className="absolute inset-0 bg-accent/60 backdrop-blur-[2px]" />}
            {phase === 'looking' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm font-medium">
                <span className="vinyl-disc animate-rotate block h-12 w-12" style={{ '--disc-label': '#f1c04e' }} />
                Recherche sur Discogs…
                <span className="font-mono text-xs text-ink/70">{code}</span>
              </div>
            )}
          </div>

          {/* Résultat */}
          <div aria-live="polite">
            {phase === 'result' && result && (
              <div className="animate-pop mt-4 space-y-2">
                {result.notVinyl && (
                  <p className="rounded-xl bg-ink/15 px-3 py-2 text-xs">
                    Ce code correspond à une autre édition (CD…). On ajoutera l’album en vinyle.
                  </p>
                )}
                {result.items.map((item) => {
                  const key = itemKey(item)
                  const status = statusOf(item)
                  const added = done?.key === key
                  const busy = busyKey === key
                  return (
                    <div key={key} className="flex items-center gap-3 rounded-2xl bg-surface p-3 text-paper shadow-lg shadow-black/20">
                      <Cover url={item.cover_url} className="h-16 w-16 shrink-0 overflow-hidden rounded-md" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-display text-lg font-black uppercase leading-tight">{item.title}</p>
                        <p className="truncate text-sm text-muted">
                          {item.artist}
                          {item.year && ` · ${item.year}`}
                        </p>
                        {added ? (
                          <p className="mt-1 flex items-center gap-1 text-xs font-bold text-accent">
                            <CheckIcon width={14} height={14} /> Ajouté à {done.status === 'owned' ? 'ta collection' : 'tes souhaits'}
                          </p>
                        ) : status === 'owned' ? (
                          <p className="mt-1 flex items-center gap-1 text-xs text-muted">
                            <CheckIcon width={14} height={14} /> Déjà dans ta collection
                          </p>
                        ) : (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <button
                              onClick={() => add(item, 'owned')}
                              disabled={busy || offline}
                              className="flex items-center gap-1 rounded-full bg-accent px-3.5 py-1.5 text-xs font-bold text-ink transition hover:bg-accent-soft disabled:opacity-50"
                            >
                              <CheckIcon width={13} height={13} /> {status === 'wish' ? 'Je l’ai eu !' : 'Je l’ai'}
                            </button>
                            {status !== 'wish' && (
                              <button
                                onClick={() => add(item, 'wish')}
                                disabled={busy || offline}
                                className="flex items-center gap-1 rounded-full border border-line px-3 py-1.5 text-xs font-medium transition hover:border-accent disabled:opacity-50"
                              >
                                <PlusIcon width={13} height={13} /> Souhait
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {phase === 'notfound' && (
              <div className="animate-pop mt-4 rounded-2xl bg-surface p-4 text-sm text-paper">
                <p className="font-bold">{lookupError ? 'Recherche impossible' : 'Introuvable sur Discogs'}</p>
                <p className="mt-1 text-muted">
                  {lookupError || <>Aucun disque avec le code <span className="font-mono">{code}</span>. Essaie la recherche par nom.</>}
                </p>
              </div>
            )}

            {phase !== 'scan' && phase !== 'looking' && (
              <button
                onClick={resume}
                className="mt-3 w-full rounded-full bg-ink py-2.5 text-sm font-bold text-accent transition hover:bg-surface"
              >
                {done ? 'Scanner le suivant' : camera === 'on' ? 'Scanner un autre disque' : 'OK'}
              </button>
            )}
          </div>

          {/* Saisie à la main */}
          <form onSubmit={submitManual} className="mt-4">
            <label htmlFor="manual-barcode" className="text-xs font-medium text-ink/75">
              {camera === 'on' ? 'Le code ne passe pas ? Tape les chiffres :' : 'Code-barres (chiffres sous les barres) :'}
            </label>
            <div className="mt-1.5 flex gap-2">
              <input
                id="manual-barcode"
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                inputMode="numeric"
                autoComplete="off"
                placeholder="ex. 3700187667852"
                disabled={offline}
                className="w-full min-w-0 rounded-xl border border-ink/25 bg-ink/10 px-3 py-2 font-mono text-sm tracking-wider text-ink outline-none placeholder:text-ink/50 focus:border-ink/60"
              />
              <button disabled={!manual.trim() || offline || phase === 'looking'} className="shrink-0 rounded-full bg-ink px-4 text-sm font-bold text-accent transition hover:bg-surface disabled:opacity-50">
                Chercher
              </button>
            </div>
            {manualError && <p className="mt-1.5 text-xs font-medium">{manualError}</p>}
          </form>

          {/* Ajouts de la session */}
          {session.length > 0 && (
            <div className="mt-5 border-t border-ink/15 pt-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/70">
                Ajoutés maintenant · {session.length}
              </p>
              <ul className="mt-2 flex gap-2 overflow-x-auto pb-1">
                {session.map((s) => (
                  <li key={itemKey(s)} className="w-14 shrink-0" title={`${s.artist} – ${s.title}`}>
                    <Cover url={s.cover_url} className="aspect-square w-full overflow-hidden rounded-md ring-2 ring-ink/20" />
                    <span className="mt-1 block truncate text-[10px] text-ink/75">{s.title}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
