import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar/Sidebar';
import Header from '../components/Header/Header';
import Breadcrumbs from '../components/Breadcrumbs/Breadcrumbs';

const Layout = () => {
  const location = useLocation();
  
  return (
    <div className="flex h-screen bg-surface-gray dark:bg-slate-950 text-gray-900 dark:text-gray-100 font-inter antialiased selection:bg-emerald-500/30">
      {/* Sidebar */}
      <Sidebar />
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <Header />
        
        {/* Page Content */}
        <main className="relative flex-1 overflow-x-hidden overflow-y-auto bg-surface-gray dark:bg-slate-950 p-6">
          <div
            className="pointer-events-none absolute inset-0 z-0 opacity-[0.03] md:opacity-[0.055] bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] dark:bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] bg-fixed"
            aria-hidden
          />
          <div className="relative z-[1] max-w-screen-xl mx-auto backdrop-blur-[2px]">
            <Breadcrumbs />
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;