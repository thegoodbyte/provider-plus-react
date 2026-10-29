import {buildStayPlanner as build,plannerDay} from './stayPlannerModel';
const retreat={startDate:'2026-10-24',endDate:'2026-10-31',capacity:8};
const booking=(id:string,extra:any={})=>({_id:id,bookingNumber:id,bookingType:'full_retreat',status:'confirmed',clientId:{firstName:'Synthetic',lastName:id},...extra});
it('counts all six full-retreat clients despite stale actual check-in/out timestamps, without changing records',()=>{
 const event={startDate:'2026-11-06',endDate:'2026-11-13',capacity:6};
 const rows=[booking('1265',{checkInDate:'2026-07-06T18:00:00Z',checkOutDate:'2026-07-06T09:00:00Z'}),booking('1266',{checkInDate:'2026-07-07',checkOutDate:'2026-07-14'}),booking('1274'),booking('1275',{checkInDate:'2026-08-01',checkOutDate:'2026-08-08'}),booking('1301',{checkInDate:'2026-11-06',checkOutDate:'2026-11-13'}),booking('1306',{bookingType:undefined,checkInDate:'bad',checkOutDate:'2026-09-01'})];
 const before=JSON.stringify(rows),p=build(event,rows);
 expect(p.stays).toHaveLength(6);expect(p.lanes).toHaveLength(6);expect(p.issues).toEqual([]);expect(p.outside).toEqual([]);expect(p.peak).toBe(6);expect(p.minimumFree).toBe(0);expect(p.days.map(d=>[d.occupied,d.free])).toEqual(Array(7).fill([6,0]));expect(JSON.stringify(rows)).toBe(before);
});
it('keeps explicit full-retreat room-stay overrides authoritative and invalid overrides under review',()=>{
 const p=build(retreat,[booking('partial',{roomStayStart:'2026-10-25',roomStayEnd:'2026-10-27',checkInDate:'2026-07-01',checkOutDate:'2026-07-02'})]);expect(p.days.map(d=>d.occupied)).toEqual([0,1,1,0,0,0,0]);
 const bad=build(retreat,[booking('invalid',{roomStayStart:'bad',roomStayEnd:'2026-10-27'})]);expect(bad.issues).toHaveLength(1);expect(bad.minimumFree).toBeNull();
});
it('renders configured eight lanes and packs sequential boosters while full stays span every night',()=>{
 const p=build(retreat,[booking('1311'),booking('1312',{bookingType:'booster',checkInDate:'2026-10-24',checkOutDate:'2026-10-27'}),booking('1313',{bookingType:'booster',checkInDate:'2026-10-27',checkOutDate:'2026-10-31'})]);
 expect(p.lanes).toHaveLength(8);expect(p.stays.find(s=>s.id==='1312')?.lane).toBe(p.stays.find(s=>s.id==='1313')?.lane);expect(p.days.map(d=>d.occupied)).toEqual([2,2,2,2,2,2,2]);expect(p.minimumFree).toBe(6);expect(p.stays[0].end-p.stays[0].start).toBe(7*86400000);
});
it('never overlaps bars in a lane and retains capacity overflow instead of hiding guests',()=>{
 const p=build({...retreat,capacity:1},[booking('1'),booking('2')]);expect(p.lanes).toHaveLength(2);expect(p.lanes[1].overflow).toBe(true);expect(p.days.every(d=>d.over===1&&d.free===0)).toBe(true);
});
it('does not fabricate free capacity when configured capacity or confirmed booster dates are missing',()=>{
 expect(build({...retreat,capacity:undefined},[]).minimumFree).toBeNull();expect(build({...retreat,capacity:0},[]).capacity).toBeNull();
 const p=build(retreat,[booking('B',{bookingType:'booster'})]);expect(p.issues).toHaveLength(1);expect(p.minimumFree).toBeNull();expect(p.days.every(d=>d.free===null)).toBe(true);
});
it('uses room-stay overrides before recorded check-in/out and clips to retreat boundaries',()=>{
 const p=build(retreat,[booking('B',{bookingType:'booster',roomStayStart:'2026-10-23',roomStayEnd:'2026-10-26',checkInDate:'2026-10-25',checkOutDate:'2026-10-30'}),booking('outside',{bookingType:'booster',checkInDate:'2026-11-01',checkOutDate:'2026-11-03'})]);expect(p.days.map(d=>d.occupied)).toEqual([1,1,0,0,0,0,0]);expect(p.outside).toHaveLength(1);
});
it('excludes cancellations and separates tentative bookings without consuming confirmed places',()=>{
 const p=build(retreat,[...['cancelled','canceled','moved','declined'].map(s=>booking(s,{status:s})),booking('pending',{status:'pending'}),booking('conditional',{status:'conditional'}),booking('arrived',{status:'checked-in'}),booking('left',{status:'checked-out'})]);expect(p.stays).toHaveLength(2);expect(p.tentative).toHaveLength(2);expect(p.minimumFree).toBe(6);
});
it('handles leap, month/year and DST boundaries with date-only night counts',()=>{
 for(const [startDate,endDate,nights] of [['2028-02-28','2028-03-01',2],['2026-12-30','2027-01-02',3],['2026-10-24','2026-10-27',3]] as const){const p=build({startDate,endDate,capacity:8},[booking('one')]);expect(p.days).toHaveLength(nights);expect(p.days.every(d=>d.occupied===1)).toBe(true);}
 expect(plannerDay('2026-10-24T23:30:00-07:00')).toBe(plannerDay('2026-10-25'));expect(plannerDay('2026-02-30')).toBeNull();expect(plannerDay('bad')).toBeNull();expect(plannerDay('2026-10-24Tinvalid')).toBeNull();
});
it('rejects reversed/missing dates, deduplicates IDs and stays deterministic under reordered API results',()=>{
 expect(build({startDate:'2026-10-31',endDate:'2026-10-24'},[]).error).not.toBe('');
 const rows=[booking('A'),booking('B')];expect(build(retreat,[...rows,rows[0]]).stays).toHaveLength(2);expect(build(retreat,rows).stays).toEqual(build(retreat,[...rows].reverse()).stays);
 const invalid=build(retreat,[booking('reverse',{bookingType:'booster',checkInDate:'2026-10-27',checkOutDate:'2026-10-25'})]);expect(invalid.issues).toHaveLength(1);expect(invalid.minimumFree).toBeNull();
});

it('uses retreat-local days for saved booster instants across DST, independent of browser timezone',()=>{
 const p=build({startDate:'2099-03-28',endDate:'2099-04-04',capacity:2},[booking('booster',{bookingType:'booster',checkInDate:'2099-03-30T22:00:00Z',checkOutDate:'2099-03-31T22:00:00Z'})]);expect(p.days.map(d=>d.occupied)).toEqual([0,0,0,1,0,0,0]);
});
