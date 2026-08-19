import { Link, Outlet } from 'react-router-dom';

export default function Layout() {
  return (
    <div className="min-h-screen">
      <nav className="flex items-center gap-4 border-b px-6 py-4">
        <Link to="/" className="font-semibold">
          Live Auctions
        </Link>
        <Link to="/create" className="ml-auto text-sm">
          Create auction
        </Link>
        <Link to="/payment" className="text-sm">
          Payment method
        </Link>
      </nav>
      <main className="px-6 py-6">
        <Outlet />
      </main>
    </div>
  );
}
