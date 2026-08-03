export function computePrices(e) {
  const calc = (raw, unit, area, existing) => {
    if (unit === 'per_sqm' && raw != null && area) return Math.round(raw * area);
    if (raw != null) return raw;
    return existing ?? null;
  };

  return {
    rent_price: calc(e.rent_price_raw, e.rent_price_unit, e.pricing_area_sqm, e.rent_price ?? null),
    sale_price: calc(e.sale_price_raw, e.sale_price_unit, e.pricing_area_sqm, e.sale_price ?? null),
  };
}
