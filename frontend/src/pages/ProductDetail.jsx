import { Link, useParams } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import ProductVisual from '../components/ProductVisual';
import QuantityStepper from '../components/QuantityStepper';
import { EmptyState, Spinner } from '../components/Feedback';
import { discountPct, money } from '../utils/format';
import { useApi } from '../utils/useApi';

export default function ProductDetail() {
  const { id } = useParams();
  const { data, error, loading } = useApi(`/products/${id}`);

  if (loading && !data) return <Spinner />;
  if (error) {
    return (
      <EmptyState icon="🤷" title="Product not found" action={<Link to="/" className="button">Back to shop</Link>}>
        It may have been removed or is currently unavailable.
      </EmptyState>
    );
  }
  const { product, frequentlyBoughtTogether } = data;
  const off = discountPct(product.price, product.mrp);

  return (
    <div className="page">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link to="/">Home</Link> / <Link to={`/?category=${product.category.slug}`}>{product.category.name}</Link> /{' '}
        <span>{product.name}</span>
      </nav>
      <div className="product-detail">
        <ProductVisual product={product} size="lg" />
        <div className="product-info">
          <p className="muted">{product.brand}</p>
          <h1>{product.name}</h1>
          <p className="product-unit">{product.unit}</p>
          <div className="price large">
            <strong>{money(product.price)}</strong>
            {off > 0 && (
              <>
                <s>MRP {money(product.mrp)}</s>
                <span className="badge-off inline">{off}% OFF</span>
              </>
            )}
          </div>
          <p className="muted small">Inclusive of all taxes</p>
          <div className="product-actions">
            <QuantityStepper product={product} />
            {product.inStock && product.stock <= 10 && <span className="badge-few inline">Only {product.stock} left</span>}
          </div>
          <div className="product-promise">
            <span>⚡ Superfast delivery</span>
            <span>🔁 Easy returns</span>
            <span>✅ Quality checked</span>
          </div>
          {product.description && (
            <>
              <h2 className="h3">Product details</h2>
              <p>{product.description}</p>
            </>
          )}
          <p className="muted small">SKU {product.sku}</p>
        </div>
      </div>

      {frequentlyBoughtTogether.length > 0 && (
        <section>
          <div className="section-head">
            <h2>Frequently bought together</h2>
          </div>
          <div className="product-row">
            {frequentlyBoughtTogether.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
