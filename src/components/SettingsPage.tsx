import React, { FormEvent, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Pencil, Plus } from 'lucide-react';
import { expenseTypesApi, paymentMethodsApi } from '../services/api';
import { ExpenseType, PaymentMethod } from '../types';

const categories: ExpenseType['category'][] = ['accommodation', 'transport', 'food', 'activities', 'staff', 'utilities', 'general'];

const SettingsPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const prefix = `/${location.pathname.split('/').filter(Boolean)[0] || 'admin'}`;
  const expenseTab = location.pathname.endsWith('/expense-types');
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [types, setTypes] = useState<ExpenseType[]>([]);
  const [method, setMethod] = useState({ _id: '', name: '', description: '', sortOrder: 0 });
  const [type, setType] = useState({ _id: '', name: '', description: '', category: 'general' as ExpenseType['category'] });
  const [error, setError] = useState('');
  const loadMethods = async () => setMethods((await paymentMethodsApi.getAll(true)).data || []);
  const loadTypes = async () => setTypes((await expenseTypesApi.getAllIncludingInactive()).data || []);
  useEffect(() => { Promise.all([loadMethods(), loadTypes()]).catch((e) => setError(e?.response?.data?.message || 'Could not load settings.')); }, []);

  const saveMethod = async (event: FormEvent) => {
    event.preventDefault(); setError('');
    try {
      const payload = { name: method.name.trim(), description: method.description.trim(), sortOrder: method.sortOrder, isActive: true };
      method._id ? await paymentMethodsApi.update(method._id, payload) : await paymentMethodsApi.create(payload);
      setMethod({ _id: '', name: '', description: '', sortOrder: 0 }); await loadMethods();
    } catch (e: any) { setError(e?.response?.data?.message || 'Could not save payment method.'); }
  };
  const saveType = async (event: FormEvent) => {
    event.preventDefault(); setError('');
    try {
      const payload = { name: type.name.trim(), description: type.description.trim(), category: type.category, defaultCurrency: 'CZK', defaultAmount: 0, isActive: true };
      type._id ? await expenseTypesApi.update(type._id, payload) : await expenseTypesApi.create(payload);
      setType({ _id: '', name: '', description: '', category: 'general' }); await loadTypes();
    } catch (e: any) { setError(e?.response?.data?.message || 'Could not save expense type.'); }
  };
  const field = 'min-h-11 rounded-xl border border-slate-300 px-3 outline-none focus:border-blue-500';

  return <div className="mx-auto max-w-5xl space-y-5">
    <div><h1 className="text-3xl font-extrabold text-slate-950">Settings</h1><p className="mt-1 text-slate-500">Shared information used throughout Provider Plus.</p></div>
    <nav className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
      <button onClick={() => navigate(`${prefix}/settings/finance/payment-methods`)} className={`min-h-11 rounded-xl px-4 font-bold ${!expenseTab ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-100'}`}>Payment methods</button>
      <button onClick={() => navigate(`${prefix}/settings/finance/expense-types`)} className={`min-h-11 rounded-xl px-4 font-bold ${expenseTab ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-100'}`}>Expense types</button>
    </nav>
    {error && <div className="rounded-xl bg-red-50 p-3 font-semibold text-red-700">{error}</div>}
    {!expenseTab ? <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-extrabold">Payment methods</h2><p className="mb-5 text-sm text-slate-500">Deactivate methods instead of deleting them so historical expenses remain readable.</p>
      <form onSubmit={saveMethod} className="mb-5 grid gap-3 md:grid-cols-[1fr_1.4fr_100px_auto]"><input required className={field} placeholder="Name" value={method.name} onChange={e=>setMethod({...method,name:e.target.value})}/><input className={field} placeholder="Description" value={method.description} onChange={e=>setMethod({...method,description:e.target.value})}/><input className={field} type="number" min="0" value={method.sortOrder} onChange={e=>setMethod({...method,sortOrder:Number(e.target.value)})}/><button className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 font-bold text-white"><Plus size={18}/>{method._id?'Save':'Add'}</button></form>
      <div className="divide-y divide-slate-100">{methods.map(item=><div key={item._id} className={`flex items-center gap-3 py-3 ${item.isActive===false?'opacity-50':''}`}><div className="min-w-0 flex-1"><div className="font-bold">{item.name}</div><div className="truncate text-sm text-slate-500">{item.description||'No description'}</div></div><button aria-label="Edit" onClick={()=>setMethod({_id:item._id||'',name:item.name,description:item.description||'',sortOrder:item.sortOrder||0})} className="rounded-lg p-2 hover:bg-slate-100"><Pencil size={18}/></button><button onClick={async()=>{if(item._id){item.isActive===false?await paymentMethodsApi.activate(item._id):await paymentMethodsApi.deactivate(item._id);await loadMethods();}}} className="min-h-10 rounded-lg bg-slate-100 px-3 font-bold">{item.isActive===false?'Activate':'Deactivate'}</button></div>)}</div>
    </section> : <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-extrabold">Expense types</h2><p className="mb-5 text-sm text-slate-500">Categories shared by all retreats and company expenses.</p>
      <form onSubmit={saveType} className="mb-5 grid gap-3 md:grid-cols-[1fr_1.4fr_180px_auto]"><input required className={field} placeholder="Name" value={type.name} onChange={e=>setType({...type,name:e.target.value})}/><input className={field} placeholder="Description" value={type.description} onChange={e=>setType({...type,description:e.target.value})}/><select className={field} value={type.category} onChange={e=>setType({...type,category:e.target.value as ExpenseType['category']})}>{categories.map(value=><option key={value}>{value}</option>)}</select><button className="rounded-xl bg-blue-600 px-4 font-bold text-white">{type._id?'Save':'Add'}</button></form>
      <div className="divide-y divide-slate-100">{types.map(item=><div key={item._id} className={`flex items-center gap-3 py-3 ${item.isActive===false?'opacity-50':''}`}><div className="min-w-0 flex-1"><div className="font-bold">{item.name}</div><div className="text-sm capitalize text-slate-500">{item.category}</div></div><button aria-label="Edit" onClick={()=>setType({_id:item._id||'',name:item.name,description:item.description||'',category:item.category})} className="rounded-lg p-2 hover:bg-slate-100"><Pencil size={18}/></button><button onClick={async()=>{if(item._id){item.isActive===false?await expenseTypesApi.activate(item._id):await expenseTypesApi.deactivate(item._id);await loadTypes();}}} className="min-h-10 rounded-lg bg-slate-100 px-3 font-bold">{item.isActive===false?'Activate':'Deactivate'}</button></div>)}</div>
    </section>}
  </div>;
};

export default SettingsPage;
