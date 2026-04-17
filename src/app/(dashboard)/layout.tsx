'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

const navItems = [
  {
    section: 'Overview',
    items: [
      { href: '/', label: 'Dashboard', icon: '📊' },
    ],
  },
  {
    section: 'Outreach',
    items: [
      { href: '/campaigns', label: 'Campaigns', icon: '📧' },
      { href: '/campaigns/new', label: 'New Campaign', icon: '✨' },
      { href: '/contacts', label: 'Contacts', icon: '👥' },
      { href: '/contacts/lists', label: 'Contact Lists', icon: '📋' },
    ],
  },
  {
    section: 'Pipeline',
    items: [
      { href: '/leads', label: 'Leads', icon: '⚡' },
    ],
  },
  {
    section: 'Settings',
    items: [
      { href: '/smtp', label: 'SMTP Accounts', icon: '📬' },
      { href: '/deliverability', label: 'Deliverability', icon: '🛡️' },
      { href: '/settings', label: 'Settings', icon: '⚙️' },
    ],
  },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <div className="dashboard-layout">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 99,
          }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <div className="logo-mark">⚡</div>
            ColdReach
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((section) => (
            <div key={section.section} className="nav-section">
              <div className="nav-section-title">{section.section}</div>
              {section.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-item ${isActive(item.href) ? 'active' : ''}`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <span className="nav-icon">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user" onClick={handleLogout} title="Click to logout">
            <div className="sidebar-user-avatar">A</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">Admin</div>
              <div className="sidebar-user-email">Sign Out →</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="main-content">
        <div style={{ padding: 'var(--space-md) var(--space-2xl)', display: 'none' }}>
          <button
            className="mobile-menu-btn"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{ display: 'block' }}
          >
            ☰
          </button>
        </div>
        {children}
      </main>
    </div>
  );
}
