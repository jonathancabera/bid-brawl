import { Link, Outlet, useNavigate } from 'react-router-dom';
import { clearToken, getToken } from './api/auth';

export default function Layout() {
  const navigate = useNavigate();
  const isAuthed = getToken() !== null;

  function handleLogout() {
    clearToken();
    navigate('/');
  }

  return (
    <div className="min-h-screen">
      <nav className="flex items-center gap-4 border-b px-6 py-4">
        <Link to="/" className="font-semibold">
          BidBrawl
        </Link>
        {isAuthed ? (
          <>
            <Link to="/create" className="ml-auto text-sm">
              Create auction
            </Link>
            <Link to="/payment" className="text-sm">
              Payment method
            </Link>
            <button type="button" onClick={handleLogout} className="text-sm">
              Log out
            </button>
          </>
        ) : (
          <>
            <Link to="/auctions" className="ml-auto text-sm">
              Browse
            </Link>
            <Link to="/login" className="text-sm">
              Log in
            </Link>
            <Link to="/register" className="text-sm">
              Sign up
            </Link>
          </>
        )}
      </nav>
      <main className="px-6 py-6">
        <Outlet />
      </main>
    </div>
  );
}
