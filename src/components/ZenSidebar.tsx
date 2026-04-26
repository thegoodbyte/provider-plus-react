import React from 'react';
import {
  Home,
  Users,
  Calendar,
  Heart,
  Bell,
  CreditCard,
  CheckSquare,
  LogOut,
  UserCheck,
  Building
} from 'lucide-react';

interface ZenSidebarProps {
  activeItem: string;
  onItemClick: (item: string) => void;
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
  userRole?: string;
}

const ZenSidebar: React.FC<ZenSidebarProps> = ({
  activeItem,
  onItemClick,
  isOpen,
  onClose,
  onLogout,
  userRole
}) => {
  const isMedicalAdvisor = userRole === 'medical_advisor';

  const menuItems = isMedicalAdvisor ? [
    { id: 'medical-dashboard', label: 'Dashboard', icon: Home },
    { id: 'medical-retreats', label: 'Retreats', icon: Calendar },
  ] : [
    { id: 'clients', label: 'Clients', icon: Users },
    { id: 'bookings', label: 'Bookings', icon: Calendar },
    { id: 'medical', label: 'Medical', icon: Heart },
    { id: 'houses', label: 'Houses', icon: Building },
    { id: 'reminders', label: 'Reminders', icon: Bell },
    { id: 'payments', label: 'Payments', icon: CreditCard },
    { id: 'requirements', label: 'Requirements', icon: CheckSquare },
  ];

  return (
    <aside
      className={`
        fixed top-0 left-0 h-full z-40
        w-64 bg-white border-r border-zen-100
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
      `}
    >
      <nav className="h-full flex flex-col">
        {/* Logo Area */}
        <div className="p-6 border-b border-zen-100">
          <h2 className="text-lg font-light text-zen-800 tracking-wide">
            Navigation
          </h2>
        </div>

        {/* Menu Items */}
        <div className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1 px-3">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeItem === item.id;

              return (
                <li key={item.id}>
                  <button
                    onClick={() => onItemClick(item.id)}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2.5 rounded-soft
                      transition-all duration-200 text-left
                      ${isActive
                        ? 'bg-zen-100 text-zen-900'
                        : 'text-zen-600 hover:bg-zen-50 hover:text-zen-800'
                      }
                    `}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    <span className="text-sm font-medium">
                      {item.label}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* User Section */}
        <div className="border-t border-zen-100 p-4">
          <div className="mb-3 px-3">
            <p className="text-xs text-zen-500 uppercase tracking-wider mb-1">
              Role
            </p>
            <p className="text-sm text-zen-700 font-medium">
              {isMedicalAdvisor ? 'Medical Advisor' : 'Administrator'}
            </p>
          </div>

          <button
            onClick={onLogout}
            className="
              w-full flex items-center gap-3 px-3 py-2.5 rounded-soft
              text-zen-600 hover:bg-zen-50 hover:text-zen-800
              transition-all duration-200
            "
          >
            <LogOut className="w-5 h-5" />
            <span className="text-sm font-medium">Logout</span>
          </button>
        </div>
      </nav>
    </aside>
  );
};

export default ZenSidebar;