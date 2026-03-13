export function calculateDiscountedPrice(price: number, rate: number): number {
  return Math.max(0, Math.round(price * (1 - rate)));
}
