import { NextResponse } from 'next/server';
import { request as undiciRequest } from 'undici';
import { requireEbayAuth } from '@/lib/ebay/auth';
import { supabase } from '@/lib/supabase';

const EBAY_API_BASE = {
  sandbox: 'https://api.sandbox.ebay.com',
  production: 'https://api.ebay.com',
} as const;

const EBAY_AU_MARKETPLACE_ID = 'EBAY_AU';
const EBAY_AU_CONTENT_LANGUAGE = 'en-AU';
const EBAY_AU_COUNTRY = 'AU';
const EBAY_AU_CURRENCY = 'AUD';
const EBAY_AU_MERCHANT_LOCATION_KEY =
  process.env.EBAY_AU_MERCHANT_LOCATION_KEY?.trim() || 'AU_DEFAULT_LOCATION';
const EBAY_AU_LOCATION_POSTAL_CODE =
  process.env.EBAY_AU_LOCATION_POSTAL_CODE?.trim() || '2000';
const EBAY_DEFAULT_RETURN_POLICY_ID =
  process.env.EBAY_DEFAULT_RETURN_POLICY_ID?.trim() || '';
const EBAY_DEFAULT_FULFILLMENT_POLICY_ID =
  process.env.EBAY_DEFAULT_FULFILLMENT_POLICY_ID?.trim() || '';
const EBAY_DEFAULT_PAYMENT_POLICY_ID =
  process.env.EBAY_DEFAULT_PAYMENT_POLICY_ID?.trim() || '';
const EBAY_INVENTORY_HEADER_NAMES = [
  'Authorization',
  'Content-Type',
  'Content-Language',
  'X-EBAY-C-MARKETPLACE-ID',
] as const;

type EbayInventoryHeaderName = (typeof EBAY_INVENTORY_HEADER_NAMES)[number];
type EbayInventoryHeaders = Partial<Record<EbayInventoryHeaderName, string>> & {
  Authorization: string;
};

type EbayOffer = {
  offerId?: string;
  sku?: string;
  status?: string;
  listing?: {
    listingId?: string;
    listingStatus?: string;
  };
};

type ReconciliationResult = {
  reliable: boolean;
  inventoryExists: boolean;
  offerExists: boolean;
  offerId: string | null;
  offerStatus: string | null;
  itemId: string | null;
  listingStatus: string | null;
  source: string;
};

type PublishProduct = {
  id?: string | number;
  title?: string;
  brand?: string;
  categoryName?: string;
  categoryId?: string | null;
  categoryPath?: string | null;
  ebayCategoryId?: string | null;
  ebayCategoryBreadcrumb?: string | null;
  price?: string | number;
  quantity?: number;
  description?: string;
  images?: string[];
  fulfillmentPolicyId?: string;
  paymentPolicyId?: string;
  returnPolicyId?: string;
  publish_status?: string;
  ebay_inventory_item_id?: string;
  ebay_offer_id?: string;
  ebay_item_id?: string;
};

type ListingPolicies = {
  fulfillment: string;
  payment: string;
  return: string;
};

type PublishRequestBody = {
  product?: PublishProduct;
  fulfillmentPolicyId?: string;
  paymentPolicyId?: string;
  returnPolicyId?: string;
  recover?: boolean;
  policies?: Partial<ListingPolicies>;
};

function getPolicyId(...values: Array<string | undefined>) {
  return values.find((value) => value?.trim())?.trim() || '';
}

function logEbayPayload(step: string, payload: Record<string, unknown> | null) {
  console.info('[eBay Publish] Final outgoing eBay Inventory payload', {
    step,
    payload,
  });
}

function logEbayInventoryHeaders(step: string, headers: EbayInventoryHeaders) {
  const safeHeaders = { ...headers };

  if (safeHeaders.Authorization) {
    safeHeaders.Authorization = 'Bearer [redacted]';
  }

  console.info('[eBay Publish] Final outgoing eBay Inventory headers', {
    step,
    headers: safeHeaders,
  });
}

function formatDescription(product: PublishProduct) {
  return `
    <h2>${product.title}</h2>
    <p>${product.description}</p>
    <h3>Key Features:</h3>
    <ul>
      <li>HEMA/TPO Free Formula</li>
      <li>No heat spike curing</li>
      <li>Strong builder gel</li>
      <li>Suitable for extensions & overlays</li>
      <li>Long-lasting & vegan friendly</li>
    </ul>
    <h3>Usage:</h3>
    <p>Apply on prepped nails or forms, cure under UV/LED lamp.</p>
  `;
}

function getEbayInventoryHeaders({
  accessToken,
  contentLanguage,
  contentType,
  marketplaceId,
}: {
  accessToken: string;
  contentLanguage?: boolean;
  contentType?: boolean;
  marketplaceId?: boolean;
}): EbayInventoryHeaders {
  const headers: EbayInventoryHeaders = {
    Authorization: `Bearer ${accessToken}`,
  };

  if (contentType) {
    headers['Content-Type'] = 'application/json';
  }

  if (contentLanguage) {
    headers['Content-Language'] = EBAY_AU_CONTENT_LANGUAGE;
  }

  if (marketplaceId) {
    headers['X-EBAY-C-MARKETPLACE-ID'] = EBAY_AU_MARKETPLACE_ID;
  }

  return headers;
}

function sanitizeEbayInventoryHeaders(
  headers: EbayInventoryHeaders
): EbayInventoryHeaders {
  const sanitizedHeaders: EbayInventoryHeaders = {
    Authorization: headers.Authorization,
  };

  for (const headerName of EBAY_INVENTORY_HEADER_NAMES) {
    const value = headers[headerName];

    if (value) {
      sanitizedHeaders[headerName] = value;
    }
  }

  return sanitizedHeaders;
}

async function fetchEbayInventory(
  url: string,
  {
    body,
    headers,
    method = 'GET',
    step,
  }: {
    body?: string;
    headers: EbayInventoryHeaders;
    method?: 'GET' | 'POST' | 'PUT';
    step: string;
  }
) {
  const finalHeaders = sanitizeEbayInventoryHeaders(headers);
  logEbayInventoryHeaders(step, finalHeaders);

  /*
   * Node's fetch/undici fetch layer injects `accept-language: *` when the
   * caller omits Accept-Language. eBay Inventory rejects that value, while
   * undici.request sends only the headers provided here.
   */
  const response = await undiciRequest(url, {
    body,
    headers: finalHeaders,
    method,
  });
  const responseBody = await response.body.text();
  const emptyBodyStatus = [101, 204, 205, 304].includes(response.statusCode);

  return new Response(emptyBodyStatus ? null : responseBody, {
    status: response.statusCode,
  });
}

function getInventoryItemPayload(
  product: PublishProduct,
  cleanedImages: string[]
) {
  const quantity = getProductQuantity(product.quantity);
  const aspects: Record<string, string[]> = {
    Brand: ['Unbranded'],
    Type: ['Builder Gel'],
    Shade: [product.title?.includes('ROSE GOLD') ? 'Rose Gold' : 'Clear'],
  };

  console.log('Final aspects:', aspects);
  console.info('[eBay Publish] Inventory item aspects', { aspects });

  return {
    product: {
      title: product.title?.trim(),
      description: product.description,
      imageUrls: cleanedImages,
      aspects,
    },
    availability: {
      shipToLocationAvailability: {
        quantity,
        availabilityDistributions: [
          {
            merchantLocationKey: EBAY_AU_MERCHANT_LOCATION_KEY,
            quantity,
          },
        ],
      },
    },
    condition: 'NEW',
  };
}

function getOfferPayload({
  categoryId,
  includeCreateOnlyFields,
  policies,
  price,
  product,
  sku,
}: {
  categoryId: string;
  includeCreateOnlyFields: boolean;
  policies: ListingPolicies;
  price: number;
  product: PublishProduct;
  sku: string;
}) {
  const listingPolicies = {
    fulfillmentPolicyId: policies.fulfillment?.trim(),
    paymentPolicyId: policies.payment?.trim(),
    returnPolicyId: policies.return?.trim(),
  };
  const productMetadata = product as PublishProduct & Record<string, unknown>;
  const rawReturnsAccepted =
    productMetadata.returnsAccepted ??
    productMetadata.returnPolicyReturnsAccepted ??
    productMetadata.return_policy_returns_accepted;
  const returnPolicyName = String(
    productMetadata.returnPolicyName ??
      productMetadata.return_policy_name ??
      ''
  ).toLowerCase();
  const noReturnsPolicyIds = new Set(
    (process.env.EBAY_NO_RETURNS_RETURN_POLICY_IDS ?? '')
      .split(',')
      .map((policyId) => policyId.trim())
      .filter(Boolean)
  );
  const isNoReturnsPolicy =
    rawReturnsAccepted === false ||
    noReturnsPolicyIds.has(listingPolicies.returnPolicyId ?? '') ||
    /\bno\s+returns?\b/.test(returnPolicyName) ||
    /\breturns?\s+not\s+accepted\b/.test(returnPolicyName);
  const returnPolicySupportsReturns =
    rawReturnsAccepted !== false && !isNoReturnsPolicy;
  const includeReturnTerms =
    !listingPolicies.returnPolicyId &&
    EBAY_AU_MARKETPLACE_ID === 'EBAY_AU' &&
    returnPolicySupportsReturns;
  const quantity = getProductQuantity(product.quantity);

  if (
    !listingPolicies.fulfillmentPolicyId ||
    !listingPolicies.paymentPolicyId ||
    !listingPolicies.returnPolicyId
  ) {
    throw new Error('eBay offer payload requires non-empty listing policy IDs.');
  }

  const payload = {
    availableQuantity: quantity,
    categoryId,
    country: EBAY_AU_COUNTRY,
    marketplaceId: EBAY_AU_MARKETPLACE_ID,
    merchantLocationKey: EBAY_AU_MERCHANT_LOCATION_KEY,

    listingDescription: formatDescription(product),

    pricingSummary: {
      price: {
        value: price,
        currency: EBAY_AU_CURRENCY,
      },
    },

    listingPolicies,
  };

  const finalPayload = includeReturnTerms
    ? {
        ...payload,
        returnTerms: {
          returnsAccepted: true,
          returnPeriod: {
            value: 30,
            unit: 'DAY',
          },
          refundMethod: 'MONEY_BACK',
          returnShippingCostPayer: 'BUYER',
        },
      }
    : payload;
  const outgoingPayload = includeCreateOnlyFields
    ? {
        sku,
        format: 'FIXED_PRICE',
        ...finalPayload,
      }
    : finalPayload;

  console.info('[eBay Publish] Final offer listing policies', {
    listingPolicies,
    marketplaceId: EBAY_AU_MARKETPLACE_ID,
  });
  console.info('[eBay Publish] Final offer return terms decision', {
    included: includeReturnTerms,
    hasReturnPolicyId: Boolean(listingPolicies.returnPolicyId),
    isNoReturnsPolicy,
    returnPolicySupportsReturns,
  });
  console.info('[eBay Publish] Final sanitized offer payload', {
    payload: outgoingPayload,
  });

  return outgoingPayload;
}

function getInventoryLocationPayload() {
  return {
    location: {
      address: {
        postalCode: EBAY_AU_LOCATION_POSTAL_CODE,
        country: EBAY_AU_COUNTRY,
      },
    },
    name: EBAY_AU_MERCHANT_LOCATION_KEY,
    merchantLocationStatus: 'ENABLED',
    locationTypes: ['WAREHOUSE'],
  };
}

function getEbayErrorMessage(response: unknown) {
  if (!response || typeof response !== 'object') {
    return null;
  }

  const data = response as Record<string, unknown>;
  const errors = data.errors;

  if (Array.isArray(errors)) {
    const firstError = errors[0];

    if (firstError && typeof firstError === 'object') {
      const message = (firstError as Record<string, unknown>).message;

      if (typeof message === 'string' && message.trim()) {
        return message;
      }
    }
  }

  const message = data.message;

  if (typeof message === 'string' && message.trim()) {
    return message;
  }

  return null;
}

function getValidImageUrls(images: unknown) {
  if (!Array.isArray(images) || images.length === 0) {
    return {
      urls: [],
      error: 'At least one product image is required before publishing.',
    };
  }

  const urls: string[] = [];

  for (const image of images) {
    if (typeof image !== 'string' || !image.trim()) {
      return {
        urls: [],
        error: 'Product image URLs must be valid links.',
      };
    }

    try {
      const parsed = new URL(image);

      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return {
          urls: [],
          error: 'Product image URLs must start with http:// or https://.',
        };
      }
    } catch {
      return {
        urls: [],
        error: 'Product image URLs must be valid links.',
      };
    }

    urls.push(image);
  }

  return { urls, error: null };
}

function getNumericPrice(price: string | number | undefined) {
  if (typeof price === 'number') {
    return Number.isFinite(price) && price > 0 ? price : null;
  }

  if (typeof price === 'string') {
    const parsed = Number.parseFloat(price.replace(/[^0-9.]/g, ''));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  return null;
}

function getProductQuantity(quantity: number | undefined) {
  return typeof quantity === 'number' && Number.isFinite(quantity) && quantity > 0
    ? quantity
    : 1;
}

async function getEbayJson(
  url: string,
  accessToken: string,
  context: Record<string, unknown>
) {
  const headers = getEbayInventoryHeaders({ accessToken });

  try {
    const res = await fetchEbayInventory(url, {
      headers,
      step: String(context.step ?? 'reconciliation'),
    });
    const data = (await res.json().catch(() => null)) as unknown;

    return {
      ok: res.ok,
      status: res.status,
      data,
    };
  } catch (error) {
    console.error('[eBay Publish] Reconciliation request failed', {
      ...context,
      error,
    });

    return {
      ok: false,
      status: 0,
      data: null,
    };
  }
}

async function ensureEbayAuInventoryLocation(
  ebayBase: string,
  accessToken: string
) {
  const locationUrl = `${ebayBase}/sell/inventory/v1/location/${encodeURIComponent(
    EBAY_AU_MERCHANT_LOCATION_KEY
  )}`;
  const existingLocation = await getEbayJson(locationUrl, accessToken, {
    step: 'inventory_location',
    merchantLocationKey: EBAY_AU_MERCHANT_LOCATION_KEY,
  });

  if (existingLocation.ok) {
    console.info('[eBay Publish] AU inventory location already exists', {
      merchantLocationKey: EBAY_AU_MERCHANT_LOCATION_KEY,
      country: EBAY_AU_COUNTRY,
    });

    return { ok: true, status: existingLocation.status, error: null };
  }

  const locationPayload = getInventoryLocationPayload();
  const locationHeaders = getEbayInventoryHeaders({
    accessToken,
    contentLanguage: true,
    contentType: true,
    marketplaceId: true,
  });

  logEbayPayload('inventory_location_create', locationPayload);

  try {
    const locationRes = await fetchEbayInventory(locationUrl, {
      method: 'POST',
      headers: locationHeaders,
      step: 'inventory_location_create',
      body: JSON.stringify(locationPayload),
    });

    if (locationRes.ok || locationRes.status === 409) {
      console.info('[eBay Publish] AU inventory location ready', {
        merchantLocationKey: EBAY_AU_MERCHANT_LOCATION_KEY,
        country: EBAY_AU_COUNTRY,
        status: locationRes.status,
      });

      return { ok: true, status: locationRes.status, error: null };
    }

    return {
      ok: false,
      status: locationRes.status,
      error: await locationRes.text(),
    };
  } catch (error) {
    console.error('[eBay Publish] Inventory location request failed', {
      error,
      merchantLocationKey: EBAY_AU_MERCHANT_LOCATION_KEY,
      country: EBAY_AU_COUNTRY,
    });

    return {
      ok: false,
      status: 0,
      error,
    };
  }
}

function getListingFromOffer(offer: EbayOffer | null | undefined) {
  return {
    itemId: offer?.listing?.listingId ?? null,
    listingStatus: offer?.listing?.listingStatus ?? null,
    isPublished: offer?.status === 'PUBLISHED' || Boolean(offer?.listing?.listingId),
  };
}

async function reconcileInventoryItem(
  ebayBase: string,
  accessToken: string,
  sku: string
) {
  const result = await getEbayJson(
    `${ebayBase}/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`,
    accessToken,
    {
      step: 'inventory_item',
      sku,
    }
  );
  const exists = result.ok;

  console.info('[eBay Publish] Inventory reconciliation decision', {
    sku,
    exists,
    status: result.status,
  });

  return {
    exists,
    reliable: result.status !== 0,
  };
}

async function reconcileOffer(
  ebayBase: string,
  accessToken: string,
  offerId: string
) {
  const result = await getEbayJson(
    `${ebayBase}/sell/inventory/v1/offer/${encodeURIComponent(offerId)}`,
    accessToken,
    {
      step: 'offer_by_id',
      offerId,
    }
  );

  if (!result.ok || !result.data || typeof result.data !== 'object') {
    console.info('[eBay Publish] Offer reconciliation by ID decision', {
      offerId,
      exists: false,
      status: result.status,
    });

    return {
      offer: null,
      reliable: result.status !== 0,
    };
  }

  const offer = result.data as EbayOffer;
  const listing = getListingFromOffer(offer);

  console.info('[eBay Publish] Offer reconciliation by ID decision', {
    offerId,
    exists: true,
    offerStatus: offer.status,
    itemId: listing.itemId,
    listingStatus: listing.listingStatus,
  });

  return {
    offer,
    reliable: true,
  };
}

async function reconcileOfferBySku(
  ebayBase: string,
  accessToken: string,
  sku: string
) {
  const result = await getEbayJson(
    `${ebayBase}/sell/inventory/v1/offer?sku=${encodeURIComponent(sku)}`,
    accessToken,
    {
      step: 'offer_by_sku',
      sku,
    }
  );

  if (!result.ok || !result.data || typeof result.data !== 'object') {
    console.info('[eBay Publish] Offer reconciliation by SKU decision', {
      sku,
      found: false,
      status: result.status,
    });

    return {
      offer: null,
      reliable: result.status !== 0,
    };
  }

  const offers = (result.data as { offers?: EbayOffer[] }).offers ?? [];
  const offer =
    offers.find((candidate) => candidate.status === 'PUBLISHED') ??
    offers.find((candidate) => candidate.offerId) ??
    null;
  const listing = getListingFromOffer(offer);

  console.info('[eBay Publish] Offer reconciliation by SKU decision', {
    sku,
    found: Boolean(offer),
    offerCount: offers.length,
    offerId: offer?.offerId,
    offerStatus: offer?.status,
    itemId: listing.itemId,
    listingStatus: listing.listingStatus,
  });

  return {
    offer,
    reliable: true,
  };
}

async function reconcilePublishedListing(offer: EbayOffer | null) {
  const listing = getListingFromOffer(offer);

  console.info('[eBay Publish] Published listing reconciliation decision', {
    offerId: offer?.offerId,
    offerStatus: offer?.status,
    itemId: listing.itemId,
    listingStatus: listing.listingStatus,
    isPublished: listing.isPublished,
  });

  return listing;
}

async function reconcileEbayPublishState({
  ebayBase,
  accessToken,
  sku,
  offerId,
}: {
  ebayBase: string;
  accessToken: string;
  sku: string;
  offerId?: string | null;
}): Promise<ReconciliationResult> {
  const inventory = await reconcileInventoryItem(
    ebayBase,
    accessToken,
    sku
  );
  const offerByIdResult = offerId
    ? await reconcileOffer(ebayBase, accessToken, offerId)
    : null;
  const offerBySkuResult = offerByIdResult?.offer
    ? null
    : await reconcileOfferBySku(ebayBase, accessToken, sku);
  const offer = offerByIdResult?.offer ?? offerBySkuResult?.offer ?? null;
  const listing = await reconcilePublishedListing(offer);

  return {
    reliable:
      inventory.reliable &&
      (offerByIdResult?.reliable ?? true) &&
      (offerBySkuResult?.reliable ?? true),
    inventoryExists: inventory.exists,
    offerExists: Boolean(offer?.offerId),
    offerId: offer?.offerId ?? null,
    offerStatus: offer?.status ?? null,
    itemId: listing.itemId,
    listingStatus: listing.listingStatus,
    source: offerByIdResult?.offer ? 'stored_offer_id' : offer ? 'sku_lookup' : 'none',
  };
}

async function updatePublishState(
  productId: string | number | undefined,
  values: Record<string, unknown>
) {
  if (!productId) {
    return;
  }

  const { error } = await supabase
    .from('products')
    .update(values)
    .eq('id', productId);

  if (error) {
    console.error('[eBay Publish] Failed to update product publish state', {
      productId,
      error,
    });
  }
}

async function claimPublishState(
  productId: string | number,
  expectedStatus: string | null | undefined,
  values: Record<string, unknown>
) {
  let query = supabase.from('products').update(values).eq('id', productId);

  if (expectedStatus) {
    query = query.eq('publish_status', expectedStatus);
  } else {
    query = query.is('publish_status', null);
  }

  const { data, error } = await query.select('id').maybeSingle();

  if (error) {
    console.error('[eBay Publish] Failed to claim product publish state', {
      productId,
      expectedStatus,
      error,
    });

    return false;
  }

  return Boolean(data);
}

export async function POST(req: Request) {
  const auth = await requireEbayAuth();

  if (!auth) {
    console.warn(
      '[eBay Publish] Publish rejected because user is not authenticated'
    );

    return NextResponse.json(
      { success: false, error: 'Connect eBay before publishing.' },
      { status: 401 }
    );
  }

  let body: PublishRequestBody;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Publish request was invalid. Try again.' },
      { status: 400 }
    );
  }

  const {
    product,
    fulfillmentPolicyId,
    paymentPolicyId,
    returnPolicyId,
    recover,
    policies,
  } = body;

  if (!product) {
    return NextResponse.json(
      { success: false, error: 'Choose a product before publishing.' },
      { status: 400 }
    );
  }

  let existingProduct:
    | {
        categoryName?: string | null;
        categoryId?: string | null;
        categoryPath?: string | null;
        ebayCategoryId?: string | null;
        ebayCategoryBreadcrumb?: string | null;
        publish_status?: string | null;
        ebay_inventory_item_id?: string | null;
        ebay_offer_id?: string | null;
        ebay_item_id?: string | null;
      }
    | null = null;

  if (!product.id) {
    return NextResponse.json(
      {
        success: false,
        error: 'Save the product before publishing it to eBay.',
      },
      { status: 400 }
    );
  }

  {
    const { data, error: existingProductError } = await supabase
      .from('products')
      .select(
        'categoryName, categoryId, categoryPath, ebayCategoryId, ebayCategoryBreadcrumb, publish_status, ebay_inventory_item_id, ebay_offer_id, ebay_item_id'
      )
      .eq('id', product.id)
      .maybeSingle();

    existingProduct = data;

    if (existingProductError) {
      console.error('[eBay Publish] Failed to read product publish state', {
        productId: product.id,
        error: existingProductError,
      });
    }

    if (!existingProduct) {
      return NextResponse.json(
        {
          success: false,
          error: 'Product could not be found. Refresh products and try again.',
        },
        { status: 404 }
      );
    }

    if (existingProduct?.publish_status === 'publishing' && !recover) {
      return NextResponse.json(
        {
          success: false,
          error:
            'This product is already publishing. Wait for it to finish before trying again.',
        },
        { status: 409 }
      );
    }

    if (existingProduct?.publish_status === 'publishing' && recover) {
      console.warn('[eBay Publish] Recovering product stuck in publishing state', {
        productId: product.id,
        inventoryItemId: existingProduct.ebay_inventory_item_id,
        offerId: existingProduct.ebay_offer_id,
      });
    }

    product.categoryName = existingProduct.categoryName ?? product.categoryName;
    product.categoryId = existingProduct.categoryId ?? product.categoryId;
    product.categoryPath = existingProduct.categoryPath ?? product.categoryPath;
    product.ebayCategoryId =
      existingProduct.ebayCategoryId ?? product.ebayCategoryId;
    product.ebayCategoryBreadcrumb =
      existingProduct.ebayCategoryBreadcrumb ?? product.ebayCategoryBreadcrumb;
  }

  if (!product.title?.trim() || !product.price) {
    return NextResponse.json(
      {
        success: false,
        error: 'Product title and price are required before publishing.',
      },
      { status: 400 }
    );
  }

  if (!product.description?.trim()) {
    return NextResponse.json(
      {
        success: false,
        error: 'Product description is required before publishing.',
      },
      { status: 400 }
    );
  }

  const price = getNumericPrice(product.price);

  if (!price) {
    return NextResponse.json(
      {
        success: false,
        error: 'Product price must be a number greater than 0.',
      },
      { status: 400 }
    );
  }

  const imageValidation = getValidImageUrls(product.images);

  if (imageValidation.error) {
    return NextResponse.json(
      { success: false, error: imageValidation.error },
      { status: 400 }
    );
  }

  const selectedEbayCategoryId =
    product.categoryId?.trim() || product.ebayCategoryId?.trim();

  if (!selectedEbayCategoryId) {
    return NextResponse.json(
      {
        success: false,
        error: 'Select an eBay leaf category before publishing.',
      },
      { status: 400 }
    );
  }

  const imageUrls = imageValidation.urls;
  const cleanedImages = (imageUrls || [])
    .filter((url) => typeof url === "string")
    .map((url) => url.trim())
    .filter((url) => url.startsWith("http"))
    .filter((url) => !url.includes("placeholder"))
    .slice(0, 10);

  console.log("Cleaned images:", cleanedImages);

  if (!cleanedImages.length) {
    throw new Error("No valid images for eBay listing");
  }

  const selectedFulfillmentPolicyId = getPolicyId(
    fulfillmentPolicyId,
    product.fulfillmentPolicyId,
    policies?.fulfillment,
    EBAY_DEFAULT_FULFILLMENT_POLICY_ID
  );
  const selectedPaymentPolicyId = getPolicyId(
    paymentPolicyId,
    product.paymentPolicyId,
    policies?.payment,
    EBAY_DEFAULT_PAYMENT_POLICY_ID
  );
  const selectedReturnPolicyId = getPolicyId(
    returnPolicyId,
    product.returnPolicyId,
    policies?.return,
    EBAY_DEFAULT_RETURN_POLICY_ID
  );

  if (
    !selectedFulfillmentPolicyId ||
    !selectedPaymentPolicyId ||
    !selectedReturnPolicyId
  ) {
    return NextResponse.json(
      {
        success: false,
        error: 'eBay listing policies are missing. Try publishing again.',
      },
      { status: 400 }
    );
  }

  const { tokenSet, sessionId } = auth;
  const ebayBase = EBAY_API_BASE[tokenSet.environment];

  const storedInventoryItemId =
    existingProduct?.ebay_inventory_item_id ?? product.ebay_inventory_item_id;
  const storedOfferId = existingProduct?.ebay_offer_id ?? product.ebay_offer_id;
  const sku = storedInventoryItemId || `product-${product.id}`;

  const reconciliation = await reconcileEbayPublishState({
    ebayBase,
    accessToken: tokenSet.accessToken,
    sku,
    offerId: storedOfferId,
  });

  console.info('[eBay Publish] Reconciliation summary', {
    productId: product.id,
    sku,
    storedOfferId,
    storedStatus: existingProduct?.publish_status,
    storedItemId: existingProduct?.ebay_item_id,
    ...reconciliation,
  });

  if (!reconciliation.reliable) {
    return NextResponse.json(
      {
        success: false,
        error:
          'Could not verify the current eBay publish state. Try again before creating a new listing.',
      },
      { status: 502 }
    );
  }

  if (reconciliation.itemId || reconciliation.offerStatus === 'PUBLISHED') {
    console.info('[eBay Publish] Existing published listing confirmed', {
      productId: product.id,
      sku,
      offerId: reconciliation.offerId,
      itemId: reconciliation.itemId,
      listingStatus: reconciliation.listingStatus,
      source: reconciliation.source,
    });

    await updatePublishState(product.id, {
      publish_status: 'published',
      publish_error: null,
      published_at: new Date().toISOString(),
      ebay_inventory_item_id: sku,
      ebay_offer_id: reconciliation.offerId,
      ebay_item_id: reconciliation.itemId,
    });

    return NextResponse.json({
      success: true,
      data: {
        publishStatus: 'published',
        inventoryItemId: sku,
        offerId: reconciliation.offerId,
        itemId: reconciliation.itemId,
        alreadyPublished: true,
      },
    });
  }

  if (
    existingProduct?.publish_status === 'published' ||
    existingProduct?.ebay_item_id
  ) {
    console.warn('[eBay Publish] Stale local published state detected', {
      productId: product.id,
      sku,
      storedStatus: existingProduct.publish_status,
      storedItemId: existingProduct.ebay_item_id,
      reconciliation,
    });
  }

  const expectedPublishStatus = existingProduct?.publish_status;
  const claimedPublish = await claimPublishState(product.id, expectedPublishStatus, {
    publish_status: 'publishing',
    publish_error: null,
    ebay_inventory_item_id: sku,
  });

  if (!claimedPublish) {
    console.warn('[eBay Publish] Publish claim rejected because state changed', {
      productId: product.id,
      expectedPublishStatus,
      sku,
    });

    return NextResponse.json(
      {
        success: false,
        error:
          'This product publish state changed. Refresh products and try again.',
    },
    { status: 409 }
  );
  }

  const requiredPolicies: ListingPolicies = {
    fulfillment: selectedFulfillmentPolicyId,
    payment: selectedPaymentPolicyId,
    return: selectedReturnPolicyId,
  };

  console.info('[eBay Publish] Using eBay listing policies', {
    fulfillmentPolicyId: requiredPolicies.fulfillment,
    paymentPolicyId: requiredPolicies.payment,
    returnPolicyId: requiredPolicies.return,
    marketplaceId: EBAY_AU_MARKETPLACE_ID,
    country: EBAY_AU_COUNTRY,
    currency: EBAY_AU_CURRENCY,
  });

  const locationReady = await ensureEbayAuInventoryLocation(
    ebayBase,
    tokenSet.accessToken
  );

  if (!locationReady.ok) {
    const message =
      'eBay AU inventory location could not be prepared. Check the AU location country/postcode and try again.';

    console.error('[eBay Publish] AU inventory location setup failed', {
      status: locationReady.status,
      error: locationReady.error,
      merchantLocationKey: EBAY_AU_MERCHANT_LOCATION_KEY,
      country: EBAY_AU_COUNTRY,
    });

    await updatePublishState(product.id, {
      publish_status: 'error',
      publish_error: message,
      ebay_inventory_item_id: sku,
      ebay_offer_id: reconciliation.offerId,
    });

    return NextResponse.json(
      {
        success: false,
        error: message,
        partial: {
          inventoryItemId: sku,
          offerId: reconciliation.offerId,
        },
      },
      { status: locationReady.status || 502 }
    );
  }

  console.info('[eBay Publish] Publishing product to eBay', {
    sessionIdPreview: `${sessionId.slice(0, 8)}...`,
    environment: tokenSet.environment,
    sku,
    title: product?.title,
  });

  const categoryId = selectedEbayCategoryId;

  console.log('Using selected eBay category', {
    categoryName: product.categoryName,
    ebayCategoryId: selectedEbayCategoryId,
    ebayCategoryBreadcrumb:
      product.categoryPath || product.ebayCategoryBreadcrumb,
  });

  let offerId = reconciliation.offerId;

  if (offerId) {
    console.info('[eBay Publish] Reusing existing eBay offer for publish retry', {
      sessionIdPreview: `${sessionId.slice(0, 8)}...`,
      productId: product.id,
      sku,
      offerId,
    });

    await updatePublishState(product.id, {
      publish_status: 'offer_created',
      publish_error: null,
      ebay_inventory_item_id: sku,
      ebay_offer_id: offerId,
    });

    const inventoryPayload = getInventoryItemPayload(
      product,
      cleanedImages
    );
    const inventoryHeaders = getEbayInventoryHeaders({
      accessToken: tokenSet.accessToken,
      contentLanguage: true,
      contentType: true,
      marketplaceId: true,
    });

    logEbayPayload('inventory_item_create_or_replace', inventoryPayload);

    let inventoryRes: Response;

    try {
      inventoryRes = await fetchEbayInventory(
        `${ebayBase}/sell/inventory/v1/inventory_item/${sku}`,
        {
          method: 'PUT',
          headers: inventoryHeaders,
          step: 'inventory_item_create_or_replace',
          body: JSON.stringify(inventoryPayload),
        }
      );
    } catch (error) {
      const message =
        'Existing eBay inventory item could not be reached for AU location update. Try again.';

      console.error('[eBay Publish] Inventory item update request failed', {
        error,
        sku,
        offerId,
        merchantLocationKey: EBAY_AU_MERCHANT_LOCATION_KEY,
        country: EBAY_AU_COUNTRY,
      });

      await updatePublishState(product.id, {
        publish_status: 'error',
        publish_error: message,
        ebay_inventory_item_id: sku,
        ebay_offer_id: offerId,
      });

      return NextResponse.json(
        {
          success: false,
          error: message,
          partial: {
            inventoryItemId: sku,
            offerId,
          },
        },
        { status: 502 }
      );
    }

    if (!inventoryRes.ok) {
      const error = await inventoryRes.text();
      const message =
        'Existing eBay inventory item could not be updated with AU location details. Try again.';

      console.error('[eBay Publish] Inventory item update failed', {
        status: inventoryRes.status,
        statusText: inventoryRes.statusText,
        error,
        sku,
        offerId,
        merchantLocationKey: EBAY_AU_MERCHANT_LOCATION_KEY,
        country: EBAY_AU_COUNTRY,
      });

      await updatePublishState(product.id, {
        publish_status: 'error',
        publish_error: message,
        ebay_inventory_item_id: sku,
        ebay_offer_id: offerId,
      });

      return NextResponse.json(
        {
          success: false,
          error: message,
          partial: {
            inventoryItemId: sku,
            offerId,
          },
        },
        { status: inventoryRes.status }
      );
    }

    const updateOfferPayload = getOfferPayload({
      categoryId,
      includeCreateOnlyFields: false,
      policies: requiredPolicies,
      price,
      product,
      sku,
    });
    const updateOfferHeaders = getEbayInventoryHeaders({
      accessToken: tokenSet.accessToken,
      contentLanguage: true,
      contentType: true,
      marketplaceId: true,
    });

    logEbayPayload('offer_update', updateOfferPayload);

    let updateOfferRes: Response;

    try {
      updateOfferRes = await fetchEbayInventory(
        `${ebayBase}/sell/inventory/v1/offer/${encodeURIComponent(offerId)}`,
        {
          method: 'PUT',
          headers: updateOfferHeaders,
          step: 'offer_update',
          body: JSON.stringify(updateOfferPayload),
        }
      );
    } catch (error) {
      const message =
        'Existing eBay offer could not be reached for AU location update. Try again.';

      console.error('[eBay Publish] Offer update request failed', {
        error,
        sku,
        offerId,
        merchantLocationKey: EBAY_AU_MERCHANT_LOCATION_KEY,
        country: EBAY_AU_COUNTRY,
      });

      await updatePublishState(product.id, {
        publish_status: 'error',
        publish_error: message,
        ebay_inventory_item_id: sku,
        ebay_offer_id: offerId,
      });

      return NextResponse.json(
        {
          success: false,
          error: message,
          partial: {
            inventoryItemId: sku,
            offerId,
          },
        },
        { status: 502 }
      );
    }

    if (!updateOfferRes.ok) {
      const error = await updateOfferRes.text();
      const message =
        'Existing eBay offer could not be updated with AU location details. Try again.';

      console.error('[eBay Publish] Offer update failed', {
        status: updateOfferRes.status,
        statusText: updateOfferRes.statusText,
        error,
        offerId,
        merchantLocationKey: EBAY_AU_MERCHANT_LOCATION_KEY,
        country: EBAY_AU_COUNTRY,
      });

      await updatePublishState(product.id, {
        publish_status: 'error',
        publish_error: message,
        ebay_inventory_item_id: sku,
        ebay_offer_id: offerId,
      });

      return NextResponse.json(
        {
          success: false,
          error: message,
          partial: {
            inventoryItemId: sku,
            offerId,
          },
        },
        { status: updateOfferRes.status }
      );
    }
  } else {
    // 1. inventory item
    let inventoryRes: Response;
    const inventoryHeaders = getEbayInventoryHeaders({
      accessToken: tokenSet.accessToken,
      contentLanguage: true,
      contentType: true,
      marketplaceId: true,
    });
    const inventoryPayload = getInventoryItemPayload(
      product,
      cleanedImages
    );

    logEbayPayload('inventory_item_create_or_replace', inventoryPayload);

    try {
      inventoryRes = await fetchEbayInventory(
        `${ebayBase}/sell/inventory/v1/inventory_item/${sku}`,
        {
          method: 'PUT',
          headers: inventoryHeaders,
          step: 'inventory_item_create_or_replace',
          body: JSON.stringify(inventoryPayload),
        }
      );
    } catch (error) {
      const message =
        'Could not reach eBay while creating the inventory item. Try again.';

      console.error('[eBay Publish] Inventory item request failed', {
        error,
        sku,
      });

      await updatePublishState(product.id, {
        publish_status: 'error',
        publish_error: message,
        ebay_inventory_item_id: sku,
      });

      return NextResponse.json(
        {
          success: false,
          error: message,
          partial: {
            inventoryItemId: sku,
          },
        },
        { status: 502 }
      );
    }

    if (!inventoryRes.ok) {
      const error = await inventoryRes.text();
      const message =
        'eBay could not create the inventory item. Check the product details and try again.';

      console.error('[eBay Publish] Inventory item creation failed', {
        status: inventoryRes.status,
        statusText: inventoryRes.statusText,
        error,
      });

      await updatePublishState(product.id, {
        publish_status: 'error',
        publish_error: message,
        ebay_inventory_item_id: sku,
      });

      return NextResponse.json(
        {
          success: false,
          error: message,
          partial: {
            inventoryItemId: sku,
          },
        },
        { status: inventoryRes.status }
      );
    }

    await updatePublishState(product.id, {
      publish_status: 'inventory_created',
      publish_error: null,
      ebay_inventory_item_id: sku,
    });

    // 2. offer
    let offerRes: Response;
    const offerHeaders = getEbayInventoryHeaders({
      accessToken: tokenSet.accessToken,
      contentLanguage: true,
      contentType: true,
      marketplaceId: true,
    });
    const offerPayload = getOfferPayload({
      categoryId,
      includeCreateOnlyFields: true,
      policies: requiredPolicies,
      price,
      product,
      sku,
    });

    logEbayPayload('offer_create', offerPayload);

    try {
      offerRes = await fetchEbayInventory(`${ebayBase}/sell/inventory/v1/offer`, {
        method: 'POST',
        headers: offerHeaders,
        step: 'offer_create',
        body: JSON.stringify(offerPayload),
      });
    } catch (error) {
      const message =
        'Inventory was created, but eBay could not be reached while creating the offer. Try again.';

      console.error('[eBay Publish] Offer request failed', {
        error,
        sku,
      });

      await updatePublishState(product.id, {
        publish_status: 'error',
        publish_error: message,
        ebay_inventory_item_id: sku,
      });

      return NextResponse.json(
        {
          success: false,
          error: message,
          partial: {
            inventoryItemId: sku,
          },
        },
        { status: 502 }
      );
    }

    const offerData = (await offerRes.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    if (!offerRes.ok) {
      const ebayMessage = getEbayErrorMessage(offerData);

      console.error('[eBay Publish] Offer creation failed', {
        status: offerRes.status,
        statusText: offerRes.statusText,
        response: offerData,
      });

      const message = ebayMessage
        ? `eBay offer creation failed: ${ebayMessage}`
        : 'eBay could not create the offer. Check policies and product details, then try again.';

      await updatePublishState(product.id, {
        publish_status: 'error',
        publish_error: message,
        ebay_inventory_item_id: sku,
      });

      return NextResponse.json(
        {
          success: false,
          error: message,
          partial: {
            inventoryItemId: sku,
          },
        },
        { status: offerRes.status }
      );
    }

    if (typeof offerData.offerId !== 'string') {
      console.error('[eBay Publish] Offer creation returned no offerId', {
        response: offerData,
      });

      const message =
        'eBay created an offer but did not return an offer ID. Try publishing again.';

      await updatePublishState(product.id, {
        publish_status: 'error',
        publish_error: message,
        ebay_inventory_item_id: sku,
      });

      return NextResponse.json(
        {
          success: false,
          error: message,
          partial: {
            inventoryItemId: sku,
          },
        },
        { status: 502 }
      );
    }

    offerId = offerData.offerId;

    await updatePublishState(product.id, {
      publish_status: 'offer_created',
      publish_error: null,
      ebay_inventory_item_id: sku,
      ebay_offer_id: offerId,
    });
  }

  // 3. publish
  let publishRes: Response;
  const publishHeaders = getEbayInventoryHeaders({
    accessToken: tokenSet.accessToken,
    marketplaceId: true,
  });
  const publishPayload = {
    offerId,
    merchantLocationKey: EBAY_AU_MERCHANT_LOCATION_KEY,
    marketplaceId: EBAY_AU_MARKETPLACE_ID,
    body: null,
  };

  logEbayPayload('offer_publish', publishPayload);

  try {
    publishRes = await fetchEbayInventory(
      `${ebayBase}/sell/inventory/v1/offer/${offerId}/publish`,
      {
        method: 'POST',
        headers: publishHeaders,
        step: 'offer_publish',
      }
    );
  } catch (error) {
    const message =
      'Offer was created, but eBay could not be reached while publishing it. Try again.';

    console.error('[eBay Publish] Publish request failed', {
      error,
      sku,
      offerId,
    });

    await updatePublishState(product.id, {
      publish_status: 'error',
      publish_error: message,
      ebay_inventory_item_id: sku,
      ebay_offer_id: offerId,
    });

    return NextResponse.json(
      {
        success: false,
        error: message,
        partial: {
          inventoryItemId: sku,
          offerId,
        },
      },
      { status: 502 }
    );
  }

  if (!publishRes.ok) {
    const error = await publishRes.text();
    console.error('[eBay Publish] Offer publish failed', {
      status: publishRes.status,
      statusText: publishRes.statusText,
      error,
    });

    const message =
      'eBay created the offer but could not publish it. Try again from this page.';

    await updatePublishState(product.id, {
      publish_status: 'error',
      publish_error: message,
      ebay_inventory_item_id: sku,
      ebay_offer_id: offerId,
    });

    return NextResponse.json(
      {
        success: false,
        error: message,
        partial: {
          inventoryItemId: sku,
          offerId,
        },
      },
      { status: publishRes.status }
    );
  }

  const publishData = (await publishRes.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  const ebayItemId =
    typeof publishData.listingId === 'string'
      ? publishData.listingId
      : typeof publishData.itemId === 'string'
        ? publishData.itemId
        : typeof publishData.id === 'string'
          ? publishData.id
          : null;

  await updatePublishState(product.id, {
    publish_status: 'published',
    publish_error: null,
    published_at: new Date().toISOString(),
    ebay_inventory_item_id: sku,
    ebay_offer_id: offerId,
    ebay_item_id: ebayItemId,
  });

  console.info('[eBay Publish] Product published successfully', {
    sessionIdPreview: `${sessionId.slice(0, 8)}...`,
    sku,
    offerId,
    itemId: ebayItemId,
  });

  return NextResponse.json({
    success: true,
    data: {
      publishStatus: 'published',
      inventoryItemId: sku,
      offerId,
      itemId: ebayItemId,
    },
  });
}
