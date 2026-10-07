import { Link } from 'react-router-dom';
import { discountPct, money } from '../utils/format';
import ProductVisual from './ProductVisual';
import QuantityStepper from './QuantityStepper';

export default function ProductCard({ product, footer }) {
  const off = discountPct(product.price, product.mrp);
  return (
    <article className={`product-card ${product.inStock ? '' : 'is-out'}`}>
      <Link to={`/products/${product.id}`} className="product-card-link">
        <div className="product-card-visual">
          <ProductVisual product={product} />
          {off > 0 && <span className="badge-off">{off}% OFF</span>}
          {product.inStock && product.stock <= 5 && <span className="badge-few">Only {product.stock} left</span>}
        </div>
        <span className="product-unit">{product.unit}</span>
        <h3 className="product-name">{product.name}</h3>
      </Link>
      {footer}
      <div className="product-card-bottom">
        <div className="price">
          <strong>{money(product.price)}</strong>
          {off > 0 && <s>{money(product.mrp)}</s>}
        </div>
        <QuantityStepper product={product} compact />
      </div>
    </article>
  );
}
