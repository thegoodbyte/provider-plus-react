import React, { useEffect, useMemo, useState } from 'react';
import { Button, Checkbox, DatePicker, Input, Modal, Radio, Tag, Upload, message } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import dayjs from 'dayjs';
import { drugScreeningsApi } from '../services/api';

type RetreatClient = { _id: string; clientId: string; clientName: string; bookingNumber?: string | number };
type Screening = { _id: string; bookingId: string; clientId: string; administeredAt: string; testedFor: string[]; result: string; notes?: string; imageUrl?: string; imageFileName?: string };
const SUBSTANCES = ['THC', 'Cocaine', 'Opiates', 'Amphetamines', 'Methamphetamines', 'Benzodiazepines', 'Barbiturates', 'Methadone', 'Buprenorphine', 'PCP'];
const emptyForm = () => ({ administeredAt: dayjs(), testedFor: [] as string[], result: 'negative', notes: '', image: undefined as File | undefined });

const DrugScreeningTab: React.FC<{ retreatId: string; clients: RetreatClient[] }> = ({ retreatId, clients }) => {
  const [records, setRecords] = useState<Screening[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<RetreatClient | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [files, setFiles] = useState<UploadFile[]>([]);
  const recordByBooking = useMemo(() => new Map(records.map(r => [String(r.bookingId), r])), [records]);

  const load = async () => { try { setLoading(true); setRecords((await drugScreeningsApi.list(retreatId)).data || []); } catch { message.error('Could not load drug screening records'); } finally { setLoading(false); } };
  useEffect(() => { load(); }, [retreatId]); // eslint-disable-line react-hooks/exhaustive-deps

  const open = (client: RetreatClient) => {
    const existing = recordByBooking.get(client._id);
    setSelected(client);
    setForm(existing ? { administeredAt: dayjs(existing.administeredAt), testedFor: existing.testedFor || [], result: existing.result, notes: existing.notes || '', image: undefined } : emptyForm());
    setFiles([]);
  };
  const save = async () => {
    if (!selected || !form.testedFor.length) { message.warning('Select at least one substance tested for'); return; }
    try {
      setSaving(true);
      await drugScreeningsApi.save(retreatId, selected._id, { clientId: selected.clientId, administeredAt: form.administeredAt.toISOString(), testedFor: form.testedFor, result: form.result, notes: form.notes }, form.image);
      message.success(recordByBooking.has(selected._id) ? 'Drug screening updated' : 'Drug screening recorded');
      setSelected(null); await load();
    } catch (error: any) { message.error(error?.response?.data?.message || 'Could not save drug screening'); } finally { setSaving(false); }
  };
  const complete = records.length;

  return <div className="drug-screening-panel">
    <div className="drug-screening-heading">
      <div><h2>Drug Screening</h2><p>One on-site screening per retreat attendee. Records are stored against the attendee's booking.</p></div>
      <div className="drug-screening-progress"><strong>{complete} / {clients.length}</strong><span>completed</span></div>
    </div>
    <div className="drug-screening-summary"><div><span>Completed</span><strong>{complete}</strong></div><div><span>Remaining</span><strong>{Math.max(clients.length - complete, 0)}</strong></div><div><span>Positive / inconclusive</span><strong>{records.filter(r => r.result === 'positive' || r.result === 'inconclusive').length}</strong></div></div>
    <div className="drug-screening-table-wrap"><table className="drug-screening-table"><thead><tr><th>Attendee</th><th>Status</th><th>Time given</th><th>Tested for</th><th>Result</th><th>Image</th><th></th></tr></thead><tbody>
      {clients.map(client => { const r = recordByBooking.get(client._id); return <tr key={client._id}><td><strong>{client.clientName}</strong><small>Booking #{client.bookingNumber || '—'}</small></td><td>{r ? <Tag color="green">Test recorded</Tag> : <Tag>Not tested</Tag>}</td><td>{r ? dayjs(r.administeredAt).format('MMM D, YYYY h:mm A') : '—'}</td><td><div className="drug-tags">{r?.testedFor?.slice(0, 3).map(v => <Tag key={v}>{v}</Tag>)}{(r?.testedFor?.length || 0) > 3 && <Tag>+{r!.testedFor.length - 3}</Tag>}</div></td><td>{r ? <Tag color={r.result === 'negative' ? 'green' : r.result === 'positive' ? 'red' : 'orange'}>{r.result.toUpperCase()}</Tag> : '—'}</td><td>{r?.imageUrl ? <a href={r.imageUrl} target="_blank" rel="noreferrer">View image</a> : '—'}</td><td><Button onClick={() => open(client)}>{r ? 'View / edit' : 'Record test'}</Button></td></tr>; })}
      {!clients.length && !loading && <tr><td colSpan={7} className="drug-empty">No attendees are booked on this retreat.</td></tr>}
    </tbody></table></div>
    <Modal open={Boolean(selected)} title={`${recordByBooking.has(selected?._id || '') ? 'Edit' : 'Record'} drug screening — ${selected?.clientName || ''}`} onCancel={() => setSelected(null)} onOk={save} confirmLoading={saving} okText="Save screening" width={680}>
      <div className="drug-form"><label>Time given <span>*</span></label><DatePicker showTime use12Hours format="MMM D, YYYY h:mm A" value={form.administeredAt} onChange={v => v && setForm({ ...form, administeredAt: v })} />
      <label>Tested for <span>*</span></label><Checkbox.Group options={SUBSTANCES} value={form.testedFor} onChange={v => setForm({ ...form, testedFor: v as string[] })} className="drug-checkboxes" />
      <label>Result <span>*</span></label><Radio.Group value={form.result} onChange={e => setForm({ ...form, result: e.target.value })}><Radio value="negative">Negative</Radio><Radio value="positive">Positive</Radio><Radio value="inconclusive">Inconclusive</Radio><Radio value="refused">Refused</Radio></Radio.Group>
      <label>Test image</label><Upload accept="image/*" maxCount={1} beforeUpload={file => { setForm({ ...form, image: file }); setFiles([file]); return false; }} onRemove={() => { setForm({ ...form, image: undefined }); setFiles([]); }} fileList={files}><Button>Choose image</Button></Upload>
      <label>Notes</label><Input.TextArea rows={4} maxLength={4000} showCount value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Optional observations or follow-up details" /></div>
    </Modal>
  </div>;
};
export default DrugScreeningTab;
