import React, { useState } from 'react';
import ClientWaitingLists from './ClientWaitingLists';
import WaitingListMatrix from './WaitingListMatrix';

type ReserveListTab = 'client' | 'retreats';

const tabButtonClass = (active: boolean) =>
  `rounded-xl px-4 py-2 text-sm font-semibold transition ${
    active
      ? 'bg-blue-600 text-white shadow-sm'
      : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
  }`;

const ReserveListsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ReserveListTab>('client');

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Reserve Lists</h1>
            <p className="mt-1 text-sm text-gray-600">
              Add clients to one or more retreats, or review all upcoming retreat reserve lists in one matrix.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={tabButtonClass(activeTab === 'client')} onClick={() => setActiveTab('client')}>
              By Client
            </button>
            <button type="button" className={tabButtonClass(activeTab === 'retreats')} onClick={() => setActiveTab('retreats')}>
              By Retreat
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'client' ? <ClientWaitingLists /> : <WaitingListMatrix />}
    </div>
  );
};

export default ReserveListsPage;
