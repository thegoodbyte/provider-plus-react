import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, FileText, Clock, Calendar, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { medicalAdvisorApi } from '../services/api';
import { MedicalItem, Client } from '../types';
import LoadingSpinner from './LoadingSpinner';
import './MedicalAdvisorDashboard.css';

interface MedicalReviewItem {
  id: string;
  display_id: number;
  clientId: string;
  clientName: string;
  type: 'EKG' | 'Liver' | 'Question';
  status: 'pending' | 'approved' | 'declined' | 'needs_review';
  submittedDate: Date;
  urgency: 'high' | 'medium' | 'low';
  daysAgo: number;
}

const MedicalAdvisorDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [reviewItems, setReviewItems] = useState<MedicalReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'ekg' | 'liver' | 'question'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'urgency'>('urgency');

  useEffect(() => {
    fetchPendingReviews();
  }, []);

  const fetchPendingReviews = async () => {
    try {
      setLoading(true);

      // Fetch medical tracking items via medical advisor API
      const medicalResponse = await medicalAdvisorApi.getMedicalTracking();
      const medicalItems: MedicalItem[] = medicalResponse.data || [];

      // Fetch clients to get names (using medical advisor API for restricted access)
      const clients: Client[] = [];
      for (const item of medicalItems) {
        try {
          const clientResponse = await medicalAdvisorApi.getClientInfo(item.client_id);
          if (clientResponse.data) {
            clients.push(clientResponse.data);
          }
        } catch (error) {
          console.warn(`Could not fetch client info for ${item.client_id}:`, error);
        }
      }

      // Create a client lookup map
      const clientMap = clients.reduce((map, client) => {
        if (client._id && typeof client._id === 'string') {
          map[client._id] = client;
        }
        return map;
      }, {} as Record<string, Client>);

      // Transform medical tracking items into review items
      const items: MedicalReviewItem[] = medicalItems.map((item: MedicalItem) => {
        const submittedDate = new Date(item.date_received || item.createdAt || Date.now());
        const now = new Date();
        const daysAgo = Math.floor((now.getTime() - submittedDate.getTime()) / (1000 * 60 * 60 * 24));

        // Determine status based on review result
        let status: 'pending' | 'approved' | 'declined' | 'needs_review' = 'pending';
        if (item.medadvisor_review_result === 'OK') status = 'approved';
        else if (item.medadvisor_review_result === 'NOT OK') status = 'declined';
        else if (item.medadvisor_review_result === 'caution') status = 'needs_review';

        // Determine urgency based on days since submission
        let urgency: 'high' | 'medium' | 'low' = 'low';
        if (daysAgo >= 7) urgency = 'high';
        else if (daysAgo >= 3) urgency = 'medium';

        const client = clientMap[item.client_id];
        const clientName = client ? `${client.firstName} ${client.lastName}` : 'Unknown Client';

        return {
          id: item._id!,
          display_id: item.display_id!,
          clientId: item.client_id,
          clientName,
          type: item.type as 'EKG' | 'Liver' | 'Question',
          status,
          submittedDate,
          urgency,
          daysAgo
        };
      });

      setReviewItems(items);
    } catch (error) {
      console.error('Error fetching medical tracking items:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleItemClick = (item: MedicalReviewItem) => {
    navigate(`/medical/medical-review/${item.id}`);
  };

  const getFilteredItems = () => {
    let filtered = reviewItems;

    if (filter === 'ekg') {
      filtered = reviewItems.filter(item => item.type === 'EKG');
    } else if (filter === 'liver') {
      filtered = reviewItems.filter(item => item.type === 'Liver');
    } else if (filter === 'question') {
      filtered = reviewItems.filter(item => item.type === 'Question');
    }

    // Sort items
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return b.submittedDate.getTime() - a.submittedDate.getTime();
        case 'urgency':
          const urgencyOrder = { high: 0, medium: 1, low: 2 };
          return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
        default:
          return 0;
      }
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="status-icon approved" />;
      case 'declined':
        return <XCircle className="status-icon declined" />;
      default:
        return <Clock className="status-icon pending" />;
    }
  };

  const getUrgencyClass = (urgency: string) => {
    return `urgency-${urgency}`;
  };

  const formatDaysAgo = (days: number) => {
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    return `${days} days ago`;
  };

  const formatDaysUntil = (days: number) => {
    if (days < 0) return 'Past';
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    if (days <= 7) return `in ${days} days`;
    const weeks = Math.floor(days / 7);
    return `in ${weeks} week${weeks > 1 ? 's' : ''}`;
  };

  if (loading) {
    return <LoadingSpinner message="Loading medical tracking data..." />;
  }

  const filteredItems = getFilteredItems();

  return (
    <div className="medical-advisor-dashboard">
      <div className="dashboard-header">
        <h1>Medical Review Queue</h1>
        <div className="header-stats">
          <div className="stat">
            <span className="stat-value">{reviewItems.length}</span>
            <span className="stat-label">Total Pending</span>
          </div>
          <div className="stat urgent">
            <span className="stat-value">{reviewItems.filter(i => i.urgency === 'high').length}</span>
            <span className="stat-label">Urgent</span>
          </div>
        </div>
      </div>

      <div className="dashboard-controls">
        <div className="filter-controls">
          <button
            className={filter === 'all' ? 'active' : ''}
            onClick={() => setFilter('all')}
          >
            All Records
          </button>
          <button
            className={filter === 'ekg' ? 'active' : ''}
            onClick={() => setFilter('ekg')}
          >
            <Heart size={16} />
            EKG Only
          </button>
          <button
            className={filter === 'liver' ? 'active' : ''}
            onClick={() => setFilter('liver')}
          >
            <FileText size={16} />
            Liver Only
          </button>
          <button
            className={filter === 'question' ? 'active' : ''}
            onClick={() => setFilter('question')}
          >
            <FileText size={16} />
            Question Only
          </button>
        </div>

        <div className="sort-controls">
          <label>Sort by:</label>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
            <option value="urgency">Urgency</option>
            <option value="date">Submission Date</option>
          </select>
        </div>
      </div>

      <div className="review-items-list">
        {filteredItems.length === 0 ? (
          <div className="no-items">
            <p>No pending reviews at this time</p>
          </div>
        ) : (
          filteredItems.map(item => (
            <div
              key={item.id}
              className={`review-item ${getUrgencyClass(item.urgency)}`}
              onClick={() => handleItemClick(item)}
            >
              <div className="item-icon">
                {item.type === 'EKG' ? (
                  <Heart size={24} />
                ) : item.type === 'Liver' ? (
                  <FileText size={24} />
                ) : (
                  <AlertCircle size={24} />
                )}
              </div>

              <div className="item-main">
                <div className="item-title">
                  <span className="item-type">{item.type} Review</span>
                  <span className="client-number">#{item.display_id}</span>
                </div>
                <div className="item-details">
                  <span className="client-name">
                    <span>{item.clientName}</span>
                  </span>
                  <span className="submission-date">
                    <Clock size={14} />
                    Posted {formatDaysAgo(item.daysAgo)}
                  </span>
                </div>
              </div>

              <div className="item-status">
                {item.urgency === 'high' && (
                  <div className="urgency-indicator">
                    <AlertCircle size={20} />
                    <span>Urgent</span>
                  </div>
                )}
                {getStatusIcon(item.status)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default MedicalAdvisorDashboard;