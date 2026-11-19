window.APP_CONFIG = {
  "slug": "discount-stack-calculator",
  "title": "Discount Stack Calculator",
  "brand": "discount stack calculator.",
  "category": "Kitchen & household",
  "tagline": "Estimate a final price after percentage discount, coupon, and tax.",
  "description": "Estimate a final price after percentage discount, coupon, and tax.",
  "mode": "calculator",
  "kind": "discount",
  "fields": [
    {
      "name": "originalPrice",
      "label": "Original price",
      "required": true,
      "type": "number"
    },
    {
      "name": "discountPercent",
      "label": "Discount (%)",
      "required": true,
      "type": "number"
    },
    {
      "name": "couponAmount",
      "label": "Coupon amount",
      "required": true,
      "type": "number"
    },
    {
      "name": "taxPercent",
      "label": "Tax (%)",
      "required": true,
      "type": "number"
    }
  ],
  "dateField": "",
  "timerField": "",
  "titleField": "originalPrice",
  "scope": "A simple estimate; merchant rules, fees, and local tax treatment may differ.",
  "emptyText": "No entries yet. Add one above to get started."
};
