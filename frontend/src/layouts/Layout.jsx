import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar/Sidebar';
import Header from '../components/Header/Header';
import Breadcrumbs from '../components/Breadcrumbs/Breadcrumbs';

const Layout = () => {
  const location = useLocation();
  
  return (
    <div className="flex h-screen min-w-0 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 antialiased selection:bg-primary/25">
      <Sidebar />
      
      <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">
        {/* Header */}
        <Header />
        
        {/* Page Content */}
        <main className="relative flex-1 min-h-0 min-w-0 overflow-x-hidden overflow-y-auto p-6 md:p-8">
          <div className="relative z-[1] w-full min-w-0 max-w-[1600px] mx-auto">
            <Breadcrumbs />
            <div key={location.pathname} className="mt-6 pb-10 w-full min-w-0 page-enter">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;