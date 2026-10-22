import React, { useState } from 'react';
import Navbar from '../components/Navbar';
import ReportForm from '../components/ReportForm';
import ReportSuccess from '../components/ReportSuccess';
import { Shield, EyeOff, Lock, Users, Phone, HelpCircle } from 'lucide-react';

export default function PublicReportPage({ adminUser, onLogout }) {
  const [submissionResult, setSubmissionResult] = useState(null);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-main)' }}>
      <Navbar adminUser={adminUser} onLogout={onLogout} />

      <main style={{ flex: 1, padding: '2rem 1.25rem' }}>
        <div className="container">
          {submissionResult ? (
            <ReportSuccess
              result={submissionResult}
              onReset={() => setSubmissionResult(null)}
            />
          ) : (
            <ReportForm
              onSuccess={(res) => setSubmissionResult(res)}
            />
          )}

          {/* Educational / Trust Features Section */}
          <div style={{
            maxWidth: '720px',
            margin: '3rem auto 1rem',
            borderTop: '1px solid var(--border)',
            paddingTop: '2rem'
          }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, textAlign: 'center', marginBottom: '1.5rem', color: 'var(--text-primary)' }}>
              How SafeSignal Protects You & Your Community
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
              <div style={{ background: 'white', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                <EyeOff size={20} color="var(--primary)" style={{ marginBottom: '0.4rem' }} />
                <h3 style={{ fontSize: '0.88rem', fontWeight: 700, marginBottom: '0.25rem' }}>Identity Protection</h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  You do not need to create an account or provide a name. Reports are treated as anonymous by default.
                </p>
              </div>

              <div style={{ background: 'white', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                <Lock size={20} color="var(--primary)" style={{ marginBottom: '0.4rem' }} />
                <h3 style={{ fontSize: '0.88rem', fontWeight: 700, marginBottom: '0.25rem' }}>Private Media Storage</h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  Photos are stripped of EXIF / GPS metadata and kept in restricted, encrypted storage.
                </p>
              </div>

              <div style={{ background: 'white', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                <Users size={20} color="var(--primary)" style={{ marginBottom: '0.4rem' }} />
                <h3 style={{ fontSize: '0.88rem', fontWeight: 700, marginBottom: '0.25rem' }}>Community Clustering</h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  When 5 reports emerge near a transit stop or locality within 24h, staff are alerted to coordinate preventative escorts.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer style={{
        background: 'white',
        borderTop: '1px solid var(--border)',
        padding: '1.5rem 1.25rem',
        marginTop: 'auto',
        fontSize: '0.8rem',
        color: 'var(--text-muted)'
      }}>
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <strong>SafeSignal</strong> — Open Incident Reporting & Community Safety Coordination Monorepo.
          </div>
          <div>
            Emergency: 112 • Women Support Helpline: 1091
          </div>
        </div>
      </footer>
    </div>
  );
}
