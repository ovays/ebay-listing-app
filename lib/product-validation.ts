export type ProductValidationInput = {
  title?: string | null;
  price?: string | number | null;
  description?: string | null;
  images?: string[] | null;
  quantity?: number | null;
};

export type ProductValidationResult = {
  valid: boolean;
  messages: string[];
  missingTitle: boolean;
  invalidPrice: boolean;
  missingDescription: boolean;
  missingImages: boolean;
  invalidQuantity: boolean;
  brokenImages: boolean;
  duplicate: boolean;
};

function getNumericPrice(price: string | number | null | undefined) {
  if (typeof price === 'number') {
    return Number.isFinite(price) && price > 0 ? price : null;
  }

  if (typeof price === 'string') {
    const parsed = Number.parseFloat(price.replace(/[^0-9.]/g, ''));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  return null;
}

function getDuplicateKey(product: ProductValidationInput) {
  const title = product.title?.trim().toLowerCase().replace(/\s+/g, ' ');
  const price = getNumericPrice(product.price);

  if (!title || !price) {
    return null;
  }

  return `${title}:${price}`;
}

function hasInvalidImageUrl(images: string[]) {
  return images.some((image) => {
    if (!image.trim()) {
      return true;
    }

    try {
      const url = new URL(image);
      return url.protocol !== 'http:' && url.protocol !== 'https:';
    } catch {
      return true;
    }
  });
}

export function validateProduct(
  product: ProductValidationInput,
  products: ProductValidationInput[],
  index: number,
  brokenImageKeys: Set<string> = new Set()
): ProductValidationResult {
  const images = product.images ?? [];
  const duplicateKey = getDuplicateKey(product);
  const duplicate =
    duplicateKey !== null &&
    products.some(
      (candidate, candidateIndex) =>
        candidateIndex !== index && getDuplicateKey(candidate) === duplicateKey
    );
  const missingTitle = !product.title?.trim();
  const invalidPrice = getNumericPrice(product.price) === null;
  const missingDescription = !product.description?.trim();
  const missingImages = images.length === 0;
  const invalidQuantity =
    typeof product.quantity === 'number' && product.quantity < 1;
  const brokenImages =
    !missingImages &&
    (hasInvalidImageUrl(images) ||
      images.some((image, imageIndex) =>
        brokenImageKeys.has(`${index}:${imageIndex}:${image}`)
      ));
  const messages = [
    missingTitle ? 'Add a product title.' : null,
    invalidPrice ? 'Add a valid price greater than 0.' : null,
    missingDescription ? 'Add a product description.' : null,
    missingImages ? 'Add at least one product image.' : null,
    invalidQuantity ? 'Quantity must be at least 1.' : null,
    brokenImages ? 'Fix or replace broken image links.' : null,
    duplicate ? 'Review duplicate product title and price.' : null,
  ].filter((message): message is string => Boolean(message));

  return {
    valid: messages.length === 0,
    messages,
    missingTitle,
    invalidPrice,
    missingDescription,
    missingImages,
    invalidQuantity,
    brokenImages,
    duplicate,
  };
}

export function getProductValidationSummary(
  results: ProductValidationResult[]
) {
  return {
    valid: results.filter((result) => result.valid).length,
    invalid: results.filter((result) => !result.valid).length,
    missingTitle: results.filter((result) => result.missingTitle).length,
    invalidPrice: results.filter((result) => result.invalidPrice).length,
    missingDescription: results.filter((result) => result.missingDescription)
      .length,
    missingImages: results.filter((result) => result.missingImages).length,
    invalidQuantity: results.filter((result) => result.invalidQuantity).length,
    brokenImages: results.filter((result) => result.brokenImages).length,
    duplicates: results.filter((result) => result.duplicate).length,
  };
}
