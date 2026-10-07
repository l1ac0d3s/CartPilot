// Lightweight product imagery: the category emoji on a tinted tile (no image hosting needed).
const TINTS = ['#e8f5ec', '#fff4d6', '#e6f0fd', '#fde9ef', '#efeafd', '#e3f6f1', '#fdeee4', '#eef2e3'];

export default function ProductVisual({ product, size = 'md' }) {
  const icon = product.category?.icon || product.icon || '🛍️';
  const tint = TINTS[(product.category?.id || product.id || 0) % TINTS.length];
  if (product.imageUrl) {
    return <img className={`visual visual-${size}`} src={product.imageUrl} alt="" loading="lazy" />;
  }
  return (
    <div className={`visual visual-${size}`} style={{ '--tint': tint }} aria-hidden="true">
      <span>{icon}</span>
    </div>
  );
}
