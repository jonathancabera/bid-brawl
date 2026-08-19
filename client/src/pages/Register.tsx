import { Link } from 'react-router-dom';
import RegisterForm from '../components/RegisterForm';

export default function Register() {
  return (
    <div className="flex flex-col gap-4 max-w-sm">
      <h1 className="font-semibold">Create an account</h1>
      <RegisterForm />
      <p>
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </div>
  );
}
