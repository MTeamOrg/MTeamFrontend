import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from './Icon'

type ClassItem = { time: string; activity: string; branch: string; trainer: string; tone: 'pink' | 'purple' | 'blue' }
type Day = { label: string; date: string; classes: ClassItem[] }

// These class rows match the Figma calendar for layout preview only; class data must come from the weekly-schedule API.
const FIGMA_PREVIEW_WEEK: Day[] = [
  { label:'Lunes',date:'7 sep',classes:[{time:'08:00',activity:'Funcional',branch:'V. Urquiza',trainer:'Carla Giménez',tone:'pink'},{time:'18:00',activity:'Musculación',branch:'Belgrano',trainer:'Diego Ruiz',tone:'purple'},{time:'20:00',activity:'Spinning',branch:'Belgrano',trainer:'Carla Giménez',tone:'blue'}] },
  { label:'Martes',date:'8 sep',classes:[{time:'09:00',activity:'Yoga',branch:'Belgrano',trainer:'Sofía Núñez',tone:'purple'},{time:'19:00',activity:'Crossfit',branch:'V. Urquiza',trainer:'Diego Ruiz',tone:'pink'}] },
  { label:'Miércoles',date:'9 sep',classes:[{time:'08:00',activity:'Funcional',branch:'V. Urquiza',trainer:'Carla Giménez',tone:'pink'},{time:'18:00',activity:'Boxeo',branch:'Belgrano',trainer:'Martín Sosa',tone:'blue'},{time:'20:00',activity:'Spinning',branch:'Belgrano',trainer:'Carla Giménez',tone:'blue'}] },
  { label:'Jueves',date:'10 sep',classes:[{time:'09:00',activity:'Yoga',branch:'Belgrano',trainer:'Sofía Núñez',tone:'purple'},{time:'19:00',activity:'Crossfit',branch:'V. Urquiza',trainer:'Diego Ruiz',tone:'pink'}] },
  { label:'Viernes',date:'11 sep',classes:[{time:'08:00',activity:'Funcional',branch:'V. Urquiza',trainer:'Carla Giménez',tone:'pink'},{time:'18:30',activity:'Zumba',branch:'Belgrano',trainer:'Sofía Núñez',tone:'purple'}] },
  { label:'Sábado',date:'12 sep',classes:[{time:'10:00',activity:'Funcional',branch:'Belgrano',trainer:'Martín Sosa',tone:'pink'}] },
]

function CalendarControls({ week, setWeek, branch, setBranch, admin = false, onAction }: { week:number; setWeek:(value:number)=>void; branch:string; setBranch:(value:string)=>void; admin?:boolean; onAction?:(label:string)=>void }) {
  return <div className="class-calendar-controls"><div className="week-controls"><button className="icon-action" aria-label="Semana anterior" onClick={()=>setWeek(week-1)}>‹</button><strong>{weekLabel(week)}</strong><button className="icon-action" aria-label="Semana siguiente" onClick={()=>setWeek(week+1)}>›</button></div><select value={branch} onChange={event=>setBranch(event.target.value)} aria-label="Filtrar clases por sede"><option>Todas las sedes</option><option>Villa Urquiza</option><option>Belgrano</option></select>{admin && <div className="class-admin-actions"><button className="button button-purple" onClick={()=>onAction?.('Generar desde la semana anterior')}><Icon name="copy"/> Copiar a la semana siguiente</button><button className="button button-primary" onClick={()=>onAction?.('Nueva clase')}><Icon name="plus"/> Nueva clase</button></div>}</div>
}

export function MemberClassCalendar({ trainer = false, trainerName = '' }: { trainer?:boolean; trainerName?:string }) {
  const [week,setWeek]=useState(0)
  const [branch,setBranch]=useState('Todas las sedes')
  const [selectedDay,setSelectedDay]=useState(0)
  const days=useMemo(()=>FIGMA_PREVIEW_WEEK.map(day=>({...day,classes:day.classes.filter(item=>(branch==='Todas las sedes'||item.branch===(branch==='Villa Urquiza'?'V. Urquiza':'Belgrano'))&&(!trainer||item.trainer.toLocaleLowerCase('es-AR')===trainerName.toLocaleLowerCase('es-AR')))})),[branch,trainer,trainerName])
  const visibleDays=days.slice(selectedDay)
  return <section className="class-calendar-page"><p className="class-calendar-intro">Cronograma informativo: no hay reservas ni cupos, podés acercarte al horario de la clase.</p><CalendarControls week={week} setWeek={setWeek} branch={branch} setBranch={setBranch}/><nav className="class-day-tabs" aria-label="Días de la semana">{days.slice(0,5).map((day,index)=><button key={day.label} className={selectedDay===index?'selected':''} onClick={()=>setSelectedDay(index)}>{day.label.slice(0,3)} {dateAt(index,week).getDate()}</button>)}</nav><div className="class-week-list">{visibleDays.map((day,index)=>{const date=dateAt(selectedDay+index,week);return <section className="class-day-group" key={`${week}-${day.label}`}><h2>{day.label} {date.getDate()} de {date.toLocaleDateString('es-AR',{month:'long'})}</h2>{day.classes.length?day.classes.map(item=><ClassListCard key={`${item.time}-${item.activity}`} item={item} trainer={trainer}/>):<p className="empty-state">No hay clases programadas para este día.</p>}</section>})}</div>{!trainer&&<Link className="text-link class-trainer-link" to="/socio/entrenadores">Conocer a los entrenadores asignados →</Link>}</section>
}

export function AdminClassCalendar({ onAction }: { onAction:(label:string)=>void }) {
  const [week,setWeek]=useState(0)
  const [branch,setBranch]=useState('Todas las sedes')
  const days=FIGMA_PREVIEW_WEEK.map(day=>({...day,classes:day.classes.filter(item=>branch==='Todas las sedes'||item.branch===(branch==='Villa Urquiza'?'V. Urquiza':'Belgrano'))}))
  return <section className="class-calendar-page admin-class-calendar"><CalendarControls week={week} setWeek={setWeek} branch={branch} setBranch={setBranch} admin onAction={onAction}/>{week===1 && <p className="schedule-note"><Icon name="alert"/> La semana siguiente todavía no fue generada. Al copiarla se trasladará la distribución anterior y podrás editarla.</p>}<div className="admin-week-grid">{days.map((day,index)=><section className="admin-day-column" key={day.label}><h2>{day.label}<small>{dateAt(index,week).getDate()} {dateAt(index,week).toLocaleDateString('es-AR',{month:'short'}).replace('.','')}</small></h2>{day.classes.map(item=><button className={`admin-class-chip ${item.tone}`} key={`${item.time}-${item.activity}`} onClick={()=>onAction('Editar clase')}><strong>{item.time} · {item.activity}</strong><span>{item.branch}</span><small>{item.trainer}</small></button>)}<button className="admin-add-class" onClick={()=>onAction('Nueva clase')}><Icon name="plus"/> Agregar</button></section>)}</div></section>
}

function ClassListCard({ item, trainer }: { item:ClassItem; trainer:boolean }) {
  return <article className="class-list-card"><strong>{item.time}<small>60 min</small></strong><span className={`class-divider ${item.tone}`}/><div><h3>{item.activity}</h3><p>{item.branch}{!trainer&&` · ${item.trainer}`}</p></div>{trainer&&<span className="badge badge-neutral">Asignada</span>}</article>
}

function dateAt(dayIndex:number,weekOffset:number){return new Date(2026,8,7+dayIndex+weekOffset*7)}
function weekLabel(weekOffset:number){const start=dateAt(0,weekOffset);const end=dateAt(5,weekOffset);const month=start.toLocaleDateString('es-AR',{month:'long'});const endMonth=end.toLocaleDateString('es-AR',{month:'long'});return `Semana del ${start.getDate()} al ${end.getDate()} de ${month===endMonth?month:`${month} / ${endMonth}`}`}
