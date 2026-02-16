import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, Car, Users, MapPin, DollarSign, LogOut, Camera, Handshake, Wrench, ClipboardList, Menu, X } from 'lucide-react';

var adminLinks = [
  { to: '/', icon: LayoutDashboard, label: 'Tableau de bord' },
  { to: '/drivers', icon: Car, label: 'Chauffeurs' },
  { to: '/riders', icon: Users, label: 'Passagers' },
  { to: '/rides', icon: MapPin, label: 'Courses' },
  { to: '/revenue', icon: DollarSign, label: 'Revenus' },
  { to: '/photos', icon: Camera, label: 'Photos' },
  { to: '/services', icon: Wrench, label: 'Prestataires' },
  { to: '/service-requests', icon: ClipboardList, label: 'Demandes Services' },
  { to: '/partners', icon: Handshake, label: 'Partenaires' },
];

var partnerLinks = [
  { to: '/', icon: LayoutDashboard, label: 'Tableau de bord' },
  { to: '/my-drivers', icon: Car, label: 'Mes Chauffeurs' },
  { to: '/my-earnings', icon: DollarSign, label: 'Mes Revenus' },
];

export default function Layout() {
  var { logout, user, isAdmin, isPartner } = useAuth();
  var navigate = useNavigate();
  var links = isAdmin ? adminLinks : partnerLinks;
  var [sidebarOpen, setSidebarOpen] = useState(false);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  function closeSidebar() {
    setSidebarOpen(false);
  }

  return (
    <div className="flex h-screen" style={{ background: 'linear-gradient(145deg, #001A12 0%, #002418 40%, #003322 100%)' }}>

      {/* FLAG BAR */}
      <div className="fixed top-0 left-0 right-0 h-1 z-[60] flex">
        <div className="flex-1" style={{ background: '#00853F' }}></div>
        <div className="flex-1" style={{ background: '#FDEF42' }}></div>
        <div className="flex-1" style={{ background: '#E31B23' }}></div>
      </div>

      {/* MOBILE HEADER */}
      <div className="lg:hidden fixed top-1 left-0 right-0 z-40 flex items-center justify-between px-4 py-3" style={{ background: 'rgba(0, 26, 18, 0.85)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-3">
          <button onClick={function() { setSidebarOpen(!sidebarOpen); }} className="p-2 rounded-lg text-white/60 hover:text-white" style={{ background: 'rgba(255,255,255,0.06)' }}>
            {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
          <div className="flex items-center gap-2">
            <img src="https://res.cloudinary.com/dittpcisb/image/upload/w_64,h_64,c_fill,r_max,q_80/v1771047319/terango-brand/logo-driver.jpg" alt="TeranGO" className="w-8 h-8 rounded-full" style={{ border: '2px solid rgba(0,133,63,0.4)' }} />
            <span className="text-lg font-extrabold text-white">Teran<span style={{ color: '#D4AF37' }}>GO</span></span>
          </div>
        </div>
        {user && <p className="text-xs truncate max-w-[120px]" style={{ color: 'rgba(255,255,255,0.4)' }}>{user.name || user.email}</p>}
      </div>

      {/* MOBILE OVERLAY */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40" style={{ background: 'rgba(0,10,6,0.7)' }} onClick={closeSidebar}></div>
      )}

      {/* SIDEBAR */}
      <aside
        className={'fixed lg:static z-50 h-full w-72 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ' + (sidebarOpen ? 'translate-x-0' : '-translate-x-full')}
        style={{ background: 'linear-gradient(180deg, rgba(0,36,24,0.95) 0%, rgba(0,26,18,0.98) 100%)', backdropFilter: 'blur(20px)', borderRight: '1px solid rgba(255,255,255,0.06)' }}
      >
        {/* SIDEBAR HEADER */}
        <div className="p-6" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-3 mb-3">
            <img src="https://res.cloudinary.com/dittpcisb/image/upload/w_80,h_80,c_fill,r_max,q_80/v1771047319/terango-brand/logo-driver.jpg" alt="TeranGO" className="w-11 h-11 rounded-full" style={{ border: '2px solid rgba(0,133,63,0.5)', boxShadow: '0 0 20px rgba(0,133,63,0.15)' }} />
            <div>
              <h1 className="text-xl font-extrabold text-white" style={{ letterSpacing: '-0.5px' }}>Teran<span style={{ color: '#D4AF37' }}>GO</span></h1>
              <p className="text-xs font-medium" style={{ color: 'rgba(0,133,63,0.8)' }}>{isAdmin ? 'Administration' : 'Espace Partenaire'}</p>
            </div>
          </div>
          {user && (
            <div className="rounded-xl px-3 py-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.5)' }}>{user.name || user.email}</p>
            </div>
          )}
        </div>

        {/* NAV LINKS */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {links.map(function(link) {
            var Icon = link.icon;
            return (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/'}
                onClick={closeSidebar}
                className={function({ isActive }) {
                  return 'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ' +
                    (isActive ? 'text-white' : 'hover:text-white');
                }}
                style={function({ isActive }) {
                  return isActive ? {
                    background: 'rgba(0,133,63,0.15)',
                    color: '#fff',
                    border: '1px solid rgba(0,133,63,0.2)',
                    boxShadow: '0 2px 12px rgba(0,133,63,0.1)'
                  } : {
                    color: 'rgba(255,255,255,0.45)',
                    border: '1px solid transparent',
                    background: 'transparent'
                  };
                }}
              >
                <Icon size={20} />
                {link.label}
              </NavLink>
            );
          })}
        </nav>

        {/* LOGOUT */}
        <div className="p-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm w-full transition-all duration-200"
            style={{ color: 'rgba(255,255,255,0.4)', background: 'transparent' }}
            onMouseEnter={function(e) { e.target.style.color = '#E31B23'; e.target.style.background = 'rgba(227,27,35,0.08)'; }}
            onMouseLeave={function(e) { e.target.style.color = 'rgba(255,255,255,0.4)'; e.target.style.background = 'transparent'; }}
          >
            <LogOut size={20} />
            Deconnexion
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-auto pt-16 lg:pt-1">
        <div className="p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
