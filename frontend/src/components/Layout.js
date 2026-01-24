import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useMarketData } from '../contexts/MarketDataContext';
import { Button } from './ui/button';
import { 
  LayoutDashboard, 
  Package, 
  Users, 
  FileText, 
  BarChart3, 
  LogOut, 
  Coins,
  TrendingUp,
  TrendingDown,
  Shield,
  Settings,
  ClipboardList,
  ClipboardCheck,
  ChevronDown,
  ChevronRight,
  Receipt,
  Wallet,
  Building2,
  ArrowLeftRight,
  History,
  Scale,
  Banknote,
  FolderOpen,
  UserCog,
  CreditCard,
  Menu,
  X,
  PanelLeftClose,
  PanelLeft,
  BookOpen
} from 'lucide-react';
import ThemeToggle from './ThemeToggle';

const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const { marketData, connected } = useMarketData();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Hamburger menü state'leri
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  
  // Alt menü state'leri
  const [reportsExpanded, setReportsExpanded] = useState(false);
  const [cashExpanded, setCashExpanded] = useState(false);
  const [expensesExpanded, setExpensesExpanded] = useState(false);
  const [partnersExpanded, setPartnersExpanded] = useState(false);
  const [employeesExpanded, setEmployeesExpanded] = useState(false);
  const [stockExpanded, setStockExpanded] = useState(false);

  // Ekran boyutu kontrolü
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (mobile) {
        setSidebarOpen(false);
      }
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Mobilde sayfa değişince menüyü kapat
  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  }, [location.pathname, isMobile]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Ürünler', href: '/products', icon: Package },
    { name: 'Cariler', href: '/parties', icon: Users },
    { name: 'İşlemler', href: '/transactions', icon: FileText },
    { name: 'Muhasebe Defteri', href: '/unified-ledger', icon: BookOpen },
    { 
      name: 'Kasa', 
      icon: Wallet, 
      isSubmenu: true,
      submenuKey: 'cash',
      subItems: [
        { name: 'Kasa Durumu', href: '/cash', icon: Wallet },
        { name: 'Kasa Tanımları', href: '/cash/registers', icon: Building2 },
        { name: 'Kasa Hareketleri', href: '/cash/movements', icon: History },
        { name: 'Döviz Alış-Satış', href: '/transactions/create/exchange', icon: ArrowLeftRight },
      ]
    },
    { 
      name: 'Stok Raporu', 
      icon: BarChart3, 
      isSubmenu: true,
      submenuKey: 'stock',
      subItems: [
        { name: 'Stok Özeti', href: '/stock-report', icon: BarChart3 },
        { name: 'Stok Sayımı', href: '/inventory/stock-counts', icon: ClipboardCheck },
      ]
    },
    { 
      name: 'Giderler', 
      icon: Banknote, 
      isSubmenu: true,
      submenuKey: 'expenses',
      subItems: [
        { name: 'Gider Listesi', href: '/expenses', icon: Receipt },
        { name: 'Yeni Gider', href: '/expenses/new', icon: Banknote },
        { name: 'Gider Kategorileri', href: '/expenses/categories', icon: FolderOpen },
      ]
    },
    { 
      name: 'Ortaklar', 
      icon: Users, 
      isSubmenu: true,
      submenuKey: 'partners',
      subItems: [
        { name: 'Ortak Listesi', href: '/partners', icon: Users },
        { name: 'Sermaye Hareketleri', href: '/partners/movements', icon: History },
      ]
    },
    { 
      name: 'Personel', 
      icon: UserCog, 
      isSubmenu: true,
      submenuKey: 'employees',
      subItems: [
        { name: 'Personel Listesi', href: '/employees', icon: Users },
        { name: 'Maaş İşlemleri', href: '/employees/salary', icon: Banknote },
        { name: 'Borç İşlemleri', href: '/employees/debts', icon: CreditCard },
      ]
    },
    { 
      name: 'Raporlar', 
      icon: ClipboardList, 
      isSubmenu: true,
      submenuKey: 'reports',
      subItems: [
        { name: 'Cari Ekstre', href: '/reports/account-statement', icon: Receipt },
        { name: 'Kâr/Zarar Raporu', href: '/reports/profit-loss', icon: TrendingUp },
        { name: 'Altın Hareketleri', href: '/reports/gold-movements', icon: Scale },
        { name: 'Genel Rapor', href: '/reports/general', icon: BarChart3, comingSoon: true },
      ]
    },
    { name: 'Kullanıcılar', href: '/users', icon: Shield, adminOnly: true },
    { name: 'Ayarlar', href: '/settings', icon: Settings, adminOnly: true },
  ];

  const formatPrice = (price) => {
    if (price === null || price === undefined) return '---';
    return parseFloat(price).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const MarketTicker = () => {
    // ALIŞ = KIRMIZI (biz para ödüyoruz), SATIŞ = YEŞİL (biz para alıyoruz)
    const items = [
      { label: 'HAS AL', value: marketData.has_gold_buy, suffix: '₺', color: 'text-red-500', bg: 'bg-red-500/10' },
      { label: 'HAS SAT', value: marketData.has_gold_sell, suffix: '₺', color: 'text-green-500', bg: 'bg-green-500/10' },
      { label: 'USD AL', value: marketData.usd_buy, suffix: '₺', color: 'text-red-500', bg: 'bg-red-500/10' },
      { label: 'USD SAT', value: marketData.usd_sell, suffix: '₺', color: 'text-green-500', bg: 'bg-green-500/10' },
      { label: 'EUR AL', value: marketData.eur_buy, suffix: '₺', color: 'text-red-500', bg: 'bg-red-500/10' },
      { label: 'EUR SAT', value: marketData.eur_sell, suffix: '₺', color: 'text-green-500', bg: 'bg-green-500/10' },
    ];

    return (
      <div className="flex items-center gap-4 overflow-x-auto" data-testid="market-ticker">
        {items.map((item, index) => (
          <div key={index} className={`flex items-center gap-2 whitespace-nowrap px-2 py-1 rounded ${item.bg}`}>
            <span className={`text-xs font-medium ${item.color}`}>{item.label}</span>
            <span className={`text-sm font-mono font-bold ${item.color}`}>
              {formatPrice(item.value)} {item.suffix}
            </span>
          </div>
        ))}
      </div>
    );
  };

  // Submenu toggle fonksiyonu
  const getSubmenuState = (submenuKey) => {
    switch (submenuKey) {
      case 'cash': return { expanded: cashExpanded, toggle: () => setCashExpanded(!cashExpanded) };
      case 'stock': return { expanded: stockExpanded, toggle: () => setStockExpanded(!stockExpanded) };
      case 'expenses': return { expanded: expensesExpanded, toggle: () => setExpensesExpanded(!expensesExpanded) };
      case 'partners': return { expanded: partnersExpanded, toggle: () => setPartnersExpanded(!partnersExpanded) };
      case 'employees': return { expanded: employeesExpanded, toggle: () => setEmployeesExpanded(!employeesExpanded) };
      case 'reports': return { expanded: reportsExpanded, toggle: () => setReportsExpanded(!reportsExpanded) };
      default: return { expanded: false, toggle: () => {} };
    }
  };

  // Sidebar genişliği
  const sidebarWidth = sidebarOpen ? 'w-64' : 'w-16';
  const mainMargin = isMobile ? 'ml-0' : (sidebarOpen ? 'ml-64' : 'ml-16');

  return (
    <div className="min-h-screen bg-background">
      {/* Overlay (Mobilde menü açıkken) */}
      {isMobile && sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`
          fixed inset-y-0 left-0 bg-card border-r border-border z-50
          transition-all duration-300 ease-in-out
          ${sidebarWidth}
          ${isMobile && !sidebarOpen ? '-translate-x-full' : 'translate-x-0'}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Logo & Toggle */}
          <div className="flex items-center justify-between h-16 px-4 border-b border-border">
            {sidebarOpen ? (
              <Link to="/dashboard" className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center gold-glow">
                  <Coins className="w-6 h-6 text-primary-foreground" />
                </div>
                <span className="text-2xl font-serif font-medium text-primary">Kuyumcu</span>
              </Link>
            ) : (
              <Link to="/dashboard" className="mx-auto">
                <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center gold-glow">
                  <Coins className="w-6 h-6 text-primary-foreground" />
                </div>
              </Link>
            )}
            
            {/* Toggle Button - Masaüstünde görünür */}
            {!isMobile && (
              <button
                onClick={toggleSidebar}
                className={`p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors ${!sidebarOpen ? 'absolute right-2 top-3' : ''}`}
                title={sidebarOpen ? 'Menüyü Daralt' : 'Menüyü Genişlet'}
              >
                {sidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeft size={20} />}
              </button>
            )}
            
            {/* Close Button - Mobilde görünür */}
            {isMobile && sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={20} />
              </button>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              // Hide admin-only items if user is not admin or super_admin
              if (item.adminOnly) {
                const userRole = user?.role?.toUpperCase();
                if (userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN') {
                  return null;
                }
              }
              
              const Icon = item.icon;
              
              // Handle submenu items
              if (item.isSubmenu) {
                const isAnySubActive = item.subItems?.some(sub => location.pathname === sub.href || location.pathname.startsWith(sub.href + '/'));
                const { expanded: isExpanded, toggle: toggleExpand } = getSubmenuState(item.submenuKey);
                
                return (
                  <div key={item.name}>
                    <button
                      onClick={toggleExpand}
                      className={`
                        w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-sans
                        ${isAnySubActive 
                          ? 'bg-primary/10 text-primary' 
                          : 'text-foreground hover:bg-secondary'
                        }
                        transition-colors duration-200
                        ${!sidebarOpen ? 'justify-center' : 'justify-between'}
                      `}
                      title={!sidebarOpen ? item.name : undefined}
                    >
                      <div className={`flex items-center gap-3 ${!sidebarOpen ? 'justify-center' : ''}`}>
                        <Icon className="w-5 h-5 flex-shrink-0" />
                        {sidebarOpen && <span>{item.name}</span>}
                      </div>
                      {sidebarOpen && (
                        isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
                      )}
                    </button>
                    
                    {/* Submenu items - sadece sidebar açıkken görünür */}
                    {isExpanded && sidebarOpen && (
                      <div className="ml-4 mt-1 space-y-1 border-l border-border pl-2">
                        {item.subItems?.map((subItem) => {
                          const SubIcon = subItem.icon;
                          const isSubActive = location.pathname === subItem.href;
                          
                          return (
                            <Link
                              key={subItem.name}
                              to={subItem.comingSoon ? '#' : subItem.href}
                              onClick={(e) => subItem.comingSoon && e.preventDefault()}
                              className={`
                                flex items-center gap-3 px-3 py-2 rounded-lg font-sans text-sm
                                ${isSubActive 
                                  ? 'bg-primary text-primary-foreground gold-glow' 
                                  : subItem.comingSoon 
                                    ? 'text-muted-foreground cursor-not-allowed' 
                                    : 'text-foreground hover:bg-secondary'
                                }
                                transition-colors duration-200
                              `}
                            >
                              <SubIcon className="w-4 h-4 flex-shrink-0" />
                              <span>{subItem.name}</span>
                              {subItem.comingSoon && (
                                <span className="ml-auto text-xs bg-muted px-2 py-0.5 rounded">Yakında</span>
                              )}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }
              
              // Regular menu items
              const isActive = location.pathname === item.href;
              
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-lg font-sans
                    ${isActive 
                      ? 'bg-primary text-primary-foreground gold-glow' 
                      : 'text-foreground hover:bg-secondary'
                    }
                    transition-colors duration-200
                    ${!sidebarOpen ? 'justify-center' : ''}
                  `}
                  data-testid={`nav-${item.name.toLowerCase()}`}
                  title={!sidebarOpen ? item.name : undefined}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {sidebarOpen && <span>{item.name}</span>}
                  {sidebarOpen && item.comingSoon && (
                    <span className="ml-auto text-xs bg-muted px-2 py-0.5 rounded">Yakında</span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* User Info */}
          <div className="p-3 border-t border-border">
            {sidebarOpen ? (
              <>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-primary font-semibold">{(user?.name || user?.full_name || user?.email)?.charAt(0)?.toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{user?.name || user?.full_name || 'Kullanıcı'}</p>
                    <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  className="w-full justify-start gap-2"
                  onClick={handleLogout}
                  data-testid="logout-btn"
                >
                  <LogOut className="w-4 h-4" />
                  Çıkış Yap
                </Button>
              </>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-primary font-semibold">{(user?.name || user?.full_name || user?.email)?.charAt(0)?.toUpperCase()}</span>
                </div>
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={handleLogout}
                  data-testid="logout-btn"
                  title="Çıkış Yap"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile Header Bar */}
      {isMobile && (
        <div className="fixed top-0 left-0 right-0 h-14 bg-card border-b border-border flex items-center px-4 z-30">
          <button 
            onClick={toggleSidebar}
            className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          >
            <Menu size={24} />
          </button>
          <Link to="/dashboard" className="ml-3 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Coins className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-serif font-medium text-primary">Kuyumcu</span>
          </Link>
          <div className="ml-auto flex items-center gap-3">
            <ThemeToggle />
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${connected ? 'bg-chart-1 animate-pulse' : 'bg-muted-foreground'}`} />
              <span className="text-xs text-muted-foreground font-mono">
                {connected ? 'CANLI' : 'BAĞLANTI'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main 
        className={`
          min-h-screen transition-all duration-300
          ${mainMargin}
          ${isMobile ? 'pt-14' : ''}
        `}
      >
        {/* Market Data Ticker */}
        <div className="sticky top-0 z-30 bg-card border-b border-border/50 backdrop-blur-sm">
          <div className="px-6 py-3">
            <div className="flex items-center justify-between">
              <MarketTicker />
              {!isMobile && (
                <div className="flex items-center gap-3 ml-4">
                  <ThemeToggle />
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${connected ? 'bg-chart-1 animate-pulse' : 'bg-muted-foreground'}`} />
                    <span className="text-xs text-muted-foreground font-mono">
                      {connected ? 'CANLI' : 'BAĞLANTI BEKLENİYOR'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Page Content */}
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
