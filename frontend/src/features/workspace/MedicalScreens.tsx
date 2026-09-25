import { useEffect, useMemo, useState } from 'react'
import { Icon } from './Icon'

const MAX_UPLOAD_SIZE_MB = 5 // límite visual indicado en el frame S3; la especificación no fija otro tamaño.
const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png']

// These rows and certificate details are Figma previews only, never live medical records.
const FIGMA_PREVIEW_CERTIFICATES = [
  { member: 'Lucas Torres', document: '44.870.910', file: 'apto-lucas.pdf', uploaded: '03/09/2026 20:14', status: 'Pendiente' },
  { member: 'Ana Vidal', document: '45.112.003', file: 'certificado.jpg', uploaded: '04/09/2026 09:31', status: 'Pendiente' },
  { member: 'Pedro Lima', document: '42.667.310', file: 'apto-2026.pdf', uploaded: '05/09/2026 18:02', status: 'Pendiente' },
  { member: 'Juan Manuel Pérez', document: '40.123.456', file: 'apto-medico-2026.pdf', uploaded: '01/09/2026 12:40', status: 'Aprobado' },
  { member: 'Micaela Rossi', document: '38.554.201', file: 'apto-agosto.jpg', uploaded: '20/08/2026 15:18', status: 'Rechazado' },
]

function StatusBadge({ status }: { status: string }) {
  const className = status === 'Aprobado' ? 'badge-info' : status === 'Rechazado' ? 'badge-primary' : 'badge-secondary'
  return <span className={`badge ${className}`}>{status}</span>
}

export function MemberMedicalScreen() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    return () => { if (preview) URL.revokeObjectURL(preview) }
  }, [preview])

  function selectFile(selected: File | undefined) {
    setError('')
    setNotice('')
    if (!selected) { setFile(null); setPreview(''); return }
    if (!ACCEPTED_TYPES.includes(selected.type)) { setError('El archivo debe ser PDF, JPG o PNG.'); setFile(null); setPreview(''); return }
    if (selected.size > MAX_UPLOAD_SIZE_MB * 1024 * 1024) { setError(`El archivo no puede superar ${MAX_UPLOAD_SIZE_MB} MB.`); setFile(null); setPreview(''); return }
    setPreview(selected.type.startsWith('image/') ? URL.createObjectURL(selected) : '')
    setFile(selected)
  }

  return <div className="medical-member-grid">
    <div className="medical-member-main">
      <section className="surface-card medical-current-card"><div className="dashboard-section-title"><h2>Certificado actual</h2><StatusBadge status="Aprobado"/></div><div className="medical-current-file"><span className="medical-file-icon"><Icon name="file" size={28}/></span><div><strong>apto-medico-2026.pdf</strong><span>Cargado el 01/09/2026 · 1,4 MB</span><span>Revisado por Lara Frenkel el 02/09/2026</span><button className="button button-secondary" type="button" onClick={() => setNotice('La descarga del documento requiere el servicio protegido de archivos médicos.')}>Ver documento</button></div></div></section>
      <section className="surface-card medical-upload-card"><h2>Cargar un nuevo certificado</h2><label className="medical-dropzone"><Icon name="file" size={30}/><strong>{file ? file.name : 'Arrastrá el archivo o hacé clic para buscar'}</strong><span>PDF, JPG o PNG · hasta {MAX_UPLOAD_SIZE_MB} MB</span><input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={event => selectFile(event.target.files?.[0])}/>{file?.type.startsWith('image/') && preview && <img className="medical-image-preview" src={preview} alt="Vista previa del certificado seleccionado"/>}</label>{error && <p className="error-message" role="alert">{error}</p>}{notice && <p className="notice-inline" role="status">{notice}</p>}<button className="button button-primary" disabled={!file} onClick={() => setNotice('El archivo está listo para enviar, pero el servicio de carga de aptos médicos todavía no existe. No se guardó.')}>Enviar para revisión</button></section>
      <section className="surface-card medical-history"><h2>Historial de aptos</h2><div><Icon name="file"/><span><strong>apto-medico-2026.pdf</strong><small>Cargado 01/09/2026 · revisado 02/09/2026</small></span><StatusBadge status="Aprobado"/></div><div><Icon name="file"/><span><strong>apto-agosto.jpg</strong><small>Rechazado: “La imagen está cortada, no se ve la firma.”</small></span><StatusBadge status="Rechazado"/></div></section>
    </div>
    <aside className="medical-member-aside"><section className="surface-card"><h2>Período inicial</h2><p>Durante los primeros 20 días desde tu primer pago podés ingresar aunque el apto todavía no esté aprobado.</p><dl><div><dt>Estado</dt><dd>Finalizado</dd></div><div><dt>Comenzó</dt><dd>12/07/2026</dd></div></dl></section><section className="surface-card"><h2>Qué tiene que decir el certificado</h2><ul><li>Nombre completo y documento</li><li>Fecha de emisión</li><li>Aptitud para actividad física</li><li>Firma y sello del profesional</li></ul></section></aside>
  </div>
}

export function AdminMedicalScreen({ onReview }: { onReview: (member: string) => void }) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('Todos')
  const [dateFilter, setDateFilter] = useState('Todas')
  const rows = useMemo(() => FIGMA_PREVIEW_CERTIFICATES.filter(item => `${item.member} ${item.document}`.toLowerCase().includes(query.toLowerCase()) && (status === 'Todos' || item.status === status) && (dateFilter === 'Todas' || item.uploaded.startsWith(dateFilter))), [query,status,dateFilter])

  return <>
    <div className="dashboard-stat-grid medical-admin-stats"><PreviewStat label="Pendientes de revisión" value="7 aptos" hint="El más antiguo hace 3 días" tone="purple"/><PreviewStat label="Aprobados" value="162 aptos" hint="Sin fecha de vencimiento" tone="blue"/><PreviewStat label="Rechazados" value="5 aptos" hint="Esperando una nueva carga" tone="pink"/><PreviewStat label="En período inicial" value="3 socios" hint="Pueden ingresar sin apto" tone="purple"/></div>
    <section className="surface-card"><div className="toolbar medical-filter-toolbar"><label className="search-shell"><Icon name="search"/><input placeholder="Buscar por socio o documento" value={query} onChange={event=>setQuery(event.target.value)}/></label><select aria-label="Filtrar por estado" value={status} onChange={event=>setStatus(event.target.value)}><option>Todos</option><option>Pendiente</option><option>Aprobado</option><option>Rechazado</option></select><select aria-label="Filtrar por fecha de carga" value={dateFilter} onChange={event=>setDateFilter(event.target.value)}><option value="Todas">Fecha de carga: todas</option><option value="03/09/2026">03/09/2026</option><option value="04/09/2026">04/09/2026</option><option value="05/09/2026">05/09/2026</option></select></div><div className="table-scroll"><table className="data-table"><thead><tr><th>Socio</th><th>Documento</th><th>Archivo</th><th>Cargado</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{rows.map(item=><tr key={item.member}><td>{item.member}</td><td>{item.document}</td><td>{item.file}</td><td>{item.uploaded}</td><td><StatusBadge status={item.status}/></td><td><button className="button button-secondary medical-review-button" onClick={()=>onReview(item.member)}>{item.status==='Pendiente'?'Revisar':'Ver'}</button></td></tr>)}</tbody></table>{rows.length===0 && <div className="empty-state"><Icon name="search"/><p>No hay aptos que coincidan con estos filtros.</p></div>}</div></section>
    <p className="integration-pending-note">Datos de referencia visual de Figma. La consulta, descarga y revisión de documentos requiere el servicio de aptos médicos.</p>
  </>
}

function PreviewStat({ label, value, hint, tone }: { label:string; value:string; hint:string; tone:string }) { return <article className="stat-card"><span className={`stat-icon ${tone}`}><Icon name={tone==='blue'?'check':tone==='pink'?'alert':'file'}/></span><div><span>{label}</span><strong>{value}</strong><small>{hint}</small></div></article> }
