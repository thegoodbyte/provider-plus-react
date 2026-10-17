import { callTimeInput, callTimeToIso } from './screeningCallTime';
it('converts entered Prague and New York wall times to the same UTC appointment',()=>{
 expect(callTimeToIso('2026-10-25T15:30','Europe/Prague')).toBe('2026-10-25T14:30:00.000Z');
 expect(callTimeToIso('2026-10-25T10:30','America/New_York')).toBe('2026-10-25T14:30:00.000Z');
 expect(callTimeInput('2026-10-25T14:30:00Z','Europe/Prague')).toBe('2026-10-25T15:30');
});
it('handles summer offsets and explicit clearing',()=>{
 expect(callTimeToIso('2026-07-01T14:00','Europe/Prague')).toBe('2026-07-01T12:00:00.000Z');
 expect(callTimeToIso('','UTC')).toBeNull();
});
it.each(['2026-03-29T02:30','2026-02-30T12:00'])('rejects nonexistent dates/times: %s',value=>{
 expect(()=>callTimeToIso(value,'Europe/Prague')).toThrow('does not exist');
});
it('rejects ambiguous autumn clock times and invalid timezones',()=>{
 expect(()=>callTimeToIso('2026-10-25T02:30','Europe/Prague')).toThrow('occurs twice');
 expect(()=>callTimeToIso('2026-10-25T15:30','Not/AZone')).toThrow();
});
