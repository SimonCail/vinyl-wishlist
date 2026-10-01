export default function Toasts({ toasts }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`animate-pop flex items-center gap-2.5 rounded-full py-2.5 pl-4 pr-5 text-sm font-medium shadow-xl shadow-black/40 ${
            t.type === 'error' ? 'bg-red-500 text-white' : 'bg-paper text-ink'
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              t.type === 'error' ? 'bg-white' : 'bg-sun'
            }`}
          />
          {t.message}
        </div>
      ))}
    </div>
  )
}
