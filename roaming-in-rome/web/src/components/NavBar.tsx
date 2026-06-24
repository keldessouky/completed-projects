import { JSX } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { loggedOut } from '../store/authSlice';
import { useAppDispatch, useAppSelector } from '../store/hooks';

export function NavBar(): JSX.Element {
  const user = useAppSelector((state) => state.auth.user);
  const dispatch = useAppDispatch();

  return (
    <header className="navbar">
      <Link to="/" className="brand">
        Roaming in Rome
      </Link>
      <nav>
        <NavLink to="/landmarks">Landmarks</NavLink>
        {user && <NavLink to="/itineraries">My Itineraries</NavLink>}
        {user ? (
          <>
            <span className="greeting">Hi, {user.username}</span>
            <button type="button" className="link-button" onClick={() => dispatch(loggedOut())}>
              Log out
            </button>
          </>
        ) : (
          <>
            <NavLink to="/login">Log in</NavLink>
            <NavLink to="/register">Register</NavLink>
          </>
        )}
      </nav>
    </header>
  );
}
