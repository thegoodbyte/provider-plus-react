import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { bookingsApi } from '../services/api';
import { buildStayPlanner, plannerDate } from './stayPlannerModel';
import './RetreatStayPlanner.css';
const label = (date: string) => new Intl.DateTimeFormat('en-GB',{weekday:'short',day:'2-digit',month:'short',timeZone:'UTC'}).format(new Date(`${date}T00:00:00Z`));
export default function RetreatStayPlanner({retreatId,retreat}:{retreatId:string;retreat:{startDate?:unknown;endDate?:unknown;capacity?:unknown}}) {
  const [rows,setRows]=useState<any[]|null>(null),[error,setError]=useState(''),[refresh,setRefresh]=useState(0);
  useEffect(()=>{let active=true;setRows(null);setError('');bookingsApi.getByRetreatWithDetails(retreatId,{suppressGlobalError:true}).then(result=>{if(!Array.isArray(result.data))throw Error('Invalid booking response');if(active)setRows(result.data)}).catch(()=>{if(active)setError('Could not load stay bookings. Refresh to try again.');});return()=>{active=false};},[retreatId,refresh]);
  const plan=rows?buildStayPlanner(retreat,rows):null;
  return <section aria-label="Retreat stay planner" className="stay-planner">
    <div className="stay-planner-heading"><div><h2>Stay planner</h2><p>Full retreats and boosters across the retreat, with one numbered lane per guest place.</p></div><button type="button" onClick={()=>setRefresh(value=>value+1)} disabled={!rows&&!error}>Refresh stays</button></div>
    <p className="stay-planner-help">Lanes show guest capacity; they do not assign bedrooms. Check <Link to={`/admin/retreats/${retreatId}/rooms`}>Room allocation</Link> before accepting another guest, especially for private rooms. Checkout frees the place for the next arrival.</p>
    {error?<p role="alert">{error}</p>:!plan?<p role="status">Loading stay planner…</p>:plan.error?<p role="alert">{plan.error}</p>:<>
      <div className="stay-planner-metrics"><div><span>Guest capacity</span><strong>{plan.capacity??'Not configured'}</strong></div><div><span>Peak confirmed occupancy</span><strong>{plan.peak}</strong></div><div><span>Minimum free places per night</span><strong>{plan.minimumFree??'Needs review'}</strong></div></div>
      {(plan.capacity===null||plan.issues.length>0)&&<p role="alert" className="stay-planner-warning">{plan.capacity===null?'Set the retreat capacity before judging availability. ':''}{plan.issues.length>0?'Some confirmed stays have missing or invalid dates/types. Free places cannot be confirmed until these are reviewed.':''}</p>}
      {plan.days.some(day=>day.over>0)&&<p role="alert" className="stay-planner-overflow">Over capacity on {plan.days.filter(day=>day.over>0).map(day=>label(day.date)).join(', ')}. Overflow bookings remain visible below.</p>}
      <div className="stay-planner-legend"><span className="stay-full-key">Full retreat</span><span className="stay-booster-key">Booster</span><span>Empty space = no confirmed stay</span></div>
      <p className="stay-planner-help">Night columns start on the dates shown. Final checkout: {label(plan.checkout)}. Scroll horizontally for all dates.</p>
      <div className="stay-planner-scroll" role="region" aria-label="Stay lanes by night" tabIndex={0}>
        <div className="stay-planner-grid" style={{minWidth:Math.max(720,plan.days.length*112+76),gridTemplateColumns:`76px repeat(${plan.days.length},minmax(112px,1fr))`}}>
          <div className="stay-planner-corner">Place</div>{plan.days.map(day=><div className="stay-planner-day" key={day.date}><strong>{label(day.date)}</strong><span>{day.occupied} occupied · {day.free===null?'?':day.free} free{day.over?` · ${day.over} over`:''}</span></div>)}
          {plan.lanes.map(lane=><React.Fragment key={lane.number}><div className={`stay-planner-lane ${lane.overflow?'stay-planner-lane-over':''}`}>{lane.overflow?'Extra ':''}{lane.number}</div><div className={`stay-planner-track ${lane.overflow?'stay-planner-lane-over':''}`} style={{gridColumn:`2 / span ${plan.days.length}`,gridTemplateColumns:`repeat(${plan.days.length},minmax(0,1fr))`}} aria-label={`Place ${lane.number}${lane.overflow?' overflow':''}`}>
            {plan.days.map(day=><span className="stay-planner-cell" key={day.date}/>)}
            {lane.stays.map(stay=><Link key={stay.id} to={`/admin/bookings/${encodeURIComponent(stay.id)}`} className={`stay-planner-block ${stay.type==='Booster'?'stay-booster':'stay-full'}`} style={{gridColumn:`${plan.days.findIndex(day=>day.day===stay.start)+1} / span ${(stay.end-stay.start)/86400000}`,gridRow:1}} title={`${stay.type} #${stay.bookingNumber} · ${stay.name} · ${label(plannerDate(stay.start))} → ${label(plannerDate(stay.end))}${stay.room?` · Room ${stay.room}`:''}`}><strong>{stay.type} #{stay.bookingNumber}</strong><span>{stay.name}</span></Link>)}
          </div></React.Fragment>)}
        </div>
      </div>
      {!plan.stays.length&&<p>No confirmed full stays or boosters with valid dates in this retreat.</p>}
      {[['Confirmed stays needing review',plan.issues],['Tentative bookings — not counted above',plan.tentative],['Stays outside the retreat dates',plan.outside]].map(([heading,items])=>Array.isArray(items)&&items.length>0?<div key={String(heading)} className="stay-planner-review"><h3>{String(heading)}</h3><ul>{items.map(item=><li key={item.id}><Link to={`/admin/bookings/${encodeURIComponent(item.id)}`}>Booking #{item.bookingNumber}</Link> · {item.reason}</li>)}</ul></div>:null)}
    </>}
  </section>;
}
