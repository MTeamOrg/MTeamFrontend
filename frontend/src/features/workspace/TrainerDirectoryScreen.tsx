import { useCallback, useState } from 'react'
import { useApiResource } from '../../hooks/use-api-resource'
import { backendApi } from '../../service/backend-api'
import { EmptyState, ErrorState, LoadingState } from './ApiStates'
import { PageHeader } from './PageHeader'
import { SafeImage } from './SafeImage'

export function TrainerDirectoryScreen() {
  const [page,setPage]=useState(1)
  const loader=useCallback(()=>backendApi.listTrainers(page,12),[page])
  const {data,loading,error,reload}=useApiResource(loader)
  return <div className="app-page trainer-directory-screen"><PageHeader title="Entrenadores" description="Entrenadores activos informados por M-TEAM."/>{loading?<LoadingState/>:error?<ErrorState message={error} retry={()=>void reload()}/>:!data?.items.length?<EmptyState message="No hay entrenadores activos para mostrar."/>:<><div className="branch-grid">{data.items.map(trainer=><article className="branch-card" key={trainer.id}><SafeImage className="media-placeholder" src={trainer.photoUrl} alt={`${trainer.firstName} ${trainer.lastName}`} fallbackIcon="user"/><div className="branch-info"><h3>{trainer.firstName} {trainer.lastName}</h3><span className="badge badge-info">{trainer.specialty}</span><p>{trainer.description}</p></div></article>)}</div><div className="form-actions"><button type="button" className="button button-secondary" disabled={page===1} onClick={()=>setPage(value=>value-1)}>Anterior</button><span>Página {page}</span><button type="button" className="button button-secondary" disabled={page*data.limit>=data.total} onClick={()=>setPage(value=>value+1)}>Siguiente</button></div></>}</div>
}
