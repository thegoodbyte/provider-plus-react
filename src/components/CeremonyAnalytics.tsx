import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Table, Progress, Select, DatePicker, Space, Divider } from 'antd';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { ceremoniesApi } from '../services/api';
import moment from 'moment';

interface CeremonyAnalyticsProps {
  retreatId?: string;
}

const CeremonyAnalytics: React.FC<CeremonyAnalyticsProps> = ({ retreatId }) => {
  const [loading, setLoading] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [timeRange, setTimeRange] = useState('all');
  const [selectedCeremony, setSelectedCeremony] = useState<string>('all');

  useEffect(() => {
    loadAnalytics();
  }, [retreatId, timeRange, selectedCeremony]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      // In a real implementation, this would be a dedicated analytics endpoint
      if (retreatId) {
        const response = await ceremoniesApi.getRetreatSummary(retreatId);
        setAnalyticsData(response.data);
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  // Mock data for demonstration (in real app, this would come from API)
  const mockData = {
    ceremonies: [
      { number: 1, participants: 12, spoonsAvg: 2.3, purgeRate: 75, medicalApproved: 100 },
      { number: 2, participants: 10, spoonsAvg: 2.1, purgeRate: 80, medicalApproved: 100 },
      { number: 3, participants: 8, spoonsAvg: 2.5, purgeRate: 62, medicalApproved: 87 }
    ],
    medicalClearance: [
      { name: 'Approved', value: 28, color: '#52c41a' },
      { name: 'Conditional', value: 3, color: '#faad14' },
      { name: 'Pending', value: 2, color: '#8c8c8c' },
      { name: 'Not Approved', value: 1, color: '#ff4d4f' }
    ],
    spoonDistribution: [
      { spoons: 1, participants: 4 },
      { spoons: 2, participants: 12 },
      { spoons: 3, participants: 8 },
      { spoons: 4, participants: 3 },
      { spoons: 5, participants: 1 }
    ],
    purgeTimeline: [
      { time: '20:00', count: 0 },
      { time: '21:00', count: 2 },
      { time: '22:00', count: 8 },
      { time: '23:00', count: 12 },
      { time: '00:00', count: 6 },
      { time: '01:00', count: 2 },
      { time: '02:00', count: 1 }
    ]
  };

  const ceremonyColumns = [
    {
      title: 'Ceremony #',
      dataIndex: 'number',
      key: 'number',
      width: 100,
      render: (num: number) => `Ceremony ${num}`
    },
    {
      title: 'Participants',
      dataIndex: 'participants',
      key: 'participants',
      width: 120
    },
    {
      title: 'Avg Spoons',
      dataIndex: 'spoonsAvg',
      key: 'spoonsAvg',
      width: 120,
      render: (avg: number) => avg.toFixed(1)
    },
    {
      title: 'Purge Rate',
      dataIndex: 'purgeRate',
      key: 'purgeRate',
      width: 150,
      render: (rate: number) => (
        <div>
          <Progress percent={rate} size="small" />
          <span style={{ fontSize: '12px', color: '#666' }}>{rate}%</span>
        </div>
      )
    },
    {
      title: 'Medical Approved',
      dataIndex: 'medicalApproved',
      key: 'medicalApproved',
      width: 150,
      render: (rate: number) => (
        <div>
          <Progress
            percent={rate}
            size="small"
            strokeColor={rate === 100 ? '#52c41a' : '#faad14'}
          />
          <span style={{ fontSize: '12px', color: '#666' }}>{rate}%</span>
        </div>
      )
    }
  ];

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1>📊 Ceremony Analytics & Reporting</h1>
        <Space>
          <Select
            value={timeRange}
            onChange={setTimeRange}
            style={{ width: 150 }}
            options={[
              { label: 'All Time', value: 'all' },
              { label: 'Last 30 Days', value: '30d' },
              { label: 'Last 7 Days', value: '7d' }
            ]}
          />
          <Select
            value={selectedCeremony}
            onChange={setSelectedCeremony}
            style={{ width: 200 }}
            options={[
              { label: 'All Ceremonies', value: 'all' },
              { label: 'Ceremony 1', value: '1' },
              { label: 'Ceremony 2', value: '2' },
              { label: 'Ceremony 3', value: '3' }
            ]}
          />
        </Space>
      </div>

      {/* Key Metrics */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col span={4}>
          <Card>
            <Statistic
              title="Total Ceremonies"
              value={3}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="Total Participants"
              value={30}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="Avg Spoons/Person"
              value={2.3}
              precision={1}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="Overall Purge Rate"
              value={72}
              suffix="%"
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="Medical Approval"
              value={96}
              suffix="%"
              valueStyle={{ color: '#13c2c2' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="Avg Duration"
              value="6.5"
              suffix="hrs"
              valueStyle={{ color: '#eb2f96' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Ceremony Performance Table */}
      <Card title="🔮 Ceremony Performance Summary" style={{ marginBottom: '24px' }}>
        <Table
          columns={ceremonyColumns}
          dataSource={mockData.ceremonies}
          pagination={false}
          size="small"
          rowKey="number"
        />
      </Card>

      {/* Charts Row 1 */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col span={12}>
          <Card title="📋 Medical Clearance Status">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={mockData.medicalClearance}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${entry.value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {mockData.medicalClearance.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col span={12}>
          <Card title="🥄 Spoon Distribution">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={mockData.spoonDistribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="spoons" label={{ value: 'Number of Spoons', position: 'insideBottom', offset: -10 }} />
                <YAxis label={{ value: 'Participants', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Bar dataKey="participants" fill="#1890ff" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      {/* Charts Row 2 */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col span={12}>
          <Card title="📈 Ceremony Participation Trends">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={mockData.ceremonies}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="number" label={{ value: 'Ceremony Number', position: 'insideBottom', offset: -10 }} />
                <YAxis label={{ value: 'Participants', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Line type="monotone" dataKey="participants" stroke="#52c41a" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col span={12}>
          <Card title="🤮 Purging Timeline">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={mockData.purgeTimeline}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" label={{ value: 'Time', position: 'insideBottom', offset: -10 }} />
                <YAxis label={{ value: 'Purges', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Bar dataKey="count" fill="#fa8c16" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      {/* Detailed Stats */}
      <Row gutter={[16, 16]}>
        <Col span={8}>
          <Card title="⏱️ Timing Statistics">
            <div style={{ padding: '16px 0' }}>
              <Row>
                <Col span={12}>
                  <Statistic
                    title="Avg First Spoon"
                    value="20:45"
                    valueStyle={{ fontSize: '16px' }}
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title="Avg First Purge"
                    value="23:30"
                    valueStyle={{ fontSize: '16px' }}
                  />
                </Col>
              </Row>
              <Divider />
              <Row>
                <Col span={12}>
                  <Statistic
                    title="Peak Purge Time"
                    value="23:00"
                    valueStyle={{ fontSize: '16px', color: '#fa8c16' }}
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title="Avg Departure"
                    value="03:15"
                    valueStyle={{ fontSize: '16px' }}
                  />
                </Col>
              </Row>
            </div>
          </Card>
        </Col>

        <Col span={8}>
          <Card title="🩺 Medical Stats">
            <div style={{ padding: '16px 0' }}>
              <Row>
                <Col span={12}>
                  <Statistic
                    title="Avg BP Systolic"
                    value="125"
                    suffix="mmHg"
                    valueStyle={{ fontSize: '16px' }}
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title="Avg BP Diastolic"
                    value="78"
                    suffix="mmHg"
                    valueStyle={{ fontSize: '16px' }}
                  />
                </Col>
              </Row>
              <Divider />
              <Row>
                <Col span={12}>
                  <Statistic
                    title="Avg Heart Rate"
                    value="72"
                    suffix="BPM"
                    valueStyle={{ fontSize: '16px' }}
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title="EKG Approval"
                    value="98"
                    suffix="%"
                    valueStyle={{ fontSize: '16px', color: '#52c41a' }}
                  />
                </Col>
              </Row>
            </div>
          </Card>
        </Col>

        <Col span={8}>
          <Card title="📊 Completion Rates">
            <div style={{ padding: '16px 0' }}>
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span>Full Participation</span>
                  <span>94%</span>
                </div>
                <Progress percent={94} strokeColor="#52c41a" />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span>Completed Journey</span>
                  <span>87%</span>
                </div>
                <Progress percent={87} strokeColor="#1890ff" />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span>Positive Experience</span>
                  <span>91%</span>
                </div>
                <Progress percent={91} strokeColor="#722ed1" />
              </div>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default CeremonyAnalytics;