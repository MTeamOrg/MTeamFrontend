import type { UserRole } from '../authentication/auth-types'
import type { IconName } from './Icon'

export interface NavEntry {
  label: string
  tabLabel: string
  href: string
  icon: IconName
}

export const ROLE_BASE: Record<UserRole, string> = {
  MEMBER: '/socio',
  TRAINER: '/entrenador',
  ADMIN: '/admin',
}

export const ROLE_LABEL: Record<UserRole, string> = {
  MEMBER: 'Socio',
  TRAINER: 'Entrenador',
  ADMIN: 'Administrador',
}

export const NAVIGATION: Record<UserRole, NavEntry[]> = {
  MEMBER: [
    { label: 'Inicio', tabLabel: 'Inicio', href: '', icon: 'home' },
    { label: 'Mi perfil', tabLabel: 'Mi perfil', href: 'perfil', icon: 'user' },
    { label: 'Apto médico', tabLabel: 'Apto', href: 'apto-medico', icon: 'file' },
    { label: 'Acceso QR', tabLabel: 'Acceso QR', href: 'acceso', icon: 'qr' },
    { label: 'Clases', tabLabel: 'Clases', href: 'clases', icon: 'calendar' },
    { label: 'Eventos', tabLabel: 'Eventos', href: 'eventos', icon: 'trophy' },
    { label: 'Novedades', tabLabel: 'Novedades', href: 'novedades', icon: 'megaphone' },
    { label: 'Notificaciones', tabLabel: 'Notificaciones', href: 'notificaciones', icon: 'bell' },
  ],
  TRAINER: [
    { label: 'Inicio', tabLabel: 'Inicio', href: '', icon: 'home' },
    { label: 'Mi perfil', tabLabel: 'Mi perfil', href: 'perfil', icon: 'user' },
    { label: 'Mis clases', tabLabel: 'Mis clases', href: 'clases', icon: 'calendar' },
    { label: 'Acceso QR', tabLabel: 'Acceso QR', href: 'acceso', icon: 'qr' },
    { label: 'Eventos', tabLabel: 'Eventos', href: 'eventos', icon: 'trophy' },
    { label: 'Novedades', tabLabel: 'Novedades', href: 'novedades', icon: 'megaphone' },
    { label: 'Notificaciones', tabLabel: 'Notificaciones', href: 'notificaciones', icon: 'bell' },
  ],
  ADMIN: [
    { label: 'Panel', tabLabel: 'Panel', href: '', icon: 'chart' },
    { label: 'Usuarios', tabLabel: 'Usuarios', href: 'usuarios', icon: 'users' },
    { label: 'Pagos y cuota', tabLabel: 'Pagos', href: 'pagos', icon: 'wallet' },
    { label: 'Aptos médicos', tabLabel: 'Aptos', href: 'aptos', icon: 'file' },
    { label: 'Accesos', tabLabel: 'Accesos', href: 'accesos', icon: 'qr' },
    { label: 'Clases', tabLabel: 'Clases', href: 'clases', icon: 'calendar' },
    { label: 'Sedes', tabLabel: 'Sedes', href: 'sedes', icon: 'building' },
    { label: 'Eventos', tabLabel: 'Eventos', href: 'eventos', icon: 'trophy' },
    { label: 'Novedades', tabLabel: 'Novedades', href: 'novedades', icon: 'megaphone' },
  ],
}

// ADMIN tabs are confirmed by MA10. MEMBER/TRAINER tab frames were not available:
// they keep the first five entries in Figma sidebar order, pending verification.
const MOBILE_TABS: Record<UserRole, string[]> = {
  MEMBER: ['', 'perfil', 'apto-medico', 'acceso', 'clases'],
  TRAINER: ['', 'perfil', 'clases', 'acceso', 'eventos'],
  ADMIN: ['', 'usuarios', 'pagos', 'aptos', 'clases'],
}

// Real features that Figma reaches from another screen instead of a sidebar entry.
const NESTED_SEGMENTS: Record<UserRole, Record<string, { parent: string; title: string }>> = {
  MEMBER: {
    pagos: { parent: '', title: 'Mis pagos' },
    entrenadores: { parent: '', title: 'Entrenadores' },
  },
  TRAINER: {},
  ADMIN: {
    perfil: { parent: '', title: 'Mi perfil' },
  },
}

export function mobileTabs(role: UserRole): NavEntry[] {
  return MOBILE_TABS[role].map((href) => NAVIGATION[role].find((entry) => entry.href === href)!)
}

export function resolveSection(role: UserRole, segment: string): { active: NavEntry; title: string } {
  const entries = NAVIGATION[role]
  const direct = entries.find((entry) => entry.href === segment)
  if (direct) return { active: direct, title: direct.label }
  const nested = NESTED_SEGMENTS[role][segment]
  if (nested) return { active: entries.find((entry) => entry.href === nested.parent)!, title: nested.title }
  return { active: entries[0], title: entries[0].label }
}

export function hrefFor(role: UserRole, href: string) {
  return href ? `${ROLE_BASE[role]}/${href}` : ROLE_BASE[role]
}
