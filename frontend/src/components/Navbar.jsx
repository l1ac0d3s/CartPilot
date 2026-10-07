import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { money } from '../utils/format';

export default function Navbar() {
  const { user, isAdmin, logout } = useAuth();
  const { count, cart } = useCart();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [search, setSearch] = useState(params.get('search') || '');

  useEffect(() => setSearch(params.get('search') || ''), [params]);

  const submit = (event) => {
    event.preventDefault();
    const next = new URLSearchParams();
    if (search.trim()) next.set('search', search.trim());
    navigate(`/?${next}`);
  };

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="brand" aria-label="CartPilot home">
          <span className="brand-mark" aria-hidden="true">🛒</span>
          <span className="brand-text">
            Cart<strong>Pilot</strong>
            <small>Delivery in 10 minutes</small>
          </span>
        </Link>

        <form className="search" onSubmit={submit} role="search">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder='Search "milk", "chips", "atta"…'
            aria-label="Search products"
          />
        </form>

        <nav className="nav-links">
          {isAdmin && (
            <NavLink to="/admin" className="nav-link">
              Admin
            </NavLink>
          )}
          {user ? (
            <>
              <NavLink to="/orders" className="nav-link">
                Orders
              </NavLink>
              <button
                className="nav-link link-button"
                onClick={() => {
                  logout();
                  navigate('/');
                }}
              >
                Log out
              </button>
            </>
          ) : (
            <NavLink to="/login" className="nav-link">
              Log in
            </NavLink>
          )}
          <Link to="/cart" className="cart-button" aria-label={`Cart, ${count} items`}>
            <span aria-hidden="true">🛒</span>
            {count > 0 ? (
              <span className="cart-button-text">
                <strong>{count} item{count > 1 ? 's' : ''}</strong>
                <span>{money(cart.bill?.total)}</span>
              </span>
            ) : (
              <span className="cart-button-text">My cart</span>
            )}
          </Link>
        </nav>
      </div>
    </header>
  );
}
