import { describe, expect, it } from "vitest";

import { changeCartQuantity, getCartCount, getCartTotal } from "@/lib/storefront";

const products = [
  { id: "kopi-susu", price: 18000 },
  { id: "croissant", price: 12000 },
];

describe("storefront cart", () => {
  it("adds product quantities and removes a line when its quantity reaches zero", () => {
    const cart = changeCartQuantity(changeCartQuantity([], "kopi-susu", 1), "kopi-susu", 1);

    expect(cart).toEqual([{ id: "kopi-susu", quantity: 2 }]);
    expect(changeCartQuantity(cart, "kopi-susu", -2)).toEqual([]);
  });

  it("counts items and calculates their exact rupiah subtotal", () => {
    const cart = [
      { id: "kopi-susu", quantity: 2 },
      { id: "croissant", quantity: 1 },
    ];

    expect(getCartCount(cart)).toBe(3);
    expect(getCartTotal(cart, products)).toBe(48000);
  });
});