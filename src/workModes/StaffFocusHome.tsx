import React,{useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {useAuth} from '../context/AuthContext';
import {staffFocusModes,StaffFocus,useStaffFocus} from './staffFocus';
import {useWorkMode} from './WorkModeContext';
import './staffFocus.css';
export default function StaffFocusHome(){
 const {user}=useAuth();const focus=useStaffFocus(user),medical=useWorkMode(),navigate=useNavigate();const [error,setError]=useState(''),[busy,setBusy]=useState(false);
 const choose=async(mode:StaffFocus)=>{setBusy(true);setError('');try{if(medical.active && mode!=='medical')await medical.exit();focus.setMode(mode);navigate(staffFocusModes[mode].route);}catch{setError('Could not switch modes. Your medical session is kept. Please retry.');}finally{setBusy(false);}};
 return <main className="staff-focus-home"><p className="staff-focus-eyebrow">Your workspace</p><h1>What would you like to focus on?</h1><p>Choose one area. You can switch at any time, and your existing work stays available.</p>{error&&<p role="alert">{error}</p>}
 {medical.data?.sessions?.some((s:any)=>s.status!=='finished')&&<p role="status">Your medical work sessions are available under Process medicals.</p>}
 <div className="staff-focus-grid">{(Object.entries(staffFocusModes) as [StaffFocus,typeof staffFocusModes.all][]).filter(([key])=>key!=='all').map(([key,value])=><button key={key} disabled={busy} onClick={()=>void choose(key)}><span>{value.label}</span><p>{value.description}</p><small>{focus.mode===key?'Current focus':'Open workspace'} →</small></button>)}</div>
 <button className="staff-all-tools" disabled={busy} onClick={()=>void choose('all')}>All tools & settings →</button>
 </main>;
}
