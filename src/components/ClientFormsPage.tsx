import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Coffee, FileText, Pill } from 'lucide-react';

const forms = [
  {
    title: 'Food intake forms',
    description: 'Submitted dietary preferences, allergies, and kitchen requirements.',
    action: 'Open food forms',
    route: '/admin/client-food-forms',
    Icon: Coffee,
  },
  {
    title: 'Medication forms',
    description: 'Client medication records and 30-day medication submissions.',
    action: 'Open medication forms',
    route: '/admin/client-medications',
    Icon: Pill,
  },
  {
    title: 'Questionnaires',
    description: 'Health and preparation questionnaires submitted by clients.',
    action: 'Open questionnaire records',
    route: '/admin/medical-artifacts?type=questionnaire',
    Icon: ClipboardList,
  },
];

export const ClientFormsPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <main className="min-h-full bg-gray-50 p-6 md:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-start gap-4">
          <div className="rounded-xl bg-blue-100 p-3 text-blue-700"><FileText size={24} /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Client Forms</h1>
            <p className="mt-1 text-gray-600">Review forms submitted by clients, grouped separately from clinical medical records.</p>
          </div>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {forms.map(({ title, description, action, route, Icon }) => (
            <button
              key={title}
              type="button"
              onClick={() => navigate(route)}
              className="group rounded-xl border border-gray-200 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
            >
              <Icon className="mb-5 text-blue-700" size={25} />
              <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
              <p className="mt-2 min-h-12 text-sm leading-6 text-gray-600">{description}</p>
              <span className="mt-5 inline-block text-sm font-semibold text-blue-700 group-hover:text-blue-800">{action} →</span>
            </button>
          ))}
        </div>
        <p className="mt-8 rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
          EKGs, liver panels, blood pressure, medical artifacts, and advisor reviews remain under <strong>Medical</strong>.
        </p>
      </div>
    </main>
  );
};

export default ClientFormsPage;
