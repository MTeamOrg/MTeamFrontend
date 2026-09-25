import { Icon } from './Icon'

export function TrainerDirectoryScreen() {
  return <section className="trainer-directory-screen"><p className="page-intro">Consultá el nombre, la fotografía, la especialidad y la descripción de los entrenadores activos.</p><div className="surface-card trainer-directory-empty"><Icon name="users" size={32}/><h2>No se pudieron cargar los entrenadores</h2><p>El servicio que provee los perfiles de entrenadores todavía no está disponible. Cuando se conecte, vas a poder consultar sus datos y clases asignadas acá.</p></div></section>
}
