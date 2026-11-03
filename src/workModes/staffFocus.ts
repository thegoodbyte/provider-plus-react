import { useEffect, useState } from 'react';
export type StaffFocus = 'all' | 'medical' | 'payments' | 'readiness' | 'tasks';
export const staffFocusModes: Record<StaffFocus,{label:string;description:string;route:string;items:string[]}> = {
 all:{label:'All tools',description:'Browse the complete workspace and settings.',route:'/admin/launcher',items:[]},
 medical:{label:'Process medicals',description:'Review medical documents in your existing guided work sessions.',route:'/admin/work-modes',items:['work-modes','medical-artifacts','medical-review-requests','medical-tracking']},
 payments:{label:'Process payments',description:'Match receipts, review payment requests and check payments.',route:'/admin/payments/scratchpad',items:['payment-scratchpad','payment-requests','payments','payment-receipts']},
 readiness:{label:'Retreat readiness',description:'Check bookings, documents and outstanding preparation steps.',route:'/admin/workflow',items:['workflow','bookings','retreats','booking-flow','booking-step-deadlines','scheduled-reminders','booking-documents']},
 tasks:{label:'Review tasks',description:'Handle IbogaReady requests and operational follow-ups.',route:'/admin/tasks?support=all',items:['tasks','needs-attention']},
};
const read = (owner:string):StaffFocus => {try {const value=localStorage.getItem('staff-focus:'+owner);return owner && value && Object.prototype.hasOwnProperty.call(staffFocusModes,value)?value as StaffFocus:'all';}catch{return 'all';}};
export function useStaffFocus(user:any) {
 const owner=user?.role==='admin'?String(user._id||user.id||user.email||''):'';
 const [saved,setSaved]=useState({owner,mode:read(owner)});
 useEffect(()=>{const refresh=()=>setSaved({owner,mode:read(owner)});refresh();window.addEventListener('staff-focus-change',refresh);window.addEventListener('storage',refresh);return()=>{window.removeEventListener('staff-focus-change',refresh);window.removeEventListener('storage',refresh);};},[owner]);
 const mode=saved.owner===owner?saved.mode:'all';
 return {mode,setMode:(value:StaffFocus)=>{if(!owner)return;try{localStorage.setItem('staff-focus:'+owner,value);}catch{}setSaved({owner,mode:value});window.dispatchEvent(new Event('staff-focus-change'));}};
}
