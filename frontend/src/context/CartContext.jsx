import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

const CartContext = createContext(null);
const EMPTY = { items: [], bill: null, canCheckout: false, hasIssues: false };

export function CartProvider({ children }) {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [cart, setCart] = useState(EMPTY);
  const [pending, setPending] = useState(new Set());

  const refresh = useCallback(
    async (couponCode) => {
      if (!user) return setCart(EMPTY);
      const data = await api('/cart', { query: { coupon: couponCode } });
      setCart(data);
      return data;
    },
    [user],
  );

  useEffect(() => {
    refresh().catch(() => setCart(EMPTY));
  }, [refresh]);

  const mutate = useCallback(
    async (productId, request) => {
      if (!user) {
        toast.show('Log in to start your cart');
        navigate('/login');
        return;
      }
      setPending((set) => new Set(set).add(productId));
      try {
        setCart(await request());
      } catch (err) {
        toast.error(err.message);
      } finally {
        setPending((set) => {
          const next = new Set(set);
          next.delete(productId);
          return next;
        });
      }
    },
    [user, toast, navigate],
  );

  const value = useMemo(() => {
    const quantities = new Map(cart.items.map((item) => [item.product.id, item.quantity]));
    return {
      cart,
      setCart,
      refresh,
      count: cart.items.reduce((sum, item) => sum + item.quantity, 0),
      quantityOf: (productId) => quantities.get(productId) || 0,
      isPending: (productId) => pending.has(productId),
      add: (productId, quantity = 1) =>
        mutate(productId, () => api('/cart', { method: 'POST', body: { productId, quantity } })),
      setQuantity: (productId, quantity) =>
        mutate(productId, () => api(`/cart/${productId}`, { method: 'PUT', body: { quantity } })),
      remove: (productId) => mutate(productId, () => api(`/cart/${productId}`, { method: 'DELETE' })),
    };
  }, [cart, pending, mutate, refresh]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);
