export function computePrices(e) {
  const calc = (raw, unit, area) =>
    raw == null ? null
    : unit === 'per_sqm' && area ? Math.round(raw * area)
    : raw;

  return {
    rent_price: calc(e.rent_price_raw, e.rent_price_unit, e.pricing_area_sqm),
    sale_price: calc(e.sale_price_raw, e.sale_price_unit, e.pricing_area_sqm),
  };
}
