import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../api/session';
import { ApiError } from '../api/client';

export default function Login() {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await login(email, password);
      navigate('/create');
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
    <div>
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder={'email'}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border border-gray-400 rounded px-2 py-1"
        ></input>
        <input
          type="password"
          placeholder={'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border border-gray-400 rounded px-2 py-1"
        ></input>
        {error && <p>{error}</p>}
        <button type="submit" disabled={loading}>
          Log in
        </button>
      </form>
    </div>
  );
}
