'use client';

/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from 'react';
import { validateProduct } from '@/lib/product-validation';

type Product = {
  id?: string | number;
  title?: string;
  categoryName?: string;
  price?: string | number;
  description?: string;
  images?: string[];
  fulfillmentPolicyId?: string;
  publish_status?: string;
  publish_error?: string | null;
  published_at?: string | null;
  ebay_inventory_item_id?: string | null;
  ebay_offer_id?: string | null;
  ebay_item_id?: string | null;
  [key: string]: unknown;
};

type PublishAlert = {
  type: 'success' | 'error';
  message: string;
  productIndex?: number;
};

type ProductActionMessage = {
  type: 'success' | 'error';
  message: string;
};

type PublishResponse = {
  error?: string;
  success?: boolean;
  data?: {
    publishStatus?: string;
    inventoryItemId?: string | null;
    offerId?: string | null;
    itemId?: string | null;
    alreadyPublished?: boolean;
  };
  partial?: {
    inventoryItemId?: string | null;
    offerId?: string | null;
  };
};

type DeleteResponse = {
  error?: string;
  success?: boolean;
};

const DEFAULT_FULFILLMENT_POLICY_ID = '287446648015';

const PRODUCT_CATEGORIES = [
  'Gel Nail Polish',
  'Nail Extension Gel',
  'Functional Nail Coatings',
  'Gel Nail Tips',
  'Nail Filers',
  'Gel Nail Stickers',
] as const;

const SHIPPING_POLICIES = [
  {
    label: 'Standard AU Shipping ($9.95)',
    value: '287348474015',
  },
  {
    label: 'Flat AU Standard + Express',
    value: '287348909015',
  },
  {
    label: 'Free AU Shipping',
    value: DEFAULT_FULFILLMENT_POLICY_ID,
  },
] as const;

function getPublishErrorMessage(status: number, fallback?: string) {
  if (fallback) {
    return fallback;
  }

  if (status === 401) {
    return 'Connect eBay from the dashboard before publishing.';
  }

  if (status === 400) {
    return 'Check the product details and try publishing again.';
  }

  if (status >= 500) {
    return 'eBay publishing is temporarily unavailable. Try again in a moment.';
  }

  return 'Publish failed. Review the product and try again.';
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [categorySaveError, setCategorySaveError] = useState('');
  const [productActionMessage, setProductActionMessage] =
    useState<ProductActionMessage | null>(null);
  const [publishingProductId, setPublishingProductId] = useState<
    string | number | null
  >(null);
  const [publishAlert, setPublishAlert] = useState<PublishAlert | null>(null);
  const [brokenImageKeys, setBrokenImageKeys] = useState<Set<string>>(
    new Set()
  );
  const validationResults = products.map((product, index) =>
    validateProduct(product, products, index, brokenImageKeys)
  );
  const itemsPerPage = 6;
  const totalPages = Math.max(1, Math.ceil(products.length / itemsPerPage));
  const visiblePage = Math.min(currentPage, totalPages);
  const paginatedProducts = products.slice(
    (visiblePage - 1) * itemsPerPage,
    visiblePage * itemsPerPage
  );

  useEffect(() => {
    fetch('/api/products')
      .then((res) => res.json())
      .then((res) => {
        if (res.success) {
          setProducts(
            res.data.map((product: Product) => ({
              ...product,
              fulfillmentPolicyId:
                product.fulfillmentPolicyId || DEFAULT_FULFILLMENT_POLICY_ID,
            }))
          );
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('PRODUCT FETCH ERROR:', err);
        setLoading(false);
      });
  }, []);

  const updateProductField = (
    index: number,
    field: keyof Product,
    value: string
  ) => {
    setProducts((currentProducts) =>
      currentProducts.map((product, productIndex) =>
        productIndex === index ? { ...product, [field]: value } : product
      )
    );
  };

  const updateProductCategory = async (index: number, value: string) => {
    const product = products[index];
    const previousCategoryName = product?.categoryName;

    setCategorySaveError('');
    updateProductField(index, 'categoryName', value);

    if (!product?.id) {
      return;
    }

    try {
      console.log('Updating category:', product.id, value);

      const res = await fetch('/api/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: product.id,
          updates: {
            categoryName: value,
          },
        }),
      });

      if (!res.ok) {
        throw new Error('Update failed');
      }

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Update failed');
      }
    } catch {
      updateProductField(index, 'categoryName', previousCategoryName ?? '');
      setCategorySaveError('Category could not be saved.');
    }
  };

  const updateProductPublishState = (
    index: number,
    updates: Partial<Product>
  ) => {
    setProducts((currentProducts) =>
      currentProducts.map((product, productIndex) =>
        productIndex === index ? { ...product, ...updates } : product
      )
    );
  };

  const validateProductForPublish = (product: Product) => {
    const productIndex = products.indexOf(product);
    const validation = validationResults[productIndex];
    return validation?.valid ? null : validation?.messages.join(' ');
  };

  const saveChanges = async () => {
    setSaving(true);
    setProductActionMessage(null);

    try {
      const res = await fetch('/api/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products }),
      });

      const data = await res.json();
      console.log('UPDATE RESPONSE:', data);

      if (!res.ok || !data.success) {
        setProductActionMessage({
          type: 'error',
          message: data.error || 'Changes could not be saved. Try again.',
        });
        return;
      }

      setProductActionMessage({
        type: 'success',
        message: 'Changes saved.',
      });
    } catch (err) {
      console.error('SAVE ERROR:', err);
      setProductActionMessage({
        type: 'error',
        message: 'Changes could not be saved. Try again.',
      });
    } finally {
      setSaving(false);
    }
  };

  const deleteProduct = async (id: string) => {
    if (!confirm('Delete this product?')) return;

    const res = await fetch('/api/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    const data = (await res.json().catch(() => ({}))) as DeleteResponse;

    if (!res.ok || !data.success) {
      setProductActionMessage({
        type: 'error',
        message: data.error || 'Product could not be deleted. Try again.',
      });
      return;
    }

    setProducts((prev) => prev.filter((product) => String(product.id) !== id));
    setProductActionMessage({
      type: 'success',
      message: 'Product deleted.',
    });
  };

  const exportCSV = () => {
    const link = document.createElement('a');
    link.href = '/api/export';
    link.download = 'ebay-products.csv';
    link.click();
  };

  const publishProduct = async (productIndex: number) => {
    const product = products[productIndex];

    if (!product) {
      setPublishAlert({
        type: 'error',
        message: 'Add or import a product before publishing to eBay.',
      });
      return;
    }

    const validationError = validateProductForPublish(product);

    if (validationError) {
      setPublishAlert({
        type: 'error',
        message: validationError,
        productIndex,
      });
      updateProductPublishState(productIndex, {
        publish_status: product.publish_status ?? 'draft',
        publish_error: validationError,
      });
      return;
    }

    const productPublishId = product.id ?? productIndex;
    const fulfillmentPolicyId =
      product.fulfillmentPolicyId || DEFAULT_FULFILLMENT_POLICY_ID;

    setPublishingProductId(productPublishId);
    setPublishAlert(null);
    updateProductPublishState(productIndex, {
      fulfillmentPolicyId,
      publish_status: 'publishing',
      publish_error: null,
    });

    try {
      const res = await fetch('/api/ebay/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product: {
            ...product,
            fulfillmentPolicyId,
            categoryName: product.categoryName,
          },
          categoryName: product.categoryName,
          fulfillmentPolicyId,
          recover: product.publish_status === 'publishing',
          policies: {
            fulfillment: fulfillmentPolicyId,
            payment: process.env.NEXT_PUBLIC_DEFAULT_PAYMENT_POLICY_ID,
            return: process.env.NEXT_PUBLIC_DEFAULT_RETURN_POLICY_ID,
          },
        }),
      });

      const data = (await res.json().catch(() => ({}))) as PublishResponse;

      if (!res.ok || !data.success) {
        const message = getPublishErrorMessage(res.status, data.error);

        updateProductPublishState(productIndex, {
          publish_status: 'error',
          publish_error: message,
          ebay_inventory_item_id:
            data.partial?.inventoryItemId ?? product.ebay_inventory_item_id,
          ebay_offer_id: data.partial?.offerId ?? product.ebay_offer_id,
        });
        setPublishAlert({
          type: 'error',
          message,
          productIndex,
        });
        return;
      }

      updateProductPublishState(productIndex, {
        publish_status: data.data?.publishStatus ?? 'published',
        publish_error: null,
        published_at: new Date().toISOString(),
        ebay_inventory_item_id:
          data.data?.inventoryItemId ?? product.ebay_inventory_item_id,
        ebay_offer_id: data.data?.offerId ?? product.ebay_offer_id,
        ebay_item_id: data.data?.itemId ?? product.ebay_item_id,
      });
      setPublishAlert({
        type: 'success',
        message: data.data?.alreadyPublished
          ? `Confirmed "${product.title ?? 'product'}" is already published on eBay.`
          : `Published "${product.title ?? 'product'}" to eBay successfully.`,
        productIndex,
      });
    } catch {
      const message =
        'Publish request could not be completed. Check your connection and try again.';

      updateProductPublishState(productIndex, {
        publish_status: 'error',
        publish_error: message,
      });
      setPublishAlert({
        type: 'error',
        message,
        productIndex,
      });
    } finally {
      setPublishingProductId(null);
    }
  };

  const publishFirstProduct = () => {
    const nextIndex = products.findIndex(
      (product, index) =>
        validationResults[index]?.valid &&
        product.publish_status !== 'published' &&
        !product.ebay_item_id
    );

    publishProduct(nextIndex >= 0 ? nextIndex : 0);
  };

  return (
    <div className="px-4 py-6 text-slate-100 sm:px-6 sm:py-8 lg:px-8">
      {loading && (
        <div className="loader-overlay" role="status" aria-live="polite">
          <div className="spinner" />
          <p>Fetching products...</p>
        </div>
      )}

      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 border-b border-white/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-1 text-sm font-medium text-cyan-300">
              Inventory admin
            </p>
            <h1 className="text-2xl font-semibold leading-tight text-white sm:text-3xl">
              Products
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              Review imported products, choose eBay categories, and publish validated listings.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 shadow-sm">
              <p className="text-slate-400">Products</p>
              <p className="text-xl font-semibold text-white">{products.length}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 shadow-sm">
              <p className="text-slate-400">Valid</p>
              <p className="text-xl font-semibold text-white">
                {validationResults.filter((result) => result.valid).length}
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 shadow-sm">
              <p className="text-slate-400">Page</p>
              <p className="text-xl font-semibold text-white">
                {visiblePage}/{totalPages}
              </p>
            </div>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap">
          <button
            onClick={exportCSV}
            disabled={publishingProductId !== null}
            className="min-h-11 rounded-lg border border-cyan-300/30 bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-950/30 transition hover:bg-cyan-300 disabled:opacity-60 lg:w-auto"
          >
            Export CSV
          </button>

          <button
            onClick={saveChanges}
            disabled={saving || publishingProductId !== null}
            className="min-h-11 rounded-lg border border-emerald-300/30 bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-60 lg:w-auto"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>

          <button
            onClick={publishFirstProduct}
            disabled={publishingProductId !== null || products.length === 0}
            className="min-h-11 rounded-lg border border-violet-300/30 bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-400 disabled:opacity-60 lg:w-auto"
          >
            {publishingProductId !== null
              ? 'Publishing...'
              : publishAlert?.type === 'error'
                ? 'Retry publish'
                : 'Publish to eBay'}
          </button>

          <a
            href="/dashboard"
            className={`min-h-11 rounded-lg border border-white/10 bg-white/[0.06] px-4 py-2.5 text-center text-sm font-semibold text-slate-100 transition hover:bg-white/10 lg:w-auto ${
              publishingProductId !== null ? 'pointer-events-none opacity-60' : ''
            }`}
          >
            eBay Dashboard
          </a>
        </div>

        {publishAlert && (
          <div
            role="alert"
            aria-live="polite"
            className={`mb-6 rounded-md border px-4 py-3 text-sm ${
              publishAlert.type === 'success'
                ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
                : 'border-red-400/30 bg-red-400/10 text-red-200'
            }`}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="min-w-0 break-words">{publishAlert.message}</p>
              {publishAlert.type === 'error' && (
                <button
                  onClick={() =>
                    publishProduct(publishAlert.productIndex ?? 0)
                  }
                  disabled={publishingProductId !== null || products.length === 0}
                  className="min-h-10 rounded-md bg-white/10 px-3 py-2 text-sm font-medium text-red-100 shadow-sm ring-1 ring-inset ring-red-400/30 hover:bg-white/15 disabled:opacity-60 sm:w-auto"
                >
                  Try again
                </button>
              )}
            </div>
          </div>
        )}

        {productActionMessage && (
          <div
            role="status"
            aria-live="polite"
            className={`mb-6 rounded-md border px-4 py-3 text-sm ${
              productActionMessage.type === 'success'
                ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
                : 'border-red-400/30 bg-red-400/10 text-red-200'
            }`}
          >
            {productActionMessage.message}
          </div>
        )}

        {categorySaveError && (
          <div
            role="alert"
            className="mb-6 rounded-md border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm text-amber-100"
          >
            {categorySaveError}
          </div>
        )}

        <div
          className="product-grid"
          style={{
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
          }}
        >
          {paginatedProducts.map((p, pageIndex) => {
            const i = (visiblePage - 1) * itemsPerPage + pageIndex;
            const productPublishId = p.id ?? i;
            const isPublishing = publishingProductId === productPublishId;
            const isPublished = p.publish_status === 'published' || p.ebay_item_id;
            const validation = validationResults[i];
            const publishStatus = isPublishing
              ? 'Publishing'
              : isPublished
                ? 'Published'
                : p.publish_status === 'publishing'
                  ? 'Recovery needed'
                  : p.publish_status === 'error'
                    ? 'Publish error'
                    : p.publish_status === 'inventory_created' ||
                        p.publish_status === 'offer_created'
                      ? 'Partially published'
                      : 'Not published';

            return (
              <div
                key={p.id ?? i}
                className="product-card min-w-0 overflow-hidden border border-white/10 bg-slate-900/80 p-4 backdrop-blur sm:p-5"
              >
                {p.images?.[0] && (
                  <img
                    src={p.images[0]}
                    alt={p.title ? `${p.title} product image` : 'Product image'}
                    className="mb-3 aspect-[4/3] w-full rounded object-cover"
                    onError={(e) => {
                      e.currentTarget.classList.add('hidden');
                      setBrokenImageKeys((currentKeys) => {
                        const nextKeys = new Set(currentKeys);
                        nextKeys.add(`${i}:0:${p.images?.[0] ?? ''}`);
                        return nextKeys;
                      });
                    }}
                  />
                )}

                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Publish status
                    </p>
                    <p className="break-words text-sm font-semibold text-slate-100">
                      {publishStatus}
                    </p>
                  </div>
                  <span
                    className={`w-fit rounded px-2 py-1 text-xs ${
                      validation.valid
                        ? 'bg-emerald-400/10 text-emerald-200 ring-1 ring-emerald-400/20'
                        : 'bg-red-400/10 text-red-200 ring-1 ring-red-400/20'
                    }`}
                  >
                    {validation.valid ? 'Valid' : 'Needs fixes'}
                  </span>
                  <button
                    onClick={() => publishProduct(i)}
                    disabled={
                      publishingProductId !== null ||
                      (!validation.valid && !isPublished)
                    }
                    className="min-h-10 rounded-lg bg-violet-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-violet-400 disabled:opacity-60 sm:w-auto"
                  >
                    {isPublishing
                      ? 'Publishing...'
                      : isPublished
                        ? 'Sync'
                      : p.publish_status === 'publishing'
                        ? 'Recover'
                      : p.publish_status === 'error'
                        ? 'Retry'
                        : 'Publish'}
                  </button>
                  <button
                    onClick={() => p.id && deleteProduct(String(p.id))}
                    disabled={isPublishing || !p.id}
                    className="min-h-9 rounded-lg bg-red-500/90 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-400 disabled:opacity-60"
                  >
                    Delete
                  </button>
                </div>

                {(p.ebay_inventory_item_id || p.ebay_offer_id || p.ebay_item_id) && (
                  <dl className="mb-3 space-y-1 rounded-lg border border-white/10 bg-white/[0.04] p-3 text-xs text-slate-400">
                    {p.ebay_inventory_item_id && (
                      <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-3">
                        <dt>Inventory ID</dt>
                        <dd className="break-all font-medium">
                          {p.ebay_inventory_item_id}
                        </dd>
                      </div>
                    )}
                    {p.ebay_offer_id && (
                      <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-3">
                        <dt>Offer ID</dt>
                        <dd className="break-all font-medium">{p.ebay_offer_id}</dd>
                      </div>
                    )}
                    {p.ebay_item_id && (
                      <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-3">
                        <dt>Item ID</dt>
                        <dd className="break-all font-medium">{p.ebay_item_id}</dd>
                      </div>
                    )}
                  </dl>
                )}

                {p.publish_error && (
                    <p className="mb-3 break-words rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-200">
                    {p.publish_error}
                  </p>
                )}

                {!validation.valid && !isPublished && (
                  <ul className="mb-3 space-y-1 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-200">
                    {validation.messages.map((message) => (
                      <li key={message}>{message}</li>
                    ))}
                  </ul>
                )}

                <label className="mb-1 block text-sm font-semibold text-slate-200">
                  Shipping policy
                </label>
                <select
                  value={p.fulfillmentPolicyId || DEFAULT_FULFILLMENT_POLICY_ID}
                  onChange={(e) =>
                    updateProductField(i, 'fulfillmentPolicyId', e.target.value)
                  }
                  disabled={isPublishing}
                  className="mb-3 min-h-11 w-full min-w-0 rounded-lg border border-white/10 bg-slate-950/80 px-3 py-2.5 text-base text-slate-100 outline-none transition focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20 disabled:opacity-60 sm:text-sm"
                >
                  {SHIPPING_POLICIES.map((policy) => (
                    <option key={policy.value} value={policy.value}>
                      {policy.label}
                    </option>
                  ))}
                </select>

                <label className="mb-1 block text-sm font-semibold text-slate-200">
                  Category
                </label>
                <select
                  value={p.categoryName ?? ''}
                  onChange={(e) => updateProductCategory(i, e.target.value)}
                  disabled={isPublishing}
                  className="mb-3 min-h-11 w-full min-w-0 rounded-lg border border-white/10 bg-slate-950/80 px-3 py-2.5 text-base text-slate-100 outline-none transition focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20 disabled:opacity-60 sm:text-sm"
                >
                  <option value="">Select category</option>
                  {PRODUCT_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>

                <label className="mb-1 block text-sm font-semibold text-slate-200">Title</label>
                <input
                  value={p.title ?? ''}
                  onChange={(e) => updateProductField(i, 'title', e.target.value)}
                  className="mb-3 min-h-11 w-full min-w-0 rounded-lg border border-white/10 bg-slate-950/80 px-3 py-2.5 text-base text-slate-100 outline-none transition focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20 sm:text-sm"
                />

                <label className="mb-1 block text-sm font-semibold text-slate-200">Price</label>
                <input
                  value={p.price ?? ''}
                  onChange={(e) => updateProductField(i, 'price', e.target.value)}
                  className="mb-3 min-h-11 w-full min-w-0 rounded-lg border border-white/10 bg-slate-950/80 px-3 py-2.5 text-base text-slate-100 outline-none transition focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20 sm:text-sm"
                />

                <label className="mb-1 block text-sm font-semibold text-slate-200">
                  Description
                </label>
                <textarea
                  value={p.description ?? ''}
                  onChange={(e) =>
                    updateProductField(i, 'description', e.target.value)
                  }
                  className="min-h-32 w-full min-w-0 resize-y rounded-lg border border-white/10 bg-slate-950/80 px-3 py-2.5 text-base text-slate-100 outline-none transition focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20 sm:min-h-28 sm:text-sm"
                />
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-400">
            Showing {products.length === 0 ? 0 : (visiblePage - 1) * itemsPerPage + 1}
            -
            {Math.min(visiblePage * itemsPerPage, products.length)} of{' '}
            {products.length}
          </p>
          <div className="grid grid-cols-2 gap-3 sm:flex">
            <button
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={visiblePage === 1}
              className="min-h-10 rounded-lg border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-medium text-slate-100 shadow-sm hover:bg-white/10 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() =>
                setCurrentPage((page) => Math.min(totalPages, page + 1))
              }
              disabled={visiblePage === totalPages}
              className="min-h-10 rounded-lg border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-medium text-slate-100 shadow-sm hover:bg-white/10 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
