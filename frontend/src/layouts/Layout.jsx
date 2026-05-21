import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar/Sidebar';
import Header from '../components/Header/Header';
import Breadcrumbs from '../components/Breadcrumbs/Breadcrumbs';

const Layout = () => {
  const location = useLocation();

  return (
    <div className="app-shell">
      <Sidebar />

      <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">
        <Header />

        <main className="app-main">
          <div className="w-full min-w-0 max-w-[1680px] mx-auto">
            <Breadcrumbs />
            <div key={location.pathname} className="mt-5 pb-12 w-full min-w-0 page-enter">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
