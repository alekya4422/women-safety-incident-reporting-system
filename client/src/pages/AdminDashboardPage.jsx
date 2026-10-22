import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import {
  fetchDashboardOverview,
  fetchAdminReports,
  fetchReportDetail,
  updateReportStatus,
  fetchAlerts,
  updateAlertState,
  fetchSettings,
  updateSettings,
  fetchResponders,
  saveResponder,
  logResponderDeliberateAction,
  fetchAuditLogs
} from '../services/api';
import {
  ShieldAlert,
  AlertTriangle,
  Clock,
  Filter,
  Search,
  Eye,
  PhoneCall,
  Settings as SettingsIcon,
  CheckCircle2,
  XCircle,
  FileText,
  User,
  Users,
  Image as ImageIcon,
  Check,
  Copy,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Sliders,
  History,
  Lock
} from 'lucide-react';

export default function AdminDashboardPage({ adminUser, onLogout }) {
  // Active Navigation Tab
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'reports' | 'alerts' | 'responders' | 'settings' | 'audit'

  // Data states
  const [overview, setOverview] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [reports, setReports] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [settings, setSettings] = useState({ alert_threshold: 5, alert_window_hours: 24, retention_days: 365 });
  const [responders, setResponders] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);

  // Report Filters
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterPlace, setFilterPlace] = useState('');
  const [filterTimeRange, setFilterTimeRange] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals & Active Selections
  const [selectedReport, setSelectedReport] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [statusUpdateNote, setStatusUpdateNote] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [revealedContact, setRevealedContact] = useState(false);

  // Responder Deliberate Contact Modal
  const [responderModalOpen, setResponderModalOpen] = useState(false);
  const [selectedResponder, setSelectedResponder] = useState(null);
  const [responderActionTarget, setResponderActionTarget] = useState(null); // { placeNormalized, reportId }
  const [deliberateConsent, setDeliberateConsent] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);

  // Settings edit state
  const [editingSettings, setEditingSettings] = useState({ threshold: 5, window_hours: 24, retention_days: 365 });
  const [settingsMessage, setSettingsMessage] = useState('');

  // UI state
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Initial Load
  const loadDashboardData = async () => {
    setRefreshing(true);
    try {
      const [overviewData, alertsData, settingsData, respondersData] = await Promise.all([
        fetchDashboardOverview(),
        fetchAlerts(),
        fetchSettings(),
        fetchResponders()
      ]);

      setOverview(overviewData.overview);
      setAlerts(alertsData.alerts || []);
      setSettings(settingsData.settings || { alert_threshold: 5, alert_window_hours: 24 });
      setEditingSettings({
        threshold: settingsData.settings?.alert_threshold || 5,
        window_hours: settingsData.settings?.alert_window_hours || 24,
        retention_days: settingsData.settings?.retention_days || 365
      });
      setResponders(respondersData.contacts || []);
      if (respondersData.contacts?.length > 0) {
        setSelectedResponder(respondersData.contacts[0]);
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  // Load Reports
  const loadReportsList = async (page = 1) => {
    try {
      const data = await fetchAdminReports({
        page,
        limit: 15,
        status: filterStatus,
        category: filterCategory,
        place: filterPlace,
        timeRange: filterTimeRange,
        search: searchQuery
      });
      setReports(data.reports || []);
      setPagination(data.pagination || { page: 1, limit: 15, total: 0, totalPages: 1 });
    } catch (err) {
      console.error('Failed to load reports:', err);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  useEffect(() => {
    loadReportsList(pagination.page);
  }, [filterStatus, filterCategory, filterPlace, filterTimeRange, searchQuery, pagination.page]);

  // Load audit logs when tab is selected
  useEffect(() => {
    if (activeTab === 'audit') {
      fetchAuditLogs().then(res => setAuditLogs(res.logs || [])).catch(() => {});
    }
  }, [activeTab]);

  // Open report detail
  const handleOpenDetail = async (reportId) => {
    setLoadingDetail(true);
    setRevealedContact(false);
    try {
      const data = await fetchReportDetail(reportId);
      setSelectedReport(data.report);
      setNewStatus(data.report.status);
    } catch (err) {
      alert('Failed to load report detail: ' + err.message);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Handle status update
  const handleSaveStatus = async () => {
    if (!selectedReport) return;
    try {
      await updateReportStatus(selectedReport.id, newStatus, statusUpdateNote);
      setSelectedReport(prev => ({ ...prev, status: newStatus }));
      setStatusUpdateNote('');
      loadReportsList(pagination.page);
      loadDashboardData();
      alert(`Report status successfully updated to ${newStatus}`);
    } catch (err) {
      alert('Error updating status: ' + err.message);
    }
  };

  // Filter reports directly from an alert card
  const handleFilterByAlert = (placeNormalized) => {
    setFilterPlace(placeNormalized);
    setActiveTab('reports');
  };

  // Alert State changes
  const handleAlertAction = async (alertId, action) => {
    try {
      await updateAlertState(alertId, action);
      loadDashboardData();
    } catch (err) {
      alert('Error updating alert: ' + err.message);
    }
  };

  // Deliberate Contact Initiation
  const handleOpenResponderModal = (placeNorm = null, repId = null) => {
    setResponderActionTarget({ placeNormalized: placeNorm, reportId: repId });
    setDeliberateConsent(false);
    setCopiedPhone(false);
    setResponderModalOpen(true);
  };

  const handleDeliberateDial = async () => {
    if (!selectedResponder) return;
    try {
      // 1. Audit log this deliberate administrative action
      await logResponderDeliberateAction({
        contactId: selectedResponder.id,
        placeNormalized: responderActionTarget?.placeNormalized,
        reportId: responderActionTarget?.reportId
      });

      // 2. Open tel link on device
      window.location.href = `tel:${selectedResponder.phone.replace(/\s+/g, '')}`;
    } catch (err) {
      console.error('Error logging responder action:', err);
    }
  };

  const handleCopyPhone = () => {
    if (selectedResponder) {
      navigator.clipboard.writeText(selectedResponder.phone);
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 2500);
    }
  };

  // Update Settings
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSettingsMessage('');
    try {
      await updateSettings(editingSettings);
      setSettingsMessage('Settings updated successfully. Cluster threshold recalculated.');
      loadDashboardData();
    } catch (err) {
      setSettingsMessage('Failed to update settings: ' + err.message);
    }
  };

  const activeAlertsList = alerts.filter(a => a.state === 'active');

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-main)' }}>
      <Navbar adminUser={adminUser} onLogout={onLogout} />

      {/* Admin Subheader & Navigation Tabs */}
      <div style={{ background: 'white', borderBottom: '1px solid var(--border)' }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', padding: '0.8rem 1.25rem' }}>
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              Safety Coordination Control Center
              <span style={{ fontSize: '0.72rem', background: '#dcfce7', color: '#15803d', padding: '0.15rem 0.5rem', borderRadius: '4px', fontWeight: 700 }}>
                ● Active Monitoring
              </span>
            </h1>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Spot clusters, coordinate preventative presence, and verify report lifecycles
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={() => { loadDashboardData(); loadReportsList(pagination.page); }}
              title="Refresh Dashboard Data"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.45rem 0.8rem',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.82rem',
                fontWeight: 600,
                background: 'white',
                color: 'var(--text-secondary)'
              }}
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="container" style={{ display: 'flex', gap: '0.25rem', overflowX: 'auto', paddingBottom: '0.2rem' }}>
          {[
            { id: 'overview', label: 'Dashboard Overview', icon: FileText },
            { id: 'reports', label: `Reports (${overview?.totalReports || 0})`, icon: Eye },
            { id: 'alerts', label: `Location Alerts (${activeAlertsList.length})`, icon: AlertTriangle, badge: activeAlertsList.length > 0 },
            { id: 'responders', label: 'Responder Directory', icon: PhoneCall },
            { id: 'settings', label: 'Threshold Settings', icon: SettingsIcon },
            { id: 'audit', label: 'Audit Trail', icon: History }
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  padding: '0.65rem 1rem',
                  borderBottom: `2.5px solid ${active ? 'var(--primary)' : 'transparent'}`,
                  fontWeight: active ? 700 : 500,
                  fontSize: '0.88rem',
                  color: active ? 'var(--primary)' : 'var(--text-secondary)',
                  background: 'transparent',
                  whiteSpace: 'nowrap'
                }}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#dc2626' }} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <main style={{ flex: 1, padding: '1.75rem 1.25rem' }}>
        <div className="container">

          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div>
              {/* Metric Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.75rem' }}>
                <div style={{ background: 'white', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Total Submissions</div>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
                    {overview?.totalReports ?? '...'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>All-time safe records</div>
                </div>

                <div style={{ background: 'white', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Last {overview?.windowHours || 24} Hours</div>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--primary)', marginTop: '0.25rem' }}>
                    {overview?.periodReports ?? '...'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Rolling active window</div>
                </div>

                <div style={{ background: 'white', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Locations at Threshold (≥{overview?.threshold || 5})</div>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: (overview?.locationsAtThreshold || 0) > 0 ? '#dc2626' : 'var(--text-primary)', marginTop: '0.25rem' }}>
                    {overview?.locationsAtThreshold ?? 0}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: (overview?.locationsAtThreshold || 0) > 0 ? '#dc2626' : 'var(--text-muted)', marginTop: '0.25rem' }}>
                    {(overview?.locationsAtThreshold || 0) > 0 ? 'Requires coordinator review' : 'No cluster alarms'}
                  </div>
                </div>

                <div style={{ background: 'white', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Awaiting Initial Review</div>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--accent-amber)', marginTop: '0.25rem' }}>
                    {overview?.reportsAwaitingReview ?? '...'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Status = 'New'</div>
                </div>
              </div>

              {/* Prominent Place-Based Alert Banner (KPHB Metro & other clusters) */}
              {activeAlertsList.length > 0 ? (
                <div style={{ marginBottom: '2rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <ShieldAlert size={20} color="#dc2626" />
                    <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      Active Location Cluster Alerts ({activeAlertsList.length})
                    </h2>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {activeAlertsList.map(alert => (
                      <div
                        key={alert.id}
                        style={{
                          background: '#fff1f2',
                          border: '2px solid #fda4af',
                          borderRadius: 'var(--radius-md)',
                          padding: '1.25rem 1.5rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '1rem',
                          boxShadow: '0 4px 12px rgba(225, 29, 72, 0.08)'
                        }}
                      >
                        <div style={{ maxWidth: '650px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                            <span className="badge badge-alert">
                              🚨 Alert Threshold Triggered
                            </span>
                            <span style={{ fontSize: '0.8rem', color: '#9f1239', fontWeight: 600 }}>
                              Rolling {alert.window_hours}h Window (≥ {alert.threshold} reports)
                            </span>
                          </div>
                          <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#881337', marginBottom: '0.3rem' }}>
                            {alert.report_count} reports near {alert.place_display} in the last {alert.window_hours} hours — review reports
                          </div>
                          <p style={{ fontSize: '0.82rem', color: '#9f1239', lineHeight: 1.4 }}>
                            <strong>Safety Operational Notice:</strong> This indicates an automated cluster count from user submissions. SafeSignal does not claim reports are independently verified. Review reports before taking deliberate responder action.
                          </p>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                          <button
                            onClick={() => handleFilterByAlert(alert.place_normalized)}
                            style={{
                              background: '#be123c',
                              color: 'white',
                              padding: '0.6rem 1rem',
                              borderRadius: 'var(--radius-sm)',
                              fontWeight: 700,
                              fontSize: '0.85rem',
                              boxShadow: 'var(--shadow-sm)'
                            }}
                          >
                            Review {alert.place_display} Reports
                          </button>
                          <button
                            onClick={() => handleOpenResponderModal(alert.place_normalized)}
                            style={{
                              background: 'white',
                              color: '#be123c',
                              border: '1px solid #fda4af',
                              padding: '0.6rem 0.9rem',
                              borderRadius: 'var(--radius-sm)',
                              fontWeight: 700,
                              fontSize: '0.85rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.35rem'
                            }}
                          >
                            <PhoneCall size={14} />
                            Contact Responder
                          </button>
                          <button
                            onClick={() => handleAlertAction(alert.id, 'acknowledge')}
                            style={{
                              background: '#ffe4e6',
                              color: '#9f1239',
                              border: '1px solid #fecdd3',
                              padding: '0.6rem 0.8rem',
                              borderRadius: 'var(--radius-sm)',
                              fontWeight: 600,
                              fontSize: '0.8rem'
                            }}
                          >
                            Acknowledge
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{
                  background: 'white',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  marginBottom: '2rem'
                }}>
                  <CheckCircle2 size={24} color="var(--accent-emerald)" />
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>No active location alerts</div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                      All localities are currently below the {overview?.threshold || 5}-report threshold in the rolling {overview?.windowHours || 24}-hour window.
                    </div>
                  </div>
                </div>
              )}

              {/* Quick Jump to Reports */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Recent Incident Reports
                </h3>
                <button
                  onClick={() => setActiveTab('reports')}
                  style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--primary)' }}
                >
                  View Full Filterable Table →
                </button>
              </div>

              {/* Compact table for overview */}
              <div style={{ background: 'white', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '0.75rem 1rem', fontWeight: 700 }}>Reference ID</th>
                      <th style={{ padding: '0.75rem 1rem', fontWeight: 700 }}>Place & Cluster Count</th>
                      <th style={{ padding: '0.75rem 1rem', fontWeight: 700 }}>Category</th>
                      <th style={{ padding: '0.75rem 1rem', fontWeight: 700 }}>Incident Time</th>
                      <th style={{ padding: '0.75rem 1rem', fontWeight: 700 }}>Status</th>
                      <th style={{ padding: '0.75rem 1rem', fontWeight: 700, textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.slice(0, 5).map(rep => (
                      <tr key={rep.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '0.75rem 1rem', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--primary)' }}>
                          {rep.reference_id}
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{rep.place_original}</div>
                          <div style={{ fontSize: '0.75rem', color: rep.is_at_threshold ? '#dc2626' : 'var(--text-muted)' }}>
                            {rep.place_window_count} report(s) in 24h {rep.is_at_threshold && '⚠️ [Threshold Reached]'}
                          </div>
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <span style={{ textTransform: 'capitalize', fontWeight: 500 }}>
                            {rep.category.replace('_', ' ')}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>
                          {new Date(rep.incident_time).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <span className={`badge badge-${rep.status}`}>
                            {rep.status}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                          <button
                            onClick={() => handleOpenDetail(rep.id)}
                            style={{
                              background: 'var(--primary-light)',
                              color: 'var(--primary)',
                              padding: '0.35rem 0.65rem',
                              borderRadius: '4px',
                              fontSize: '0.78rem',
                              fontWeight: 700
                            }}
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: FULL REPORTS TABLE */}
          {activeTab === 'reports' && (
            <div style={{ background: 'white', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', padding: '1.5rem', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    Incoming Incident Reports
                  </h2>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Total: {pagination.total} reports. Sensitive reporter contacts & images are protected and accessed only via detail view.
                  </p>
                </div>
              </div>

              {/* Filters Bar */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem', background: 'var(--bg-subtle)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                {/* Search */}
                <div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.2rem' }}>Keyword Search</span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search place, description, ID..."
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      fontSize: '0.85rem'
                    }}
                  />
                </div>

                {/* Status Filter */}
                <div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.2rem' }}>Status</span>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.85rem' }}
                  >
                    <option value="all">All Statuses</option>
                    <option value="new">New</option>
                    <option value="reviewing">Reviewing</option>
                    <option value="referred">Referred</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>

                {/* Category Filter */}
                <div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.2rem' }}>Incident Type</span>
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.85rem' }}
                  >
                    <option value="all">All Categories</option>
                    <option value="harassment">Harassment</option>
                    <option value="stalking">Stalking</option>
                    <option value="unsafe_transport">Unsafe Transport</option>
                    <option value="assault">Assault</option>
                    <option value="suspicious_behavior">Suspicious Behavior</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                {/* Place Filter */}
                <div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.2rem' }}>Place Filter</span>
                  <div style={{ display: 'flex', gap: '0.3rem' }}>
                    <input
                      type="text"
                      value={filterPlace}
                      onChange={(e) => setFilterPlace(e.target.value)}
                      placeholder="e.g. kphb metro"
                      style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.85rem' }}
                    />
                    {filterPlace && (
                      <button
                        onClick={() => setFilterPlace('')}
                        style={{ padding: '0.2rem 0.5rem', background: '#fee2e2', color: '#991b1b', borderRadius: '4px', fontSize: '0.75rem' }}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                {/* Time Range Filter */}
                <div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.2rem' }}>Time Range</span>
                  <select
                    value={filterTimeRange}
                    onChange={(e) => setFilterTimeRange(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.85rem' }}
                  >
                    <option value="all">All Time</option>
                    <option value="24h">Last 24 Hours</option>
                    <option value="7d">Last 7 Days</option>
                    <option value="30d">Last 30 Days</option>
                  </select>
                </div>
              </div>

              {/* Table */}
              <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '0.75rem', fontWeight: 700 }}>Ref ID</th>
                      <th style={{ padding: '0.75rem', fontWeight: 700 }}>Place & Landmark</th>
                      <th style={{ padding: '0.75rem', fontWeight: 700 }}>Rolling 24h Count</th>
                      <th style={{ padding: '0.75rem', fontWeight: 700 }}>Category</th>
                      <th style={{ padding: '0.75rem', fontWeight: 700 }}>Incident Time</th>
                      <th style={{ padding: '0.75rem', fontWeight: 700 }}>Brief Summary</th>
                      <th style={{ padding: '0.75rem', fontWeight: 700 }}>Status</th>
                      <th style={{ padding: '0.75rem', fontWeight: 700, textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.length === 0 ? (
                      <tr>
                        <td colSpan="8" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                          No incident reports match the current filters.
                        </td>
                      </tr>
                    ) : (
                      reports.map(rep => (
                        <tr key={rep.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '0.75rem', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--primary)' }}>
                            {rep.reference_id}
                          </td>
                          <td style={{ padding: '0.75rem' }}>
                            <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{rep.place_original}</div>
                            {rep.place_landmark && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>📍 {rep.place_landmark}</div>
                            )}
                          </td>
                          <td style={{ padding: '0.75rem' }}>
                            <span style={{
                              fontWeight: 700,
                              color: rep.is_at_threshold ? '#dc2626' : 'var(--text-primary)',
                              background: rep.is_at_threshold ? '#fee2e2' : 'var(--bg-subtle)',
                              padding: '0.2rem 0.5rem',
                              borderRadius: '6px',
                              fontSize: '0.78rem'
                            }}>
                              {rep.place_window_count} in 24h {rep.is_at_threshold && '⚠️ Alert'}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem', textTransform: 'capitalize' }}>
                            {rep.category.replace('_', ' ')}
                          </td>
                          <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>
                            {new Date(rep.incident_time).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                            {rep.incident_time_approx ? <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>(Approx)</span> : null}
                          </td>
                          <td style={{ padding: '0.75rem', color: 'var(--text-secondary)', maxWidth: '240px' }}>
                            <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {rep.short_description}
                            </div>
                          </td>
                          <td style={{ padding: '0.75rem' }}>
                            <span className={`badge badge-${rep.status}`}>
                              {rep.status}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                              <button
                                onClick={() => handleOpenDetail(rep.id)}
                                style={{
                                  background: 'var(--primary)',
                                  color: 'white',
                                  padding: '0.35rem 0.75rem',
                                  borderRadius: '4px',
                                  fontSize: '0.78rem',
                                  fontWeight: 700
                                }}
                              >
                                View
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', fontSize: '0.85rem' }}>
                  <div style={{ color: 'var(--text-muted)' }}>
                    Page {pagination.page} of {pagination.totalPages}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      disabled={pagination.page <= 1}
                      onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                      style={{
                        padding: '0.4rem 0.8rem',
                        border: '1px solid var(--border)',
                        borderRadius: '6px',
                        background: 'white',
                        color: pagination.page <= 1 ? '#cbd5e1' : 'var(--text-primary)'
                      }}
                    >
                      Previous
                    </button>
                    <button
                      disabled={pagination.page >= pagination.totalPages}
                      onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                      style={{
                        padding: '0.4rem 0.8rem',
                        border: '1px solid var(--border)',
                        borderRadius: '6px',
                        background: 'white',
                        color: pagination.page >= pagination.totalPages ? '#cbd5e1' : 'var(--text-primary)'
                      }}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: LOCATION ALERTS */}
          {activeTab === 'alerts' && (
            <div style={{ background: 'white', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', padding: '1.5rem', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ marginBottom: '1.25rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Location Cluster Alerts
                </h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Threshold rule: ≥ {settings.alert_threshold} reports within rolling {settings.alert_window_hours} hours creates/maintains an alert.
                </p>
              </div>

              {alerts.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No historical or active alerts recorded.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {alerts.map(a => (
                    <div
                      key={a.id}
                      style={{
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        padding: '1.25rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '1rem',
                        background: a.state === 'active' ? '#fff1f2' : 'white'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                          <span className={`badge ${a.state === 'active' ? 'badge-alert' : a.state === 'acknowledged' ? 'badge-reviewing' : 'badge-closed'}`}>
                            {a.state.toUpperCase()}
                          </span>
                          <span style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                            {a.place_display}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          <strong>{a.report_count} reports</strong> recorded in rolling {a.window_hours}h window (threshold: {a.threshold})
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                          Updated: {new Date(a.updated_at || a.created_at).toLocaleString()}
                          {a.acknowledged_by && ` • Handled by: ${a.acknowledged_by}`}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => handleFilterByAlert(a.place_normalized)}
                          style={{
                            padding: '0.5rem 0.85rem',
                            borderRadius: 'var(--radius-sm)',
                            fontWeight: 700,
                            fontSize: '0.82rem',
                            background: 'var(--primary)',
                            color: 'white'
                          }}
                        >
                          View Reports
                        </button>
                        <button
                          onClick={() => handleOpenResponderModal(a.place_normalized)}
                          style={{
                            padding: '0.5rem 0.85rem',
                            borderRadius: 'var(--radius-sm)',
                            fontWeight: 700,
                            fontSize: '0.82rem',
                            border: '1px solid var(--border)',
                            background: 'white',
                            color: 'var(--text-primary)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.3rem'
                          }}
                        >
                          <PhoneCall size={14} /> Contact
                        </button>
                        {a.state === 'active' && (
                          <button
                            onClick={() => handleAlertAction(a.id, 'acknowledge')}
                            style={{
                              padding: '0.5rem 0.75rem',
                              borderRadius: 'var(--radius-sm)',
                              fontWeight: 600,
                              fontSize: '0.8rem',
                              background: '#ffe4e6',
                              color: '#9f1239'
                            }}
                          >
                            Acknowledge
                          </button>
                        )}
                        {a.state !== 'resolved' && (
                          <button
                            onClick={() => handleAlertAction(a.id, 'resolve')}
                            style={{
                              padding: '0.5rem 0.75rem',
                              borderRadius: 'var(--radius-sm)',
                              fontWeight: 600,
                              fontSize: '0.8rem',
                              background: '#dcfce7',
                              color: '#166534'
                            }}
                          >
                            Resolve
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: RESPONDER DIRECTORY */}
          {activeTab === 'responders' && (
            <div style={{ background: 'white', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', padding: '1.5rem', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Configured Responder & Escort Contacts
                </h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  These contacts are accessible to administrators when reviewing safety clusters. The app never calls automatically; initiating an action opens verified phone instructions and logs an audit entry.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                {responders.map(c => (
                  <div key={c.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1.25rem', background: 'var(--bg-subtle)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                      <span className="badge" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
                        {c.category}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: c.is_active ? 'var(--accent-emerald)' : 'var(--text-muted)', fontWeight: 600 }}>
                        {c.is_active ? '● Active' : '○ Inactive'}
                      </span>
                    </div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
                      {c.name}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.95rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '0.65rem' }}>
                      📞 {c.phone}
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem', minHeight: '40px' }}>
                      {c.instructions || 'Standard community responder instructions apply.'}
                    </p>
                    <button
                      onClick={() => {
                        setSelectedResponder(c);
                        handleOpenResponderModal(null, null);
                      }}
                      style={{
                        width: '100%',
                        padding: '0.6rem',
                        background: 'white',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        fontWeight: 700,
                        fontSize: '0.82rem',
                        color: 'var(--primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.35rem'
                      }}
                    >
                      <PhoneCall size={14} /> Deliberate Contact Flow
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: THRESHOLD SETTINGS */}
          {activeTab === 'settings' && (
            <div style={{ maxWidth: '600px', background: 'white', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', padding: '1.75rem', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Threshold & Aggregation Parameters
                </h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Configure the rolling time window and report count required to trigger location-based alerts.
                </p>
              </div>

              {settingsMessage && (
                <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', padding: '0.75rem', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.85rem' }}>
                  {settingsMessage}
                </div>
              )}

              <form onSubmit={handleSaveSettings}>
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.3rem' }}>
                    Alert Report Threshold (Reports Count)
                  </label>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                    Number of incident reports for a normalized place to trigger an active alert. Default: 5
                  </p>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    required
                    value={editingSettings.threshold}
                    onChange={(e) => setEditingSettings(prev => ({ ...prev, threshold: parseInt(e.target.value, 10) }))}
                    style={{ width: '100%', padding: '0.65rem', border: '1px solid var(--border)', borderRadius: '6px' }}
                  />
                </div>

                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.3rem' }}>
                    Rolling Time Window (Hours)
                  </label>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                    Hours backward from current time for cluster aggregation. Default: 24 hours
                  </p>
                  <input
                    type="number"
                    min="1"
                    max="168"
                    required
                    value={editingSettings.window_hours}
                    onChange={(e) => setEditingSettings(prev => ({ ...prev, window_hours: parseInt(e.target.value, 10) }))}
                    style={{ width: '100%', padding: '0.65rem', border: '1px solid var(--border)', borderRadius: '6px' }}
                  />
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.3rem' }}>
                    Data Retention Policy (Days)
                  </label>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                    Period after which incident reports can be automatically anonymized or purged. Default: 365
                  </p>
                  <input
                    type="number"
                    min="30"
                    max="3650"
                    required
                    value={editingSettings.retention_days}
                    onChange={(e) => setEditingSettings(prev => ({ ...prev, retention_days: parseInt(e.target.value, 10) }))}
                    style={{ width: '100%', padding: '0.65rem', border: '1px solid var(--border)', borderRadius: '6px' }}
                  />
                </div>

                <button
                  type="submit"
                  style={{
                    background: 'var(--primary)',
                    color: 'white',
                    padding: '0.75rem 1.5rem',
                    borderRadius: 'var(--radius-sm)',
                    fontWeight: 700,
                    fontSize: '0.9rem'
                  }}
                >
                  Save Configuration & Recalculate
                </button>
              </form>
            </div>
          )}

          {/* TAB 6: AUDIT TRAIL */}
          {activeTab === 'audit' && (
            <div style={{ background: 'white', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', padding: '1.5rem', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ marginBottom: '1.25rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Administrative Audit Trail
                </h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Tamper-evident record of staff logins, status modifications, contact disclosures, and responder call actions.
                </p>
              </div>

              <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '0.65rem', fontWeight: 700 }}>Timestamp</th>
                      <th style={{ padding: '0.65rem', fontWeight: 700 }}>Administrator</th>
                      <th style={{ padding: '0.65rem', fontWeight: 700 }}>Action</th>
                      <th style={{ padding: '0.65rem', fontWeight: 700 }}>Target</th>
                      <th style={{ padding: '0.65rem', fontWeight: 700 }}>Details (PII Sanitized)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map(log => (
                      <tr key={log.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '0.65rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td style={{ padding: '0.65rem', fontWeight: 600 }}>
                          👤 {log.admin_username}
                        </td>
                        <td style={{ padding: '0.65rem' }}>
                          <span style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            padding: '0.15rem 0.4rem',
                            borderRadius: '4px',
                            background: log.action.includes('RESPONDER') ? '#fee2e2' : log.action.includes('CONTACT') ? '#fef3c7' : 'var(--bg-subtle)',
                            color: log.action.includes('RESPONDER') ? '#991b1b' : log.action.includes('CONTACT') ? '#92400e' : 'var(--text-primary)'
                          }}>
                            {log.action}
                          </span>
                        </td>
                        <td style={{ padding: '0.65rem', color: 'var(--text-muted)' }}>
                          {log.target_type}: {log.target_id || 'n/a'}
                        </td>
                        <td style={{ padding: '0.65rem', color: 'var(--text-secondary)', maxWidth: '300px' }}>
                          <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {log.metadata || '{}'}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* REPORT DETAIL MODAL */}
      {selectedReport && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '680px', padding: '1.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div>
                <span className="badge" style={{ background: 'var(--primary-light)', color: 'var(--primary)', marginBottom: '0.35rem' }}>
                  {selectedReport.reference_id}
                </span>
                <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {selectedReport.place_original}
                </h3>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Submitted: {new Date(selectedReport.created_at).toLocaleString()} • Incident Time: {new Date(selectedReport.incident_time).toLocaleString()}
                </div>
              </div>
              <button
                onClick={() => setSelectedReport(null)}
                style={{ background: 'var(--bg-subtle)', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                ✕
              </button>
            </div>

            {/* Landmark & Cluster info */}
            <div style={{ background: 'var(--bg-subtle)', padding: '0.85rem', borderRadius: '8px', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
              <div><strong>Reported Landmark:</strong> {selectedReport.place_landmark || 'None specified'}</div>
              <div><strong>Normalized Place Key:</strong> <code>{selectedReport.place_normalized}</code></div>
              <div style={{ marginTop: '0.25rem', color: selectedReport.is_at_threshold ? '#dc2626' : 'var(--text-secondary)' }}>
                <strong>Cluster Count:</strong> {selectedReport.place_window_count} report(s) in current rolling window {selectedReport.is_at_threshold && '⚠️ [Alert Active]'}
              </div>
              {selectedReport.coordinates_approx && (
                <div style={{ marginTop: '0.25rem', color: 'var(--accent-emerald)' }}>
                  <strong>Consented Approx Coordinates:</strong> {selectedReport.coordinates_approx}
                </div>
              )}
            </div>

            {/* Category & Description */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.3rem' }}>
                Category: {selectedReport.category.replace('_', ' ')}
              </div>
              <div style={{ background: 'white', border: '1px solid var(--border)', padding: '1rem', borderRadius: '8px', fontSize: '0.92rem', lineHeight: 1.6 }}>
                {selectedReport.description}
              </div>
            </div>

            {/* Private Images Gallery */}
            {selectedReport.images && selectedReport.images.length > 0 && (
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <ImageIcon size={14} /> Attached Evidence Photos ({selectedReport.images.length}) - Private Token Access
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  {selectedReport.images.map(img => (
                    <a
                      key={img.id}
                      href={img.view_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open full authorized image in private tab"
                      style={{
                        display: 'block',
                        width: '120px',
                        height: '90px',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        border: '1px solid var(--border)',
                        position: 'relative'
                      }}
                    >
                      <img
                        src={img.view_url}
                        alt="Private Evidence"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Privacy Boundary: Optional Reporter Contact Details */}
            <div style={{
              background: '#f8fafc',
              border: '1px dashed var(--border)',
              padding: '1rem',
              borderRadius: '8px',
              marginBottom: '1.5rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  <Lock size={15} color="var(--primary)" />
                  Optional Reporter Contact
                </div>
                {selectedReport.reporter_contact && !revealedContact && (
                  <button
                    onClick={() => setRevealedContact(true)}
                    style={{
                      background: 'var(--primary-light)',
                      color: 'var(--primary)',
                      padding: '0.25rem 0.6rem',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: 700
                    }}
                  >
                    Reveal (Logged to Audit)
                  </button>
                )}
              </div>

              {selectedReport.reporter_contact ? (
                revealedContact ? (
                  <div style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
                    <div style={{ fontWeight: 700, color: 'var(--primary)' }}>📞 {selectedReport.reporter_contact}</div>
                    {selectedReport.reporter_contact_note && (
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                        Note: {selectedReport.reporter_contact_note}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                    Reporter provided contact details. Click Reveal to inspect. This action is recorded in the audit trail.
                  </div>
                )
              ) : (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                  Reporter chose to remain 100% anonymous (no contact details provided).
                </div>
              )}
            </div>

            {/* Status Update Form */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.25rem' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                Update Workflow Status
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginBottom: '0.75rem' }}>
                {['new', 'reviewing', 'referred', 'closed'].map(st => (
                  <button
                    type="button"
                    key={st}
                    onClick={() => setNewStatus(st)}
                    style={{
                      padding: '0.45rem',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      textTransform: 'capitalize',
                      border: `1.5px solid ${newStatus === st ? 'var(--primary)' : 'var(--border)'}`,
                      background: newStatus === st ? 'var(--primary-light)' : 'white',
                      color: newStatus === st ? 'var(--primary)' : 'var(--text-secondary)'
                    }}
                  >
                    {st}
                  </button>
                ))}
              </div>

              <input
                type="text"
                value={statusUpdateNote}
                onChange={(e) => setStatusUpdateNote(e.target.value)}
                placeholder="Optional internal staff note (e.g. Liaison notified)"
                style={{
                  width: '100%',
                  padding: '0.55rem',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  fontSize: '0.82rem',
                  marginBottom: '1rem'
                }}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
                <button
                  type="button"
                  onClick={() => setSelectedReport(null)}
                  style={{ padding: '0.55rem 1rem', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.85rem' }}
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleSaveStatus}
                  style={{ padding: '0.55rem 1.25rem', borderRadius: '6px', background: 'var(--primary)', color: 'white', fontWeight: 700, fontSize: '0.85rem' }}
                >
                  Save Status
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DELIBERATE RESPONDER ACTION MODAL */}
      {responderModalOpen && selectedResponder && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '540px', padding: '1.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <PhoneCall size={22} color="var(--primary)" />
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>
                Deliberate Responder Contact Action
              </h3>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              This tool assists staff in connecting with verified community safety patrols. <strong>The system never calls automatically.</strong>
            </p>

            {/* Select Responder Dropdown */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.3rem' }}>
                Select Safety Responder:
              </label>
              <select
                value={selectedResponder.id}
                onChange={(e) => {
                  const match = responders.find(r => r.id === e.target.value);
                  if (match) setSelectedResponder(match);
                }}
                style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '0.88rem' }}
              >
                {responders.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.category})
                  </option>
                ))}
              </select>
            </div>

            {/* Responder Contact Card */}
            <div style={{ background: 'var(--bg-subtle)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {selectedResponder.name}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.4rem' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.15rem', fontWeight: 800, color: 'var(--primary)' }}>
                  {selectedResponder.phone}
                </span>
                <button
                  type="button"
                  onClick={handleCopyPhone}
                  style={{
                    background: 'white',
                    border: '1px solid var(--border)',
                    padding: '0.3rem 0.6rem',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem'
                  }}
                >
                  {copiedPhone ? <Check size={14} color="var(--accent-emerald)" /> : <Copy size={14} />}
                  {copiedPhone ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem', lineHeight: 1.4 }}>
                {selectedResponder.instructions || 'Standard coordination guidelines apply.'}
              </div>
            </div>

            {/* Deliberate Confirmation Checkbox */}
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.82rem', color: 'var(--text-primary)', cursor: 'pointer', marginBottom: '1.5rem' }}>
              <input
                type="checkbox"
                checked={deliberateConsent}
                onChange={(e) => setDeliberateConsent(e.target.checked)}
                style={{ marginTop: '0.15rem' }}
              />
              <span>
                I confirm that I have reviewed the cluster/report and explicitly choose to initiate contact with this safety liaison. (This deliberate click is recorded to the audit log).
              </span>
            </label>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
              <button
                type="button"
                onClick={() => setResponderModalOpen(false)}
                style={{ padding: '0.55rem 1rem', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.85rem' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!deliberateConsent}
                onClick={handleDeliberateDial}
                style={{
                  padding: '0.55rem 1.25rem',
                  borderRadius: '6px',
                  background: deliberateConsent ? 'var(--primary)' : '#94a3b8',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}
              >
                <PhoneCall size={14} /> Open Phone Link (tel:)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
