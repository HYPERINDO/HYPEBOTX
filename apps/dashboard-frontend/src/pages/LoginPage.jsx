import { LogIn } from "lucide-react";
import AuthLayout from "../layouts/AuthLayout.jsx";
import { useAuth } from "../hooks/useAuth.js";

export default function LoginPage() {
  const { loginWithDiscord } = useAuth();

  return (
    <AuthLayout>
      <section className="login-panel">
        <div className="login-logo">HYPEBOTX</div>
        <h1>HYPEBOTX DASHBOARD</h1>
        <p>Masuk menggunakan akun Discord yang sudah terdaftar sebagai Owner, Admin, atau Penjoki.</p>
        <button className="discord-button" type="button" onClick={loginWithDiscord}>
          <LogIn size={20} />
          LOGIN DENGAN DISCORD
        </button>
        <footer>
          Dashboard khusus staff HYPEBOTX.
          <br />
          © HYPEBOTX
        </footer>
      </section>
    </AuthLayout>
  );
}
