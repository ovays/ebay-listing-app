import { NextResponse } from 'next/server';
import { request as undiciRequest } from 'undici';
import { requireEbayAuth } from '@/lib/ebay/auth';
import { supabase } from '@/lib/supabase';

const EBAY_API_BASE = {
  sandbox: 'https://api.sandbox.ebay.com',
  production: 'https://api.ebay.com',
} as const;

const EBAY_AU_MARKETPLACE_ID = 'EBAY_AU';

type DeleteProductRecord = {
  ebay_inventory_item_id?: string | null;
  ebay_offer_id?: string | null;
  ebay_item_id?: string | null;
  inventoryId?: string | null;
  itemId?: string | null;
  offerId?: string | null;
  publish_status?: string | null;
  sku?: string | null;
};

function getStringValue(
  product: DeleteProductRecord,
  fields: (keyof DeleteProductRecord)[]
) {
  for (const field of fields) {
    const value = product[field];

    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function getEbayCleanupIds(product: DeleteProductRecord, id: string | number) {
  const offerId = getStringValue(product, ['ebay_offer_id', 'offerId']);
  const storedSku = getStringValue(product, [
    'ebay_inventory_item_id',
    'sku',
    'inventoryId',
  ]);
  const itemId = getStringValue(product, ['ebay_item_id', 'itemId']);
  const hasEbayState =
    Boolean(offerId || storedSku || itemId) ||
    product.publish_status === 'published' ||
    product.publish_status === 'offer_created' ||
    product.publish_status === 'inventory_created';

  return {
    hasEbayState,
    itemId,
    offerId,
    sku: storedSku ?? `product-${id}`,
  };
}

function getEbayHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'X-EBAY-C-MARKETPLACE-ID': EBAY_AU_MARKETPLACE_ID,
  };
}

async function cleanupEbayResource({
  body,
  headers,
  method,
  productId,
  step,
  url,
}: {
  body?: string;
  headers: ReturnType<typeof getEbayHeaders>;
  method: 'DELETE' | 'POST';
  productId: string | number;
  step: string;
  url: string;
}) {
  try {
    const response = await undiciRequest(url, {
      body,
      headers,
      method,
    });
    const responseBody = await response.body.text();

    if (response.statusCode < 200 || response.statusCode >= 300) {
      console.warn('[eBay Delete] Cleanup step failed', {
        productId,
        step,
        status: response.statusCode,
        response: responseBody,
      });
    }
  } catch (error) {
    console.warn('[eBay Delete] Cleanup request failed', {
      productId,
      step,
      error,
    });
  }
}

export async function POST(req: Request) {
  let body: { id?: string | number };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Delete request was invalid. Try again.' },
      { status: 400 }
    );
  }

  const { id } = body;

  if (!id) {
    return NextResponse.json(
      { success: false, error: 'Choose a product before deleting.' },
      { status: 400 }
    );
  }

  const { data: product, error: productError } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .maybeSingle<DeleteProductRecord>();

  if (productError) {
    console.log('DELETE READ ERROR:', productError);
    return NextResponse.json({ success: false, error: productError });
  }

  if (!product) {
    return NextResponse.json(
      { success: false, error: 'Product could not be found.' },
      { status: 404 }
    );
  }

  const { hasEbayState, offerId, sku } = getEbayCleanupIds(product, id);

  if (hasEbayState) {
    const auth = await requireEbayAuth();

    if (!auth) {
      console.warn(
        '[eBay Delete] Delete rejected because user is not authenticated',
        {
          productId: id,
          offerId,
          sku,
        }
      );

      return NextResponse.json(
        { success: false, error: 'Connect eBay before deleting this listing.' },
        { status: 401 }
      );
    }

    const ebayBase = EBAY_API_BASE[auth.tokenSet.environment];
    const headers = getEbayHeaders(auth.tokenSet.accessToken);

    if (offerId) {
      console.log('WITHDRAW', offerId);
      await cleanupEbayResource({
        body: JSON.stringify({ reason: 'SELLER_ENDED' }),
        headers,
        method: 'POST',
        productId: id,
        step: 'offer_withdraw',
        url: `${ebayBase}/sell/inventory/v1/offer/${encodeURIComponent(
          offerId
        )}/withdraw`,
      });

      console.log('DELETE OFFER', offerId);
      await cleanupEbayResource({
        headers,
        method: 'DELETE',
        productId: id,
        step: 'offer_delete',
        url: `${ebayBase}/sell/inventory/v1/offer/${encodeURIComponent(
          offerId
        )}`,
      });
    }

    if (sku) {
      console.log('DELETE INVENTORY', sku);
      await cleanupEbayResource({
        headers,
        method: 'DELETE',
        productId: id,
        step: 'inventory_item_delete',
        url: `${ebayBase}/sell/inventory/v1/inventory_item/${encodeURIComponent(
          sku
        )}`,
      });
    }
  }

  const { error } = await supabase.from('products').delete().eq('id', id);

  if (error) {
    console.log('DELETE ERROR:', error);
    return NextResponse.json({ success: false, error });
  }

  return NextResponse.json({ success: true });
}
