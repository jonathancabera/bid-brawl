import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { register } from '../api/session';
import { ApiError } from '../api/client';

export default function RegisterForm() {
  const navigate = useNavigate();

  const [email, setEmail] = useState<string>('');
  const [displayName, setDisplayName] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !displayName.trim() || !password) {
      setError('email, display name, and password are required');
      return;
    }

    setLoading(true);
    try {
      await register(email.trim(), password, displayName.trim());
      navigate('/payment');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('something went wrong');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <input
        type="email"
        placeholder={'email'}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={loading}
        className="border border-gray-400 rounded px-2 py-1"
      ></input>
      <input
        type="text"
        placeholder={'display name'}
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        disabled={loading}
        className="border border-gray-400 rounded px-2 py-1"
      ></input>
      <input
        type="password"
        placeholder={'password'}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        disabled={loading}
        className="border border-gray-400 rounded px-2 py-1"
      ></input>
      {error && <p>{error}</p>}
      <button type="submit" disabled={loading}>
        {loading ? 'Creating account...' : 'Sign up'}
      </button>
    </form>
  );
}
