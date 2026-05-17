import { Link } from "react-router-dom";
import AuthLayout from "../layouts/AuthLayout.jsx";
import LogoutButton from "../components/LogoutButton.jsx";

export default function UnauthorizedPage() {
  return (
    <AuthLayout>
      <section className="login-panel compact">
        <div className="login-logo">HYPEBOTX</div>
        <h1>Akses Ditolak</h1>
        <p>Akun Discord ini belum memiliki role dashboard aktif.</p>
        <div className="auth-actions">
          <LogoutButton />
          <Link to="/login">Login ulang</Link>
        </div>
      </section>
    </AuthLayout>
  );
}
