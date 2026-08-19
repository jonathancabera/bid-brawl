import { Link } from 'react-router-dom';
import RegisterForm from '../components/RegisterForm';

export default function Landing() {
  return (
    <div className="flex flex-col gap-4 max-w-sm">
      <div>
        <h1 className="text-2xl font-semibold">BidBrawl</h1>
        <p>Real-time auctions. Live bidding, sealed reserves, one winner per lot.</p>
      </div>

      <RegisterForm />

      <p>
        Already have an account? <Link to="/login">Log in</Link>
      </p>
      <p>
        Or <Link to="/auctions">browse auctions</Link> without an account.
      </p>
    </div>
  );
}
