import type { Branch } from '../../service/backend-api'
import { Icon } from '../workspace/Icon'

type BranchLocation = Pick<Branch, 'address' | 'latitude' | 'longitude'>

export function BranchDirections({ branch, className }: { branch: BranchLocation; className: string }) {
  const hasCoordinates = branch.latitude !== null && branch.latitude !== undefined && String(branch.latitude).trim() !== ''
    && branch.longitude !== null && branch.longitude !== undefined && String(branch.longitude).trim() !== ''
  const mapQuery = hasCoordinates ? `${branch.latitude},${branch.longitude}` : branch.address.trim()

  if (!mapQuery) return <p className="branch-directions-unavailable" role="status" aria-label={'C\u00f3mo llegar no disponible'}><Icon name="map" size={18}/><span>{'C\u00f3mo llegar no disponible: la sede no tiene una ubicaci\u00f3n configurada.'}</span></p>

  return <a className={className} href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`} target="_blank" rel="noreferrer"><Icon name="map" size={20}/>{'C\u00f3mo llegar'}</a>
}
