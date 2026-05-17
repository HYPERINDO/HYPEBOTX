import LogoutButton from "./LogoutButton.jsx";
import { useAuth } from "../hooks/useAuth.js";

export default function Navbar({ title }) {
  const { user } = useAuth();

  return (
    <header className="navbar">
      <div>
        <p className="eyebrow">HYPEBOTX</p>
        <h1>{title}</h1>
      </div>
      <div className="navbar-user">
        <span>{user?.username}</span>
        <span className="role-pill">{user?.role}</span>
        <LogoutButton />
      </div>
    </header>
  );
}
