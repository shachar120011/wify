type Mode = 'mail' | 'identity'

function modeFromPath(pathname: string): Mode {
  return pathname.startsWith('/identity') ? 'identity' : 'mail'
}

export function ModeNav({ mode }: { mode: Mode }) {
  const item = (href: string, active: boolean, label: string) => (
    <a
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`cursor-pointer rounded-full px-3 py-1.5 text-xs font-medium transition duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/40 ${
        active
          ? 'bg-white/10 text-white'
          : 'text-white/40 hover:text-white/70'
      }`}
    >
      {label}
    </a>
  )

  return (
    <nav
      dir="rtl"
      aria-label="מצב אישור"
      className="fixed top-0 right-0 left-0 z-10 flex justify-center pt-4"
    >
      <div className="inline-flex gap-1 rounded-full border border-white/10 bg-[#121214]/90 p-1 backdrop-blur">
        {item('/', mode === 'mail', 'מייל')}
        {item('/identity', mode === 'identity', 'זהות')}
      </div>
    </nav>
  )
}

export { modeFromPath }
export type { Mode }
