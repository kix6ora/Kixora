import React, { useEffect, useState } from 'react';
import { useStore, formatPrice } from '../context/StoreContext';
import { SEO } from './SEO';
import { 
  X, 
  ShoppingBag, 
  Heart, 
  ShieldCheck, 
  CheckCircle2, 
  ChevronLeft, 
  ChevronRight
} from 'lucide-react';
import { motion } from 'motion/react';
import { getOptimizedImageUrl } from '../lib/cloudinary';
import Sneaker3DViewer, { preloadSneaker3DViewer } from './Sneaker3DViewer';

export const ProductModal: React.FC = () => {
  const { 
    selectedSneaker, 
    closeSneakerModal, 
    addToCart, 
    toggleWishlist, 
    wishlist,
    setIsCartOpen 
  } = useStore();

  const [selectedSize, setSelectedSize] = useState<number | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomedSrc, setZoomedSrc] = useState('');

  const openZoom = (src: string) => {
    setZoomedSrc(src);
    setIsZoomed(true);
  };

  useEffect(() => {
    if (selectedSneaker) void preloadSneaker3DViewer();
  }, [selectedSneaker]);

  if (!selectedSneaker) return null;

  const isWishlisted = wishlist.includes(selectedSneaker.id);
  const inStockSizes = selectedSneaker.sizes.filter(s => s.stock > 0);
  const isSoldOut = inStockSizes.length === 0;

  const closeZoom = () => setIsZoomed(false);

  const sizeStockClass = (stock: number, isSelected: boolean, isOut: boolean) => {
    if (isOut) return 'bg-[#181818] text-[#444444] border border-[#222222] cursor-not-allowed line-through';
    if (isSelected) return 'bg-[#FF7A00] text-black font-extrabold border-2 border-[#FF7A00] shadow-md shadow-[#FF7A00]/30';
    if (stock <= 3) return 'bg-[#1C1C1C] text-[#F5A623] border border-[#F5A623]/60 hover:border-[#F5A623]';
    return 'bg-[#1C1C1C] text-[#DDDDDD] border border-[#2D2D2D] hover:border-[#10B981]/60 hover:bg-[#1e2e26]';
  };

  const sizeDotClass = (stock: number, isOut: boolean) => {
    if (isOut) return null;
    if (stock <= 3) return 'bg-[#F5A623]'; // amber
    return 'bg-[#10B981]'; // green
  };

  const handleSizeClick = (size: number, stock: number) => {
    if (stock > 0) {
      setSelectedSize(size);
    }
  };

  const handleAddToCart = () => {
    const sizeToUse = selectedSize || inStockSizes[0]?.size || selectedSneaker.sizes[0]?.size || 9;
    addToCart(selectedSneaker, sizeToUse, 1);
    closeSneakerModal();
    setIsCartOpen(true);
  };

  return (
    <div id="product-modal-backdrop" className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto">
      <SEO 
        title={selectedSneaker.name}
        description={selectedSneaker.description}
        image={selectedSneaker.image}
        type="product"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="relative w-full max-w-4xl bg-[#141414] border border-[#282828] rounded-3xl overflow-hidden shadow-2xl my-auto text-[#F5F5F5]"
      >
        {/* Close & Wishlist floating buttons */}
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
          <button
            onClick={() => toggleWishlist(selectedSneaker.id)}
            className={`p-2.5 rounded-full backdrop-blur-md transition-all ${
              isWishlisted
                ? 'bg-[#FF7A00]/20 text-[#FF7A00] border border-[#FF7A00]/40'
                : 'bg-[#222222]/80 text-[#888888] hover:text-white border border-[#333333]'
            }`}
          >
            <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-[#FF7A00]' : ''}`} />
          </button>

          <button
            id="close-product-modal-btn"
            onClick={closeSneakerModal}
            className="p-2.5 rounded-full bg-[#222222]/80 text-[#888888] hover:text-white border border-[#333333] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 max-h-[85vh] overflow-y-auto">
          {/* Left: 3D Angle Gallery Showcase */}
          <div className="lg:col-span-6 p-6 sm:p-8 bg-gradient-to-b from-[#181818] to-[#121212] flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-[#262626]">
            {/* Top badges */}
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-md bg-[#FF7A00] text-black text-xs font-bold uppercase tracking-wider font-sans">
                {selectedSneaker.brand}
              </span>
              <span className="px-2.5 py-1 rounded-md bg-[#222222] text-[#888888] text-xs font-mono border border-[#333333]">
                SKU: {selectedSneaker.sku}
              </span>
            </div>

            {/* Main Interactive Angle Preview — click to zoom */}
            <div className="relative aspect-4/3 my-6 flex items-center justify-center">
              {selectedSneaker.modelUrl ? (
                <Sneaker3DViewer
                  modelUrl={selectedSneaker.modelUrl}
                  images={selectedSneaker.images}
                  fallbackImage={selectedSneaker.image}
                  name={selectedSneaker.name}
                  autoRotate={false}
                  onImageChange={setActiveImageIndex}
                />
              ) : (
                <div className="absolute left-3 top-3 z-10 rounded bg-black/60 px-2 py-1 text-[10px] text-white/70">Turntable image preview · 3D asset needed</div>
              )}
              <motion.img
                key={activeImageIndex}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2 }}
                src={getOptimizedImageUrl(selectedSneaker.images[activeImageIndex] || selectedSneaker.images[0] || selectedSneaker.image, { width: 800, quality: 'auto' })}
                alt={selectedSneaker.name}
                referrerPolicy="no-referrer"
                onClick={() => openZoom(getOptimizedImageUrl(selectedSneaker.images[activeImageIndex] || selectedSneaker.images[0] || selectedSneaker.image, { width: 1400, quality: 'auto' }))}
                className="w-full h-full object-contain filter drop-shadow-[0_20px_25px_rgba(0,0,0,0.9)] cursor-zoom-in transition-transform duration-200 hover:scale-[1.03]"
                style={{ opacity: selectedSneaker.modelUrl ? 0 : 1, pointerEvents: selectedSneaker.modelUrl ? 'none' : 'auto' }}
              />

              {/* Prev / Next Angle Arrows */}
              {selectedSneaker.images.length > 1 && (
                <>
                  <button
                    onClick={() =>
                      setActiveImageIndex(
                        (activeImageIndex - 1 + selectedSneaker.images.length) % selectedSneaker.images.length
                      )
                    }
                    className="absolute left-1 p-2 rounded-full bg-[#1C1C1C]/80 text-[#888888] hover:text-white border border-[#2E2E2E]"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() =>
                      setActiveImageIndex((activeImageIndex + 1) % selectedSneaker.images.length)
                    }
                    className="absolute right-1 p-2 rounded-full bg-[#1C1C1C]/80 text-[#888888] hover:text-white border border-[#2E2E2E]"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>

            {/* Thumbnail Angle Strip */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-mono text-[#888888]">
                <span>Interactive 3D Perspectives</span>
                <span>{activeImageIndex + 1} of {selectedSneaker.images.length}</span>
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1">
                {selectedSneaker.images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImageIndex(idx)}
                    className={`w-14 h-14 rounded-xl p-1 bg-[#1A1A1A] border transition-all shrink-0 ${
                      activeImageIndex === idx
                        ? 'border-[#FF7A00] shadow-md shadow-[#FF7A00]/25'
                        : 'border-[#2C2C2C] opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img 
                      src={getOptimizedImageUrl(img, { width: 120, height: 120, quality: 'auto' })} 
                      alt="Thumb" 
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-contain" 
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Specifications, Size Picker, Price & Buy Button */}
          <div className="lg:col-span-6 p-6 sm:p-8 space-y-6 flex flex-col justify-between">
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 text-xs text-[#888888] mb-1">
                  <span>{selectedSneaker.category}</span>
                  <span>•</span>
                  <span>{selectedSneaker.gender}</span>
                  <span>•</span>
                  <span className="text-[#FF7A00] font-mono">★ {selectedSneaker.rating} ({selectedSneaker.reviewsCount} reviews)</span>
                </div>

                <h2 className="font-display font-black text-2xl sm:text-3xl text-white">
                  {selectedSneaker.name}
                </h2>
                
                <p className="text-xs text-[#888888] font-mono mt-1">
                  Colorway: {selectedSneaker.colorway}
                </p>
              </div>

              {/* Price */}
              <div className="flex items-baseline gap-3 pb-3 border-b border-[#262626]">
                <span className="font-mono text-3xl font-black text-white">
                  {formatPrice(selectedSneaker.price)}
                </span>
                {selectedSneaker.originalPrice && (
                  <span className="font-mono text-sm text-[#666666] line-through">
                    {formatPrice(selectedSneaker.originalPrice)}
                  </span>
                )}
                <span className="text-xs font-mono text-[#10B981] ml-auto font-semibold">
                  100% Deadstock Verified
                </span>
              </div>

              {/* Description */}
              <p className="text-xs text-[#AAAAAA] leading-relaxed">
                {selectedSneaker.description}
              </p>

              {/* Size Selector */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-[#888888] font-bold uppercase">Select Size (US Men)</span>
                  <span className="text-[#FF7A00]">
                    {selectedSize ? `US ${selectedSize} selected` : 'Select your size'}
                  </span>
                </div>

                {/* Stock legend */}
                <div className="flex items-center gap-3 text-[10px] font-mono text-[#666666] pb-1">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#10B981] inline-block" />In Stock</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#F5A623] inline-block" />Low Stock</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#444444] inline-block" />Sold Out</span>
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {selectedSneaker.sizes.map(sz => {
                    const isSelected = selectedSize === sz.size;
                    const isOut = sz.stock === 0;
                    const dotColor = sizeDotClass(sz.stock, isOut);

                    return (
                      <button
                        key={sz.size}
                        disabled={isOut}
                        aria-label={`US ${sz.size}${isOut ? ' – out of stock' : sz.stock <= 3 ? ` – only ${sz.stock} left` : ''}`}
                        onClick={() => handleSizeClick(sz.size, sz.stock)}
                        className={`py-2 rounded-lg font-mono text-xs font-bold transition-all relative ${sizeStockClass(sz.stock, isSelected, isOut)}`}
                      >
                        <span>US {sz.size}</span>
                        {dotColor && (
                          <span className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${dotColor}`} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 12-Point Authentication Checklist */}
              <div className="p-3.5 rounded-xl bg-[#181818] border border-[#282828] space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-white uppercase tracking-wider">
                  <ShieldCheck className="w-4 h-4 text-[#FF7A00]" />
                  <span>12-Point Authentication Verified</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-[10px] text-[#888888] font-mono">
                  <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-[#10B981]" /> UV Blacklight Check</span>
                  <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-[#10B981]" /> Box Label Match</span>
                  <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-[#10B981]" /> Stitch Tension Verified</span>
                  <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-[#10B981]" /> Encrypted NFC Tag</span>
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="pt-4 border-t border-[#262626] flex items-center gap-3">
              <button
                id="modal-add-to-cart-btn"
                onClick={handleAddToCart}
                disabled={isSoldOut}
                className={`flex-1 py-4 rounded-xl font-extrabold text-xs sm:text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                  isSoldOut
                    ? 'bg-[#222222] text-[#666666] cursor-not-allowed'
                    : 'bg-[#FF7A00] hover:bg-[#E56E00] text-black shadow-lg shadow-[#FF7A00]/25'
                }`}
              >
                <ShoppingBag className="w-4 h-4 stroke-[2.5]" />
                <span>
                  {isSoldOut ? 'Sold Out in Vault' : `Add to Vault Cart • ${formatPrice(selectedSneaker.price)}`}
                </span>
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Image zoom lightbox */}
      {isZoomed && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 backdrop-blur-sm cursor-zoom-out"
          onClick={closeZoom}
          onKeyDown={(e) => e.key === 'Escape' && closeZoom()}
          role="dialog"
          aria-label="Zoomed product image"
        >
          <img
            src={zoomedSrc}
            alt={selectedSneaker.name}
            referrerPolicy="no-referrer"
            className="max-w-[90vw] max-h-[90vh] object-contain drop-shadow-[0_30px_60px_rgba(0,0,0,1)] select-none"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            className="absolute top-4 right-4 p-2.5 rounded-full bg-[#222222]/90 text-[#888888] hover:text-white border border-[#333333] transition-colors"
            onClick={closeZoom}
            aria-label="Close zoom"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="absolute bottom-6 text-[11px] font-mono text-[#555555] tracking-wider">
            Click anywhere or press ESC to close
          </div>
        </div>
      )}
    </div>
  );
};
