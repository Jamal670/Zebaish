// Rejected CSS color keywords
const REJECTED_COLOR_KEYWORDS = new Set([
  'transparent',
  'inherit',
  'initial',
  'unset',
  'currentcolor',
]);

// Small explicit dictionary for common fashion/fabric colors not natively recognized by CSS
const FASHION_COLOR_MAP: Record<string, string> = {
  maroon: '#800000',
  mustard: '#FFDB58',
  mehndi: '#556B2F',
  mehendi: '#556B2F',
  peach: '#FFE5B4',
  'off white': '#FAF9F6',
  'off-white': '#FAF9F6',
  offwhite: '#FAF9F6',
  beige: '#F5F5DC',
  fawn: '#E5AA70',
  zinc: '#71717A',
  rust: '#B7410E',
  pista: '#93C572',
  pistachio: '#93C572',
  lilac: '#C8A2C8',
  lavender: '#E6E6FA',
  mauve: '#E0B0FF',
  plum: '#DDA0DD',
  burgundy: '#800020',
  teal: '#008080',
  coral: '#FF7F50',
  camel: '#C19A6B',
  copper: '#B87333',
  charcoal: '#36454F',
};

const HEX_COLOR_REGEX = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/**
 * Resolves a swatch color from a DB color_code or fashion/standard color_name.
 * Returns a valid CSS color string or null if unresolvable.
 */
export function resolveSwatchColor(
  colorCode?: string | null,
  colorName?: string | null
): string | null {
  // 1. Check color_code
  if (colorCode && typeof colorCode === 'string') {
    const trimmedCode = colorCode.trim();
    if (trimmedCode) {
      if (HEX_COLOR_REGEX.test(trimmedCode)) {
        return trimmedCode;
      }
      if (
        typeof CSS !== 'undefined' &&
        typeof CSS.supports === 'function' &&
        CSS.supports('color', trimmedCode)
      ) {
        const lowerCode = trimmedCode.toLowerCase();
        if (!REJECTED_COLOR_KEYWORDS.has(lowerCode)) {
          return trimmedCode;
        }
      }
    }
  }

  // 2. Check color_name
  if (!colorName || typeof colorName !== 'string') {
    return null;
  }

  const trimmedName = colorName.trim().toLowerCase();
  if (!trimmedName || REJECTED_COLOR_KEYWORDS.has(trimmedName)) {
    return null;
  }

  // Check fashion color map first for Pakistani / multi-word fashion names
  if (FASHION_COLOR_MAP[trimmedName]) {
    return FASHION_COLOR_MAP[trimmedName];
  }

  // Check if valid CSS named color (e.g. red, yellow, pink, navy)
  if (
    typeof CSS !== 'undefined' &&
    typeof CSS.supports === 'function' &&
    CSS.supports('color', trimmedName)
  ) {
    return trimmedName;
  }

  // Safe SSR fallback for common standard CSS colors
  const STANDARD_CSS_COLORS = new Set([
    'black', 'white', 'red', 'blue', 'green', 'yellow', 'purple', 'pink', 'orange', 'brown', 'gray', 'grey',
    'navy', 'cyan', 'magenta', 'silver', 'gold', 'olive', 'lime', 'aqua', 'violet', 'indigo', 'khaki', 'coral',
    'salmon', 'turquoise', 'tan', 'crimson', 'chocolate', 'beige', 'maroon', 'plum', 'teal'
  ]);
  if (STANDARD_CSS_COLORS.has(trimmedName)) {
    return trimmedName;
  }

  return null;
}

export interface CartLineKeyParams {
  productId?: string;
  size?: string | null;
  color?: { id?: string } | null;
}

/**
 * Generates a stable unique line-key for cart items:
 * `${productId}:${size ?? ''}:${color?.id ?? ''}`
 * Distinguishes different colors and sizes of the same product.
 */
export function getCartLineKey(
  item: CartLineKeyParams | { product?: { id?: string }; size?: string | null; color?: { id?: string } | null }
): string {
  const pId =
    'product' in item && item.product?.id
      ? item.product.id
      : (item as CartLineKeyParams).productId ?? '';
  const size = (item.size && item.size.trim()) || 'Unstitched';
  const colorId = item.color?.id ?? '';
  return `${pId}:${size}:${colorId}`;
}
