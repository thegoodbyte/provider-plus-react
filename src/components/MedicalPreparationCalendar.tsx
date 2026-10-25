import React, { useState } from 'react';

type CalendarItem = { name: string; instruction: string; date: string };
export default function MedicalPreparationCalendar({ items, month, onMonthChange }: {
  items: CalendarItem[]; month: string; onMonthChange: (month: string) => void;
}) {
  const [selectedDate, setSelectedDate] = useState('');
  const firstDay = new Date(`${month}-01T00:00:00Z`).getUTCDay();
  const days = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)).getUTCDate();
  return <section aria-label="Preparation calendar" className="rounded-xl bg-white p-3 md:p-5">
    <label className="flex flex-wrap items-center gap-2 text-sm font-semibold">Calendar month
      <input type="month" value={month} onChange={event => onMonthChange(event.target.value)} className="rounded-lg border p-2" />
    </label>
    <p className="my-3 text-sm text-slate-600">Select an item to read its full instruction.</p>
    <div className="grid grid-cols-7 gap-1">
      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <strong key={day} className="text-center text-xs">{day}</strong>)}
      {Array.from({ length: firstDay }, (_, index) => <div key={`blank-${index}`} />)}
      {Array.from({ length: days }, (_, index) => {
        const date = `${month}-${String(index + 1).padStart(2, '0')}`;
        return <div key={date} className={`min-h-20 min-w-0 rounded border p-1 text-xs ${date === selectedDate ? 'border-violet-600 bg-violet-50' : 'border-slate-200'}`}>
          <time dateTime={date}>{index + 1}</time>
          {items.filter(item => item.date === date).map((item, position) => <button key={position} type="button" aria-label={`${date}: ${item.name}`} title={item.name} onClick={() => setSelectedDate(date)} className="mt-1 block w-full truncate rounded bg-violet-100 px-1 py-2 text-left text-violet-900">{item.name}</button>)}
        </div>;
      })}
    </div>
    {selectedDate && <div aria-label="Selected preparation instructions" className="mt-4 space-y-3 rounded-xl bg-violet-50 p-4">
      <h2 className="font-semibold">{selectedDate}</h2>
      {items.filter(item => item.date === selectedDate).map((item, index) => <article key={index}><h3 className="font-semibold">{item.name}</h3><p className="whitespace-pre-wrap break-words text-sm">{item.instruction}</p></article>)}
    </div>}
  </section>;
}
