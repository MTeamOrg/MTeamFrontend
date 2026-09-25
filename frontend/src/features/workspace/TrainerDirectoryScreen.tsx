import { useCallback, useState } from 'react'
import { useApiResource } from '../../hooks/use-api-resource'
import { backendApi } from '../../service/backend-api'
import { EmptyState, ErrorState, LoadingState } from './ApiStates'
import { Icon } from './Icon'

export function TrainerDirectoryScreen() {
  const [page,setPage]=useState(1)
  const loader=useCallback(()=>backendApi.listTrainers(page,12),[page])
  const {data,loading,error,reload}=useApiResource(loader)
  return <section className="trainer-directory-screen"><p className="page-intro">Entrenadores activos informados por M-TEAM.</p>{loading?<LoadingState/>:error?<ErrorState message={error} retry={()=>void reload()}/>:!data?.items.length?<EmptyState message="No hay entrenadores activos para mostrar."/>:<><div className="branch-grid">{data.items.map(trainer=><article className="branch-card" key={trainer.id}>{trainer.photoUrl?<img className="media-placeholder" src={trainer.photoUrl} alt={`${trainer.firstName} ${trainer.lastName}`}/>:<div className="media-placeholder"><Icon name="user"/></div>}<div className="branch-info"><h3>{trainer.firstName} {trainer.lastName}</h3><span className="badge badge-info">{trainer.specialty}</span><p>{trainer.description}</p></div></article>)}</div><div className="form-actions"><button className="button button-secondary" disabled={page===1} onClick={()=>setPage(value=>value-1)}>Anterior</button><span>Página {page}</span><button className="button button-secondary" disabled={page*data.limit>=data.total} onClick={()=>setPage(value=>value+1)}>Siguiente</button></div></>}</section>
}
