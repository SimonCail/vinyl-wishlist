import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './lib/supabase'
import { useToasts } from './hooks/useToasts'
import { filterAndSort, getFacets, getTotals } from './lib/listUtils'
import ListSummary from './components/ListSummary'
import SearchPanel from './components/SearchPanel'
import ListToolbar from './components/ListToolbar'
import VinylCard from './components/VinylCard'
import Toasts from './components/Toasts'
import { useAuth } from './hooks/useAuth'
import ReadOnlyNotice from './components/ReadOnlyNotice'
import {
  ConfirmDialog, NoteDialog, NameDialog, LoginDialog,
} from './components/Dialogs'
import { getMasterDetails } from './lib/discogs'
import { useUserName } from './hooks/useUserName'
import VinylDetail from './components/VinylDetail'
import ShareDialog from './components/ShareDialog'
import { ShareIcon } from './components/Icons'
import { readCache, writeCache } from './lib/cache'
import { useOnlineStatus } from './hooks/useOnlineStatus'
import { useInstallPrompt } from './hooks/useInstallPrompt'
import InstallBanner from './components/InstallBanner'
import OfflineBanner from './components/OfflineBanner'

export default function App() {
  const [vinyls, setVinyls] = useState(readCache)
  const [loading, setLoading] = useState(() => readCache().length === 0)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [noteTarget, setNoteTarget] = useState(null)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('recent')
  const [genre, setGenre] = useState('')
  const [person, setPerson] = useState('')
  const { toasts, toast } = useToasts()
  const { name, setName } = useUserName()
  const online = useOnlineStatus()
  const install = useInstallPrompt()
  const auth = useAuth()
  const [loginOpen, setLoginOpen] = useState(false)
  const wasOffline = useRef(false)
  const [pendingAdd, setPendingAdd] = useState(null)
  const [detailId, setDetailId] = useState(null)
  const [refreshing, setRefreshing] = useState(null)
  const [shareOpen, setShareOpen] = useState(false)

  // --- Chargement, temps réel, resynchronisation ---
  const loadVinyls = useCallback(async () => {
    const { data, error } = await supabase
      .from('vinyls')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      // Hors-ligne : le bandeau explique déjà la situation, on garde la liste en mémoire
      if (navigator.onLine) toast(error.message, 'error')
    } else {
      setVinyls(data)
    }
    setLoading(false)
  }, [toast])

  useEffect(() => {
    loadVinyls()

    const channel = supabase
      .channel('vinyls-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vinyls' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setVinyls((prev) =>
              prev.some((v) => v.id === payload.new.id)
                ? prev
                : [payload.new, ...prev]
            )
          } else if (payload.eventType === 'UPDATE') {
            setVinyls((prev) =>
              prev.map((v) => (v.id === payload.new.id ? payload.new : v))
            )
          } else if (payload.eventType === 'DELETE') {
            setVinyls((prev) => prev.filter((v) => v.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    // Pendant une coupure ou une mise en veille, des événements ont pu être manqués
    const onOnline = () => loadVinyls()
    const onVisible = () => {
      if (document.visibilityState === 'visible') loadVinyls()
    }
    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', onVisible)
      supabase.removeChannel(channel)
    }
  }, [loadVinyls])

  // Mémorise la liste pour le mode hors-ligne
  useEffect(() => {
    if (!loading) writeCache(vinyls)
  }, [vinyls, loading])

  // Message au retour du réseau
  useEffect(() => {
    if (!online) wasOffline.current = true
    else if (wasOffline.current) {
      wasOffline.current = false
      toast('De retour en ligne')
    }
  }, [online, toast])

  function ensureOnline() {
    if (navigator.onLine) return true
    toast('Tu es hors-ligne : modification impossible pour le moment', 'error')
    return false
  }

  // --- Actions ---
  // Demande le prénom une seule fois, au premier ajout
  function requestAdd(item) {
    if (!ensureOnline()) return
    if (!name) {
      setPendingAdd(item)
      return
    }
    handleAdd(item, name)
  }

  function confirmName(newName) {
    setName(newName)
    handleAdd(pendingAdd, newName)
    setPendingAdd(null)
  }

  async function handleAdd(item, author) {
    // On récupère genres et prix ; si Discogs ne répond pas, l'ajout continue quand même
    let extra = {}
    try {
      const d = await getMasterDetails(item.discogs_id)
      extra = {
        genres: d.genres,
        styles: d.styles,
        lowest_price: d.lowest_price,
        num_for_sale: d.num_for_sale,
        price_updated_at: new Date().toISOString(),
      }
    } catch {
      // pas de détails pour cette fois
    }

    const { data, error } = await supabase
      .from('vinyls')
      .insert({ ...item, added_by: author, ...extra })
      .select()
      .single()

    if (error) {
      toast(
        error.code === '23505'
          ? 'Ce vinyle est déjà dans la liste.'
          : error.message,
        'error'
      )
      return
    }
    setVinyls((prev) =>
      prev.some((v) => v.id === data.id) ? prev : [data, ...prev]
    )
    toast(`« ${data.title} » ajouté à la liste`)
  }

  async function updateVinyl(id, patch) {
    if (!ensureOnline()) return false
    const { data, error } = await supabase
      .from('vinyls')
      .update(patch)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      toast(error.message, 'error')
      return false
    }
    setVinyls((prev) => prev.map((v) => (v.id === data.id ? data : v)))
    return true
  }

  async function handleSignIn(code) {
    const err = await auth.signIn(code)
    if (!err) {
      setLoginOpen(false)
      toast('Code accepté, tu peux modifier la liste')
    }
    return err
  }
  // Enregistre en base les infos fraîches venues de Discogs
  async function syncDetails(vinyl, d) {
    if (!auth.canEdit) return
    await updateVinyl(vinyl.id, {
      genres: d.genres,
      styles: d.styles,
      lowest_price: d.lowest_price,
      num_for_sale: d.num_for_sale,
      price_updated_at: new Date().toISOString(),
    })
  }

  // Complète les disques sans infos ; sinon actualise tous les prix
  async function refreshInfos() {
    if (!ensureOnline()) return
    const stale = vinyls.filter((v) => !v.price_updated_at)
    const targets = stale.length ? stale : vinyls
    let failed = 0

    for (let i = 0; i < targets.length; i++) {
      setRefreshing({ done: i + 1, total: targets.length })
      try {
        const d = await getMasterDetails(targets[i].discogs_id)
        await syncDetails(targets[i], d)
      } catch {
        failed++
      }
      // Pause pour respecter la limite de 60 requêtes/minute de Discogs
      await new Promise((r) => setTimeout(r, 1200))
    }

    setRefreshing(null)
    if (failed) toast(`${failed} disque(s) n'ont pas pu être mis à jour`, 'error')
    else toast('Infos et prix à jour')
  }

  async function confirmNote(note) {
    const ok = await updateVinyl(noteTarget.id, { note: note || null })
    if (ok) toast('Note enregistrée')
    setNoteTarget(null)
  }

  async function confirmDelete() {
    if (!ensureOnline()) {
      setDeleteTarget(null)
      return
    }
    const { error } = await supabase
      .from('vinyls')
      .delete()
      .eq('id', deleteTarget.id)
    if (error) toast(error.message, 'error')
    else {
      setVinyls((prev) => prev.filter((v) => v.id !== deleteTarget.id))
      toast('Vinyle retiré de la liste')
    }
    setDeleteTarget(null)
  }

  // --- Données dérivées ---
  const inListIds = new Set(vinyls.map((v) => v.discogs_id))
  const missingCount = vinyls.filter((v) => !v.price_updated_at).length
  const detailVinyl = vinyls.find((v) => v.id === detailId)
  const facets = useMemo(() => getFacets(vinyls), [vinyls])
  // Si le dernier disque d'un genre est supprimé, le filtre s'annule tout seul
  const activeGenre = facets.genres.some((g) => g.name === genre) ? genre : ''
  const activePerson = facets.people.some((p) => p.name === person) ? person : ''
  const hasFilters = !!(search.trim() || activeGenre || activePerson)

  const visible = useMemo(
    () =>
      filterAndSort(vinyls, {
        sort,
        search,
        genre: activeGenre,
        person: activePerson,
      }),
    [vinyls, sort, search, activeGenre, activePerson]
  )
  const totals = useMemo(() => getTotals(visible), [visible])

  function resetFilters() {
    setSearch('')
    setGenre('')
    setPerson('')
  }

  const gridClass =
    'grid grid-cols-2 gap-x-6 gap-y-9 sm:grid-cols-3 md:grid-cols-4'

  return (
    <div className="min-h-screen pb-20">
      <OfflineBanner online={online} />
      <header className="mx-auto max-w-5xl px-5 pb-8 pt-12 sm:pt-16">
        <div className="mb-8 flex justify-end">
          {auth.ready &&
            (auth.canEdit ? (
              <button
                onClick={auth.signOut}
                className="rounded-full border border-line px-3.5 py-1.5 text-xs text-muted transition hover:border-accent hover:text-paper"
              >
                Se déconnecter
              </button>
            ) : (
              <button
                onClick={() => setLoginOpen(true)}
                className="rounded-full border border-line px-3.5 py-1.5 text-xs text-muted transition hover:border-accent hover:text-paper"
              >
                Entrer le code
              </button>
            ))}
        </div>
        <p className="animate-fade-up text-sm font-medium uppercase tracking-[0.2em] text-accent">
          Notre wishlist
        </p>
        <h1
          className="animate-fade-up mt-3 font-display text-4xl font-bold leading-[1.1] sm:text-6xl"
          style={{ animationDelay: '80ms' }}
        >
          Les vinyles qu'on veut{' '}
          <span className="italic text-accent">sur nos étagères.</span>
        </h1>
        <p
          className="animate-fade-up mt-4 max-w-lg text-muted"
          style={{ animationDelay: '160ms' }}
        >
          Une liste partagée, mise à jour en direct. Cherche un artiste,
          ajoute ses albums, note tes envies.
        </p>
      </header>

      <main className="mx-auto max-w-5xl space-y-12 px-5">
        <InstallBanner
          mode={install.mode}
          onInstall={install.install}
          onDismiss={install.dismiss}
        />
        {auth.canEdit ? (
          <SearchPanel
            inListIds={inListIds}
            onAdd={requestAdd}
            onError={(msg) => toast(msg, 'error')}
            offline={!online}
          />
        ) : (
          auth.ready && <ReadOnlyNotice onLogin={() => setLoginOpen(true)} />
        )}

        <section>
          <div className="mb-5 flex items-end justify-between gap-3 border-b border-line pb-3">
            <div className="flex items-baseline gap-3">
              <h2 className="font-display text-2xl font-bold">La liste</h2>
              <span className="text-sm text-muted">
                {vinyls.length} disque{vinyls.length > 1 ? 's' : ''}
              </span>
            </div>
            {vinyls.length > 0 && (
              <div className="flex shrink-0 items-center gap-2">
                {auth.canEdit && (
                  <button
                    onClick={refreshInfos}
                    disabled={!!refreshing}
                    className="rounded-full border border-line px-3 py-1 text-xs text-muted transition hover:border-accent hover:text-paper disabled:opacity-60"
                  >
                    {refreshing
                      ? `Mise à jour ${refreshing.done}/${refreshing.total}…`
                      : missingCount > 0
                        ? `Compléter les infos (${missingCount})`
                        : 'Actualiser les prix'}
                  </button>
                )}
                <button
                  onClick={() => setShareOpen(true)}
                  disabled={visible.length === 0}
                  className="flex items-center gap-1.5 rounded-full bg-accent px-3.5 py-1 text-xs font-bold text-ink transition hover:bg-accent-soft disabled:opacity-50"
                >
                  <ShareIcon width={14} height={14} /> Partager
                </button>
              </div>
            )}
          </div>

          {vinyls.length > 0 && (
            <>
              <ListSummary totals={totals} filtered={hasFilters} />
              <ListToolbar
                search={search}
                onSearch={setSearch}
                sort={sort}
                onSort={setSort}
                facets={facets}
                genre={activeGenre}
                onGenre={setGenre}
                person={activePerson}
                onPerson={setPerson}
                hasFilters={hasFilters}
                onReset={resetFilters}
              />
            </>
          )}

          {loading ? (
            <ul className={gridClass}>
              {Array.from({ length: 8 }).map((_, i) => (
                <li key={i} className="animate-shimmer">
                  <div className="aspect-square rounded-md bg-raised" />
                  <div className="mt-3 h-4 w-3/4 rounded bg-raised" />
                  <div className="mt-2 h-3 w-1/2 rounded bg-raised" />
                </li>
              ))}
            </ul>
          ) : vinyls.length === 0 ? (
            <div className="py-16 text-center">
              <div className="vinyl-disc mx-auto h-24 w-24 animate-slow-spin rounded-full shadow-lg shadow-black/50" />
              <p className="mt-6 font-display text-xl font-bold">
                {online ? 'Les bacs sont vides' : 'Pas de connexion'}
              </p>
              <p className="mt-1 text-sm text-muted">
                {!online
                  ? 'Reconnecte-toi une première fois pour charger la liste.'
                  : auth.canEdit
                    ? 'Cherche un artiste plus haut pour ajouter le premier disque.'
                    : "Personne n'a encore ajouté de disque."}
              </p>
            </div>
          ) : visible.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-muted">Aucun disque ne correspond à ces filtres.</p>
              <button
                onClick={resetFilters}
                className="mt-3 rounded-full border border-line px-4 py-1.5 text-sm transition hover:border-accent"
              >
                Réinitialiser
              </button>
            </div>
          ) : (
            <ul className={gridClass}>
              {visible.map((v, i) => (
                <VinylCard
                  key={v.id}
                  vinyl={v}
                  index={i}
                  onDelete={() => setDeleteTarget(v)}
                  onPriority={(p) => updateVinyl(v.id, { priority: p })}
                  onNote={() => setNoteTarget(v)}
                  onOpen={() => setDetailId(v.id)}
                  readOnly={!auth.canEdit}
                />
              ))}
            </ul>
          )}
        </section>
      </main>
      {pendingAdd && (
        <NameDialog
          item={pendingAdd}
          onConfirm={confirmName}
          onClose={() => setPendingAdd(null)}
        />
      )}
      {detailVinyl && (
        <VinylDetail
          vinyl={detailVinyl}
          onSync={syncDetails}
          onClose={() => setDetailId(null)}
        />
      )}
      {shareOpen && (
        <ShareDialog
          vinyls={visible}
          filtered={hasFilters}
          onClose={() => setShareOpen(false)}
          onToast={toast}
        />
      )}
      {loginOpen && (
        <LoginDialog
          onSubmit={handleSignIn}
          onClose={() => setLoginOpen(false)}
        />
      )}
      {noteTarget && (
        <NoteDialog
          vinyl={noteTarget}
          onConfirm={confirmNote}
          onClose={() => setNoteTarget(null)}
        />
      )}
      {deleteTarget && (
        <ConfirmDialog
          title="Retirer ce disque ?"
          message={`« ${deleteTarget.title} » sera retiré de la liste pour tout le monde.`}
          confirmLabel="Retirer"
          onConfirm={confirmDelete}
          onClose={() => setDeleteTarget(null)}
        />
      )}

      <Toasts toasts={toasts} />
    </div>
  )
}