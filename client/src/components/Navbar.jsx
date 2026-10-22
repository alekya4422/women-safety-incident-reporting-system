import React, { useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ShieldAlert, ShieldCheck, LogOut, ArrowUpRight, PhoneCall, ExternalLink } from 'lucide-react';
import { adminLogout } from '../services/api';

export default function Navbar({ adminUser, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();

  // Quick exit hotkey (Esc key)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        quickExit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const quickExit = () => {
    window.location.replace('https://www.google.com/search?q=weather+today');
  };

  const handleLogout = async () => {
    await adminLogout();
    if (onLogout) onLogout();
    navigate('/admin/login');
  };

  const isAdminRoute = location.pathname.startsWith('/admin');

  return (
    <header style={{
      background: '#ffffff',
      borderBottom: '1px solid var(--border)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      boxShadow: 'var(--shadow-sm)'
    }}>
      {/* Emergency Hotline Header Banner */}
      <div style={{
        background: '#fef2f2',
        borderBottom: '1px solid #fee2e2',
        color: '#991b1b',
        fontSize: '0.8rem',
        padding: '0.4rem 1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.5rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 500 }}>
          <PhoneCall size={14} />
          <span>In immediate danger? Call National Emergency Helpline: <strong>112</strong> or Women Helpline: <strong>1091</strong></span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ color: '#b91c1c', fontSize: '0.75rem' }}>Not an emergency response service</span>
          <button
            onClick={quickExit}
            title="Press ESC to quickly leave this page"
            style={{
              background: '#dc2626',
              color: '#ffffff',
              padding: '0.2rem 0.6rem',
              borderRadius: '4px',
              fontSize: '0.75rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              transition: 'background 0.2s'
            }}
          >
            Quick Exit [ESC]
          </button>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div className="container" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: '0.8rem',
        paddingBottom: '0.8rem'
      }}>
        <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div style={{
            background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
            color: 'white',
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 10px rgba(79, 70, 229, 0.3)'
          }}>
            <ShieldCheck size={22} />
          </div>
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              SafeSignal
              <span style={{ fontSize: '0.65rem', background: 'var(--primary-light)', color: 'var(--primary)', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: 700 }}>COMMUNITY</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Women's Safety & Coordination</div>
          </div>
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link
            to="/"
            style={{
              padding: '0.45rem 0.85rem',
              borderRadius: 'var(--radius-sm)',
              textDecoration: 'none',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: !isAdminRoute ? 'var(--primary)' : 'var(--text-secondary)',
              background: !isAdminRoute ? 'var(--primary-light)' : 'transparent'
            }}
          >
            Report Incident
          </Link>

          {adminUser ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Link
                to="/admin"
                style={{
                  padding: '0.45rem 0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  textDecoration: 'none',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: isAdminRoute ? 'var(--primary)' : 'var(--text-secondary)',
                  background: isAdminRoute ? 'var(--primary-light)' : 'transparent'
                }}
              >
                Admin Panel
              </Link>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', background: 'var(--bg-subtle)', padding: '0.3rem 0.6rem', borderRadius: '6px' }}>
                👤 {adminUser.username}
              </span>
              <button
                onClick={handleLogout}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.45rem 0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: '#dc2626',
                  background: '#fef2f2'
                }}
              >
                <LogOut size={14} />
                Logout
              </button>
            </div>
          ) : (
            <Link
              to="/admin/login"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.45rem 0.85rem',
                borderRadius: 'var(--radius-sm)',
                textDecoration: 'none',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                border: '1px solid var(--border)',
                background: 'white'
              }}
            >
              Staff Portal
              <ArrowUpRight size={14} />
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
