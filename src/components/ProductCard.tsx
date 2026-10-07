import React, { useState, useRef } from 'react';
import { useStore, formatPrice } from '../context/StoreContext';
import { Sneaker } from '../types';
import { ShoppingBag, Heart, Star } from 'lucide-react';
import { motion } from 'motion/react';
import { getOptimizedImageUrl } from '../lib/cloudinary';
import Sneaker3DViewer, { preloadSneaker3DViewer } from './Sneaker3DViewer';

interface ProductCardProps {
  sneaker: Sneaker;
}

export const ProductCard: React.FC<ProductCardProps> = ({ sneaker }) => {
  const { addToCart, toggleWishlist, wishlist, openSneakerModal, setIsCartOpen } = useStore();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

  const isWishlisted = wishlist.includes(sneaker.id);
  const inStockSizes = sneaker.sizes.filter(s => s.stock > 0);
  const defaultSize = inStockSizes[0]?.size || sneaker.sizes[0]?.size || 9;
  const isSoldOut = inStockSizes.length === 0;

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSoldOut) return;
    addToCart(sneaker, defaultSize, 1);
    setIsCartOpen(true);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width  - 0.5; // -0.5 to 0.5
    const y = (e.clientY - rect.top)  / rect.height - 0.5;
    setTilt({ x: y * -10, y: x * 10 }); // rotateX from vertical, rotateY from horizontal
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setCurrentImageIndex(0);
    setTilt({ x: 0, y: 0 });
  };

  return (
    <div
      ref={cardRef}
      style={{ perspective: '800px' }}
      className="group"
    >
    <motion.div
      id={`product-card-${sneaker.id}`}
      animate={{
        rotateX: tilt.x,
        rotateY: tilt.y,
        y: isHovered ? -5 : 0,
        scale: isHovered ? 1.01 : 1,
      }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      onMouseEnter={() => {
        setIsHovered(true);
        void preloadSneaker3DViewer();
      }}
      onMouseLeave={handleMouseLeave}
      onMouseMove={handleMouseMove}
      onClick={() => openSneakerModal(sneaker)}
      style={{ transformStyle: 'preserve-3d' }}
      className={`product-card bg-[#1A1A1A] border rounded-2xl p-4 flex flex-col justify-between cursor-pointer transition-colors duration-300 relative shadow-xl ${
        isHovered
          ? 'border-[#FF7A00] bg-[#1E1E1E] shadow-[#FF7A00]/15 shadow-2xl'
          : 'border-[#282828] hover:border-[#FF7A00]/60'
      }`}
    >
      {/* Top badges & Wishlist */}
      <div className="flex items-center justify-between z-10">
        <div className="flex items-center gap-1.5">
          {sneaker.isNewRelease && (
            <span className="px-2 py-0.5 rounded-md bg-[#FF7A00] text-black text-[10px] font-bold uppercase tracking-wider font-sans">
              NEW
            </span>
          )}
          {sneaker.originalPrice && sneaker.originalPrice > sneaker.price && (
            <span className="px-2 py-0.5 rounded-md bg-[#252525] text-white border border-[#3A3A3A] text-[10px] font-bold uppercase tracking-wider font-mono">
              SALE
            </span>
          )}
          {(sneaker.tags || []).includes('Vault Grail') && (
            <span className="px-2 py-0.5 rounded-md bg-[#252525] text-[#FF7A00] border border-[#FF7A00]/40 text-[10px] font-bold uppercase tracking-wider font-mono">
              LIMITED
            </span>
          )}
        </div>

        {/* Wishlist toggle */}
        <button
          id={`wishlist-toggle-btn-${sneaker.id}`}
          onClick={(e) => {
            e.stopPropagation();
            toggleWishlist(sneaker.id);
          }}
          className={`p-2 rounded-full transition-all ${
            isWishlisted
              ? 'bg-[#FF7A00]/20 text-[#FF7A00]'
              : 'bg-[#111111]/70 text-[#888888] hover:text-white hover:bg-[#282828]'
          }`}
        >
          <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-[#FF7A00]' : ''}`} />
        </button>
      </div>

      {/* Floating Sneaker Image with 3D Hover perspective */}
      <div className="relative aspect-4/3 my-3 flex items-center justify-center overflow-hidden p-2">
        {isHovered ? (
          <Sneaker3DViewer
            compact
            modelUrl={sneaker.modelUrl}
            images={sneaker.images}
            fallbackImage={sneaker.image}
            name={sneaker.name}
            autoRotate
          />
        ) : null}
        <motion.img
          src={getOptimizedImageUrl(sneaker.images[currentImageIndex] || sneaker.images[0] || sneaker.image, { width: 600, quality: 'auto' })}
          alt={sneaker.name}
          referrerPolicy="no-referrer"
          animate={{
            rotate: isHovered ? -3 : 0,
            scale: isHovered ? 1.06 : 1
          }}
          transition={{ type: 'spring', stiffness: 220, damping: 15 }}
          className="w-full h-full object-contain filter drop-shadow-[0_15px_15px_rgba(0,0,0,0.8)] select-none"
          style={{ opacity: isHovered && sneaker.modelUrl ? 0 : 1, pointerEvents: isHovered && sneaker.modelUrl ? 'none' : 'auto' }}
        />

        {/* 360 view indicator on hover */}
        {sneaker.images.length > 1 && isHovered && (
          <div className="absolute bottom-1 inset-x-0 flex items-center justify-center gap-1.5">
            {sneaker.images.slice(0, 4).map((_, idx) => (
              <span
                key={idx}
                onMouseEnter={() => setCurrentImageIndex(idx)}
                className={`h-1.5 rounded-full transition-all cursor-pointer ${
                  currentImageIndex === idx ? 'w-5 bg-[#FF7A00]' : 'w-1.5 bg-[#444444]'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Product Metadata & Price Footer matching reference design */}
      <div className="space-y-2 pt-2 border-t border-[#262626]">
        {/* Brand & Rating */}
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-mono uppercase font-bold text-[#FF7A00]">
            {sneaker.brand}
          </span>

          <div className="flex items-center gap-1 text-[11px] text-[#888888]">
            <div className="flex text-[#FF7A00]">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={`w-3 h-3 ${i < Math.floor(sneaker.rating) ? 'fill-[#FF7A00]' : 'text-[#444444]'}`}
                />
              ))}
            </div>
            <span className="font-mono text-[10px]">({sneaker.reviewsCount})</span>
          </div>
        </div>

        {/* Model Name */}
        <h3 className="font-display font-bold text-sm text-white line-clamp-1 group-hover:text-[#FF7A00] transition-colors">
          {sneaker.name}
        </h3>

        {/* Price & Add to Cart button */}
        <div className="flex items-center justify-between pt-1">
          <div className="font-mono">
            <span className="text-base font-extrabold text-white">
              {formatPrice(sneaker.price)}
            </span>
            {sneaker.originalPrice && (
              <span className="text-xs text-[#666666] line-through ml-2">
                {formatPrice(sneaker.originalPrice)}
              </span>
            )}
          </div>

          <button
            id={`add-to-cart-btn-${sneaker.id}`}
            onClick={handleQuickAdd}
            disabled={isSoldOut}
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
              isSoldOut
                ? 'bg-[#252525] text-[#555555] cursor-not-allowed'
                : 'bg-[#FF7A00] hover:bg-[#E56E00] text-black shadow-md shadow-[#FF7A00]/30 hover:shadow-lg hover:shadow-[#FF7A00]/50 hover:scale-110 active:scale-95'
            }`}
            title={isSoldOut ? 'Sold Out' : 'Quick Add to Vault Cart'}
          >
            <ShoppingBag className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>
      </div>
    </motion.div>
    </div>
  );
};
