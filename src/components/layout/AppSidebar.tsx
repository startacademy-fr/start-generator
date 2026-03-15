import { NavLink, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  GraduationCap, 
  Users, 
  FileText, 
  Settings,
  LogOut,
  ChevronLeft,
  Menu,
  Link2,
  UserCog,
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  Award
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import logo from '@/assets/logo.png';

const allNavigation = [
  { name: 'Tableau de bord', href: '/dashboard', icon: LayoutDashboard, roles: ['super_admin', 'admin', 'assistante', 'formateur', 'lecteur'] },
  { name: 'Formations', href: '/formations', icon: BookOpen, roles: ['super_admin', 'admin', 'assistante', 'lecteur'] },
  { name: 'Sessions', href: '/sessions', icon: CalendarDays, roles: ['super_admin', 'admin', 'assistante', 'lecteur'] },
  { name: 'Formateurs', href: '/formateurs', icon: UserCog, roles: ['super_admin', 'admin', 'assistante', 'lecteur'] },
  { name: 'Stagiaires', href: '/stagiaires', icon: Users, roles: ['super_admin', 'admin', 'assistante', 'lecteur'] },
  { name: 'Documents', href: '/documents', icon: FileText, roles: ['super_admin', 'assistante', 'formateur'] },
  { name: 'Suivi Audit', href: '/audit', icon: ClipboardCheck, roles: ['super_admin', 'admin', 'assistante'] },
  { name: 'Catalogue', href: '/formations', icon: BookOpen, roles: ['formateur'] },
  { name: 'Liens d\'accès', href: '/access-tokens', icon: Link2, roles: ['super_admin', 'admin', 'assistante'] },
];

export function AppSidebar() {
  const location = useLocation();
  const { profile, roles, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const navigation = allNavigation.filter((item) =>
    item.roles.some((role) => roles.includes(role as any))
  );

  const getRoleLabel = () => {
    if (roles.includes('super_admin')) return 'Super Administrateur';
    if (roles.includes('admin')) return 'Administrateur';
    if (roles.includes('assistante')) return 'Assistante';
    if (roles.includes('formateur')) return 'Formateur';
    if (roles.includes('lecteur')) return 'Lecteur';
    return 'Utilisateur';
  };

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen bg-sidebar transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
          {!collapsed && (
            <div className="flex items-center gap-3">
              <img src={logo} alt="Start Academy" className="h-10 w-auto" />
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className="text-sidebar-foreground hover:bg-sidebar-accent"
          >
            {collapsed ? <Menu className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-2">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href || 
                           location.pathname.startsWith(item.href + '/');
            return (
              <NavLink
                key={item.name}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                {!collapsed && <span>{item.name}</span>}
              </NavLink>
            );
          })}
        </nav>

        {/* User section */}
        <div className="border-t border-sidebar-border p-3">
          {!collapsed && profile && (
            <div className="mb-2 px-1">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {profile.prenom} {profile.nom}
              </p>
              <p className="text-xs text-sidebar-foreground/60">{getRoleLabel()}</p>
            </div>
          )}
          <div className={cn("flex gap-2", collapsed ? "flex-col" : "flex-row")}>
            <Button
              variant="ghost"
              size={collapsed ? "icon" : "sm"}
              className="text-sidebar-foreground hover:bg-sidebar-accent flex-1 justify-start px-2"
              asChild
            >
              <NavLink to="/settings">
                <Settings className="h-4 w-4 flex-shrink-0" />
                {!collapsed && <span className="ml-2 truncate">Paramètres</span>}
              </NavLink>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={signOut}
              className="text-sidebar-foreground hover:bg-destructive hover:text-destructive-foreground px-2"
              title="Déconnexion"
            >
              <LogOut className="h-4 w-4 flex-shrink-0" />
            </Button>
          </div>
        </div>
      </div>
    </aside>
  );
}
