import { describe, expect, it } from 'vitest';
import { mapProductRowToSneaker } from '../../src/repositories/customer/productMapper';

describe('mapProductRowToSneaker', () => {
  it('maps a configured product model URL and leaves it unset when absent', () => {
    const baseRow = {
      id: 'product-1',
      name: 'Test sneaker',
      price: 100,
      product_images: [{ image_url: 'https://images.example.test/sneaker.png' }],
    };

    expect(mapProductRowToSneaker({
      ...baseRow,
      model_url: 'https://models.example.test/sneaker.glb',
    }).modelUrl).toBe('https://models.example.test/sneaker.glb');
    expect(mapProductRowToSneaker(baseRow).modelUrl).toBeUndefined();
  });
});
