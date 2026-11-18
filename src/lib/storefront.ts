export type CartLine = {
  id: string;
  quantity: number;
};

export function getCartCount(lines: CartLine[]): number {
  return lines.reduce((count, line) => count + line.quantity, 0);
}

export function getCartTotal<T extends { id: string; price: number }>(
  lines: CartLine[],
  products: T[],
): number {
  return lines.reduce((total, line) => {
    const product = products.find((item) => item.id === line.id);
    return total + (product ? product.price * line.quantity : 0);
  }, 0);
}

export function changeCartQuantity(lines: CartLine[], id: string, change: number): CartLine[] {
  const currentQuantity = lines.find((line) => line.id === id)?.quantity ?? 0;
  const nextQuantity = currentQuantity + change;

  if (nextQuantity <= 0) return lines.filter((line) => line.id !== id);

  if (currentQuantity === 0) return [...lines, { id, quantity: nextQuantity }];

  return lines.map((line) => (line.id === id ? { ...line, quantity: nextQuantity } : line));
}