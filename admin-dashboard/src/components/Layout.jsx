import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, Car, Users, MapPin, DollarSign, LogOut, Camera, Handshake } from 'lucide-react';

var adminLinks = [
  { to: '/', icon: LayoutDashboard, label: 'Tableau de bord' },
  { to: '/drivers', icon: Car, label: 'Chauffeurs' },
  { to: '/riders', icon: Users, label: 'Passagers' },
  { to: '/rides', icon: MapPin, label: 'Courses' },
  { to: '/revenue', icon: DollarSign, label: 'Revenus' },
  { to: '/photos', icon: Camera, label: 'Photos' },
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

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="flex h-screen bg-gray-950">
      <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="p-6 border-b border-gray-800">
          <h1 className="text-2xl font-bold text-emerald-400">TeranGO</h1>
          <p className="text-xs text-gray-500 mt-1">{isAdmin ? 'Administration' : 'Espace Partenaire'}</p>
          {user && <p className="text-xs text-gray-400 mt-2">{user.name || user.email}</p>}
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {links.map(function(link) {
            var Icon = link.icon;
            return (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/'}
                className={function({ isActive }) {
                  return 'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ' +
                    (isActive ? 'bg-emerald-500/10 text-emerald-400' : 'text-gray-400 hover:text-white hover:bg-gray-800');
                }}
              >
                <Icon size={20} />
                {link.label}
              </NavLink>
            );
          })}
        </nav>
        <div className="p-4 border-t border-gray-800">
          <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-gray-400 hover:text-red-400 hover:bg-gray-800 w-full transition-colors">
            <LogOut size={20} />
            Deconnexion
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-8">
        <Outlet />
      </main>
    </div>
  );
}
