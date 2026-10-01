import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { searchVinyls } from './lib/discogs'

export default function App() {
  const [vinyls, setVinyls] = useState([])
  const [loading, setLoading] = useState(true)

  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState(null)

  // --- Chargement initial + abonnement temps réel ---
  useEffect(() => {
    supabase
      .from('vinyls')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setVinyls(data)
        setLoading(false)
      })

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

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // --- Recherche Discogs ---
  async function handleSearch(e) {
    e.preventDefault()
    setError(null)
    setSearching(true)
    try {
      setResults(await searchVinyls(query))
    } catch (err) {
      setError(err.message)
    } finally {
      setSearching(false)
    }
  }

  // --- Ajouter à la liste ---
  async function handleAdd(item) {
    setError(null)
    const { data, error } = await supabase
      .from('vinyls')
      .insert(item)
      .select()
      .single()

    if (error) {
      setError(
        error.code === '23505'
          ? 'Ce vinyle est déjà dans la liste.'
          : error.message
      )
      return
    }
    // Mise à jour immédiate (le temps réel ne l'ajoutera pas en double)
    setVinyls((prev) =>
      prev.some((v) => v.id === data.id) ? prev : [data, ...prev]
    )
  }

  // --- "Je l'ai acheté" / annuler ---
  async function handleTogglePurchased(vinyl) {
    let update

    if (vinyl.is_purchased) {
      update = { is_purchased: false, purchased_by: null, purchased_at: null }
    } else {
      const saved = localStorage.getItem('vinyl-wishlist-name') || ''
      const name = window.prompt('Ton prénom ?', saved)
      if (!name || !name.trim()) return
      localStorage.setItem('vinyl-wishlist-name', name.trim())
      update = {
        is_purchased: true,
        purchased_by: name.trim(),
        purchased_at: new Date().toISOString(),
      }
    }

    const { error } = await supabase
      .from('vinyls')
      .update(update)
      .eq('id', vinyl.id)
    if (error) setError(error.message)
  }

  // --- Supprimer ---
  async function handleDelete(vinyl) {
    if (!window.confirm(`Retirer « ${vinyl.title} » de la liste ?`)) return
    const { error } = await supabase.from('vinyls').delete().eq('id', vinyl.id)
    if (error) setError(error.message)
  }

  const inListIds = new Set(vinyls.map((v) => v.discogs_id))

  return (
    <div className="min-h-screen bg-zinc-900 text-white">
      <div className="mx-auto max-w-3xl p-4 sm:p-6">
        <h1 className="mb-6 text-3xl font-bold text-amber-400">
          🎵 Vinyl Wishlist
        </h1>

        {/* Barre de recherche */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Artiste ou album (ex. Daft Punk Discovery)"
            className="min-w-0 flex-1 rounded bg-zinc-800 px-3 py-2 outline-none focus:ring-2 focus:ring-amber-400"
          />
          <button
            type="submit"
            disabled={searching}
            className="rounded bg-amber-400 px-4 py-2 font-bold text-black disabled:opacity-50"
          >
            {searching ? '...' : 'Chercher'}
          </button>
        </form>

        {error && <p className="mt-4 text-red-400">❌ {error}</p>}

        {/* Résultats de recherche */}
        {results.length > 0 && (
          <section className="mt-6">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Résultats</h2>
              <button
                onClick={() => setResults([])}
                className="text-sm text-zinc-400 hover:text-white"
              >
                Fermer
              </button>
            </div>
            <ul className="space-y-2">
              {results.map((item) => (
                <SearchResult
                  key={item.discogs_id}
                  item={item}
                  alreadyAdded={inListIds.has(item.discogs_id)}
                  onAdd={() => handleAdd(item)}
                />
              ))}
            </ul>
          </section>
        )}

        {/* Liste partagée */}
        <section className="mt-10">
          <h2 className="mb-3 text-lg font-semibold">
            Notre liste ({vinyls.length})
          </h2>

          {loading ? (
            <p className="text-zinc-400">Chargement...</p>
          ) : vinyls.length === 0 ? (
            <p className="text-zinc-400">
              La liste est vide. Cherche un vinyle pour commencer !
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {vinyls.map((v) => (
                <VinylCard
                  key={v.id}
                  vinyl={v}
                  onToggle={() => handleTogglePurchased(v)}
                  onDelete={() => handleDelete(v)}
                />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

function SearchResult({ item, alreadyAdded, onAdd }) {
  return (
    <li className="flex items-center gap-3 rounded bg-zinc-800 p-2">
      <Cover url={item.cover_url} size="h-14 w-14" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{item.title}</p>
        <p className="truncate text-sm text-zinc-400">
          {item.artist} {item.year && `· ${item.year}`}
        </p>
      </div>
      <button
        onClick={onAdd}
        disabled={alreadyAdded}
        className="shrink-0 rounded bg-amber-400 px-3 py-1 text-sm font-bold text-black disabled:bg-zinc-600 disabled:text-zinc-300"
      >
        {alreadyAdded ? 'Ajouté' : '+ Ajouter'}
      </button>
    </li>
  )
}

function VinylCard({ vinyl, onToggle, onDelete }) {
  return (
    <li
      className={`flex gap-3 rounded bg-zinc-800 p-3 ${
        vinyl.is_purchased ? 'opacity-60' : ''
      }`}
    >
      <Cover url={vinyl.cover_url} size="h-20 w-20" />
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="truncate font-semibold">{vinyl.title}</p>
        <p className="truncate text-sm text-zinc-400">
          {vinyl.artist} {vinyl.year && `· ${vinyl.year}`}
        </p>

        {vinyl.is_purchased && (
          <p className="mt-1 text-sm text-green-400">
            ✅ Acheté par {vinyl.purchased_by}
          </p>
        )}

        <div className="mt-auto flex items-center gap-3 pt-2">
          <button
            onClick={onToggle}
            className={`rounded px-3 py-1 text-sm font-bold ${
              vinyl.is_purchased
                ? 'bg-zinc-600 text-white'
                : 'bg-green-500 text-black'
            }`}
          >
            {vinyl.is_purchased ? 'Annuler' : "Je l'ai acheté"}
          </button>
          <button
            onClick={onDelete}
            className="text-sm text-zinc-500 hover:text-red-400"
            aria-label="Supprimer"
          >
            🗑
          </button>
        </div>
      </div>
    </li>
  )
}

function Cover({ url, size }) {
  return url ? (
    <img
      src={url}
      alt=""
      loading="lazy"
      className={`${size} shrink-0 rounded object-cover`}
    />
  ) : (
    <div
      className={`${size} flex shrink-0 items-center justify-center rounded bg-zinc-700`}
    >
      💿
    </div>
  )
}