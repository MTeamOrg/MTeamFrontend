export function UnreadBadge({ count }: { count: number | null }) {
  if (!count) return null
  return <>
    <span className="app-nav-badge" aria-hidden="true">{count > 99 ? '99+' : count}</span>
    <span className="visually-hidden">{count === 1 ? '1 notificación sin leer' : `${count} notificaciones sin leer`}</span>
  </>
}
