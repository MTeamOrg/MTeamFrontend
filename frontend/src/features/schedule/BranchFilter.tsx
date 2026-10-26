import type { EntityRef } from '../../service/backend-api'
import { Icon } from '../workspace/Icon'

export function BranchFilter({ branches, value, onChange }: { branches: EntityRef[]; value: string; onChange: (branchId: string) => void }) {
  return <label className="branch-filter">
    <Icon name="pin" size={18}/>
    <select aria-label="Filtrar por sede" value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">Todas las sedes</option>
      {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
    </select>
    <Icon name="down" size={18}/>
  </label>
}
