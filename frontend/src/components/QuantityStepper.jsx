import { useCart } from '../context/CartContext';

/** ADD button that turns into a −/+ stepper once the product is in the cart. */
export default function QuantityStepper({ product, compact = false }) {
  const { quantityOf, add, setQuantity, isPending } = useCart();
  const quantity = quantityOf(product.id);
  const busy = isPending(product.id);

  if (!product.inStock) {
    return <span className="stepper-disabled">{product.isAvailable === false ? 'Unavailable' : 'Out of stock'}</span>;
  }
  if (quantity === 0) {
    return (
      <button className={`add-button ${compact ? 'compact' : ''}`} onClick={() => add(product.id)} disabled={busy}>
        ADD
      </button>
    );
  }
  return (
    <div className={`stepper ${busy ? 'busy' : ''}`} role="group" aria-label={`Quantity of ${product.name}`}>
      <button onClick={() => setQuantity(product.id, quantity - 1)} disabled={busy} aria-label="Decrease quantity">
        −
      </button>
      <span aria-live="polite">{quantity}</span>
      <button
        onClick={() => setQuantity(product.id, quantity + 1)}
        disabled={busy || quantity >= Math.min(product.stock, 10)}
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  );
}
