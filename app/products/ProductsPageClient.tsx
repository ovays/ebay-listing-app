'use client';

/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { validateProduct } from '@/lib/product-validation';

type ProductRouteStatus = 'draft' | 'published' | 'error';

type Product = {
  id?: string | number;
  title?: string;
  categoryName?: string;
  categoryId?: string | null;
  categoryPath?: string | null;
  ebayCategoryId?: string | null;
  ebayCategoryBreadcrumb?: string | null;
  price?: string | number;
  quantity?: number;
  description?: string;
  images?: string[];
  publishStatus?: 'idle' | 'pending' | 'published' | 'error';
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

type EbayCategorySearchResult = {
  categoryId: string;
  categoryName: string;
  categoryPath: string;
  isLeaf: boolean;
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

const PRODUCT_STATUS_TABS: Array<{
  href: string;
  label: string;
  status: ProductRouteStatus;
}> = [
  { href: '/products', label: 'Draft', status: 'draft' },
  { href: '/products/published', label: 'Published', status: 'published' },
  { href: '/products/errors', label: 'Errors', status: 'error' },
];

const PRODUCT_STATUS_TITLES: Record<ProductRouteStatus, string> = {
  draft: 'Draft Products',
  published: 'Published Products',
  error: 'Products With Errors',
};

function getInitialPublishStatus(
  product: Product
): Product['publishStatus'] {
  if (product.publishStatus) {
    return product.publishStatus;
  }

  if (product.publish_status === 'published' || product.ebay_item_id) {
    return 'published';
  }

  if (product.publish_status === 'publishing') {
    return 'pending';
  }

  return 'idle';
}

function getPublishStatusLabel(status: Product['publishStatus']) {
  if (status === 'published') return 'Published';
  if (status === 'error') return 'Publish error';
  if (status === 'pending') return 'Publishing...';
  return 'Not published';
}

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

function getProductSelectionId(product: Product) {
  return product.id === undefined || product.id === null
    ? null
    : String(product.id);
}

function getProductCategoryId(product: Product) {
  return product.categoryId || product.ebayCategoryId || '';
}

function getProductCategoryPath(product: Product) {
  return product.categoryPath || product.ebayCategoryBreadcrumb || '';
}

function getCategorySearchKey(product: Product, index: number) {
  return getProductSelectionId(product) ?? `index-${index}`;
}

export default function ProductsPageClient({
  status,
}: {
  status: ProductRouteStatus;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bulkPublishing, setBulkPublishing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [categorySaveError, setCategorySaveError] = useState('');
  const [categorySearchQueries, setCategorySearchQueries] = useState<
    Record<string, string>
  >({});
  const [categorySearchResults, setCategorySearchResults] = useState<
    Record<string, EbayCategorySearchResult[]>
  >({});
  const [categorySearchLoading, setCategorySearchLoading] = useState<
    Record<string, boolean>
  >({});
  const [categorySearchErrors, setCategorySearchErrors] = useState<
    Record<string, string>
  >({});
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
    fetch(`/api/products?status=${status}`)
      .then((res) => res.json())
      .then((res) => {
        if (res.success) {
          setProducts(
            res.data.map((product: Product) => ({
              ...product,
              quantity: product.quantity || 1,
              publishStatus: getInitialPublishStatus(product) || 'idle',
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
  }, [status]);

  const updateProductField = (
    index: number,
    field: keyof Product,
    value: string | number | null
  ) => {
    setProducts((currentProducts) =>
      currentProducts.map((product, productIndex) =>
        productIndex === index ? { ...product, [field]: value } : product
      )
    );
  };

  const searchEbayCategories = async (index: number) => {
    const product = products[index];
    const searchKey = product ? getCategorySearchKey(product, index) : '';
    const query = categorySearchQueries[searchKey]?.trim();

    if (!product || !searchKey || !query) {
      setCategorySearchErrors((currentErrors) => ({
        ...currentErrors,
        [searchKey]: 'Enter a category search term.',
      }));
      return;
    }

    setCategorySearchLoading((currentLoading) => ({
      ...currentLoading,
      [searchKey]: true,
    }));
    setCategorySearchErrors((currentErrors) => ({
      ...currentErrors,
      [searchKey]: '',
    }));

    try {
      const res = await fetch(
        `/api/ebay/categories?q=${encodeURIComponent(query)}`
      );
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        data?: EbayCategorySearchResult[];
        error?: string;
      };

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Category search failed.');
      }

      const leafCategories = (data.data ?? []).filter(
        (category) => category.isLeaf
      );

      setCategorySearchResults((currentResults) => ({
        ...currentResults,
        [searchKey]: leafCategories,
      }));

      if (leafCategories.length === 0) {
        setCategorySearchErrors((currentErrors) => ({
          ...currentErrors,
          [searchKey]: 'No leaf categories found. Try a more specific search.',
        }));
      }
    } catch (error) {
      setCategorySearchResults((currentResults) => ({
        ...currentResults,
        [searchKey]: [],
      }));
      setCategorySearchErrors((currentErrors) => ({
        ...currentErrors,
        [searchKey]:
          error instanceof Error
            ? error.message
            : 'Category search failed. Try again.',
      }));
    } finally {
      setCategorySearchLoading((currentLoading) => ({
        ...currentLoading,
        [searchKey]: false,
      }));
    }
  };

  const updateProductCategory = async (
    index: number,
    selectedCategory: EbayCategorySearchResult
  ) => {
    const product = products[index];
    const previousCategoryName = product?.categoryName;
    const previousCategoryId = product?.categoryId;
    const previousCategoryPath = product?.categoryPath;
    const previousEbayCategoryId = product?.ebayCategoryId;
    const previousEbayCategoryBreadcrumb = product?.ebayCategoryBreadcrumb;

    setCategorySaveError('');
    updateProductPublishState(index, {
      categoryName: selectedCategory.categoryName,
      categoryId: selectedCategory.categoryId,
      categoryPath: selectedCategory.categoryPath,
      ebayCategoryId: selectedCategory.categoryId,
      ebayCategoryBreadcrumb: selectedCategory.categoryPath,
    });

    if (!product?.id) {
      return;
    }

    try {
      console.log('Saving category:', {
        categoryName: selectedCategory.categoryName,
        categoryId: selectedCategory.categoryId,
        categoryPath: selectedCategory.categoryPath,
      });

      const res = await fetch('/api/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: product.id,
          updates: {
            categoryName: selectedCategory.categoryName,
            categoryId: selectedCategory.categoryId,
            categoryPath: selectedCategory.categoryPath,
            ebayCategoryId: selectedCategory.categoryId,
            ebayCategoryBreadcrumb: selectedCategory.categoryPath,
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
      updateProductPublishState(index, {
        categoryName: previousCategoryName ?? '',
        categoryId: previousCategoryId ?? null,
        categoryPath: previousCategoryPath ?? null,
        ebayCategoryId: previousEbayCategoryId ?? null,
        ebayCategoryBreadcrumb: previousEbayCategoryBreadcrumb ?? null,
      });
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
    setSelectedIds((currentIds) =>
      currentIds.filter((selectedId) => selectedId !== id)
    );
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

    const errors: string[] = [];

    if (!product.title) errors.push('Title is required');
    if (!product.price) errors.push('Price is required');
    if (!product.categoryName) errors.push('Category is required');
    if (!getProductCategoryId(product)) {
      errors.push('Select an eBay category with a leaf category ID');
    }
    if (!product.quantity || product.quantity < 1) {
      errors.push('Quantity must be at least 1');
    }

    if (errors.length > 0) {
      const message = errors.join('\n');
      alert(message);
      setPublishAlert({
        type: 'error',
        message,
        productIndex,
      });
      updateProductPublishState(productIndex, {
        publishStatus: product.publishStatus || 'idle',
        publish_status: product.publish_status ?? 'draft',
        publish_error: message,
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
        publishStatus: product.publishStatus || 'idle',
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
      publishStatus: 'pending',
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
            categoryId: getProductCategoryId(product),
            categoryPath: getProductCategoryPath(product),
            ebayCategoryId: product.ebayCategoryId,
            ebayCategoryBreadcrumb: product.ebayCategoryBreadcrumb,
            quantity: product.quantity || 1,
          },
          categoryName: product.categoryName,
          categoryId: getProductCategoryId(product),
          categoryPath: getProductCategoryPath(product),
          ebayCategoryId: product.ebayCategoryId,
          ebayCategoryBreadcrumb: product.ebayCategoryBreadcrumb,
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
          publishStatus: 'error',
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
        publishStatus: 'published',
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
        publishStatus: 'error',
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
        product.publishStatus !== 'published' &&
        !product.ebay_item_id
    );

    publishProduct(nextIndex >= 0 ? nextIndex : 0);
  };

  const handleSelectProduct = (productId: string, checked: boolean) => {
    setSelectedIds((currentIds) => {
      if (checked) {
        return currentIds.includes(productId)
          ? currentIds
          : [...currentIds, productId];
      }

      return currentIds.filter((id) => id !== productId);
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(
        products
          .map((product) => getProductSelectionId(product))
          .filter((id): id is string => Boolean(id))
      );
      return;
    }

    setSelectedIds([]);
  };

  const handleBulkPublish = async () => {
    if (selectedIds.length === 0) {
      setPublishAlert({
        type: 'error',
        message: 'Select at least one product to publish.',
      });
      return;
    }

    setLoading(true);
    setBulkPublishing(true);
    setPublishAlert(null);

    try {
      for (const id of selectedIds) {
        const productIndex = products.findIndex(
          (product) => getProductSelectionId(product) === id
        );

        if (productIndex >= 0) {
          await publishProduct(productIndex);
        }
      }
    } finally {
      setBulkPublishing(false);
      setLoading(false);
    }
  };

  const selectableProductIds = products
    .map((product) => getProductSelectionId(product))
    .filter((id): id is string => Boolean(id));
  const allProductsSelected =
    selectableProductIds.length > 0 &&
    selectableProductIds.every((id) => selectedIds.includes(id));

  return (
    <div className="px-4 py-6 text-slate-100 sm:px-6 sm:py-8 lg:px-8">
      {loading && (
        <div className="loader-overlay" role="status" aria-live="polite">
          <div className="spinner" />
          <p>{bulkPublishing ? 'Publishing selected products...' : 'Fetching products...'}</p>
        </div>
      )}

      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 border-b border-white/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-1 text-sm font-medium text-cyan-300">
              Inventory admin
            </p>
            <h1 className="text-2xl font-semibold leading-tight text-white sm:text-3xl">
              {PRODUCT_STATUS_TITLES[status]}
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

        <div className="mb-6 flex flex-wrap gap-2">
          {PRODUCT_STATUS_TABS.map((tab) => {
            const isActive = tab.status === status;

            return (
              <Link
                key={tab.status}
                href={tab.href}
                className={`min-h-10 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  isActive
                    ? 'bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-950/30'
                    : 'border border-white/10 bg-white/[0.06] text-slate-100 hover:bg-white/10'
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>

        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap">
          <label className="flex min-h-11 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-4 py-2.5 text-sm font-semibold text-slate-100 lg:w-auto">
            <input
              type="checkbox"
              checked={allProductsSelected}
              onChange={(e) => handleSelectAll(e.target.checked)}
              disabled={
                publishingProductId !== null ||
                bulkPublishing ||
                selectableProductIds.length === 0
              }
              className="h-4 w-4 rounded border-white/20 bg-slate-950 text-violet-500"
            />
            Select All
          </label>

          <button
            onClick={handleBulkPublish}
            disabled={
              publishingProductId !== null ||
              bulkPublishing ||
              selectedIds.length === 0
            }
            className="min-h-11 rounded-lg border border-violet-300/30 bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:opacity-60 lg:w-auto"
          >
            {bulkPublishing
              ? `Publishing Selected (${selectedIds.length})`
              : `Publish Selected (${selectedIds.length})`}
          </button>

          <button
            onClick={exportCSV}
            disabled={publishingProductId !== null || bulkPublishing}
            className="min-h-11 rounded-lg border border-cyan-300/30 bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-950/30 transition hover:bg-cyan-300 disabled:opacity-60 lg:w-auto"
          >
            Export CSV
          </button>

          <button
            onClick={saveChanges}
            disabled={saving || publishingProductId !== null || bulkPublishing}
            className="min-h-11 rounded-lg border border-emerald-300/30 bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-60 lg:w-auto"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>

          <button
            onClick={publishFirstProduct}
            disabled={
              publishingProductId !== null || bulkPublishing || products.length === 0
            }
            className="min-h-11 rounded-lg border border-violet-300/30 bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-400 disabled:opacity-60 lg:w-auto"
          >
            {publishingProductId !== null || bulkPublishing
              ? 'Publishing...'
              : publishAlert?.type === 'error'
                ? 'Retry publish'
                : 'Publish to eBay'}
          </button>

          <a
            href="/dashboard"
            className={`min-h-11 rounded-lg border border-white/10 bg-white/[0.06] px-4 py-2.5 text-center text-sm font-semibold text-slate-100 transition hover:bg-white/10 lg:w-auto ${
              publishingProductId !== null || bulkPublishing
                ? 'pointer-events-none opacity-60'
                : ''
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
                  disabled={
                    publishingProductId !== null ||
                    bulkPublishing ||
                    products.length === 0
                  }
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

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {paginatedProducts.map((p, pageIndex) => {
            const i = (visiblePage - 1) * itemsPerPage + pageIndex;
            const selectionId = getProductSelectionId(p);
            const productPublishStatus = p.publishStatus || 'idle';
            const isPublishing = productPublishStatus === 'pending';
            const isPublished = productPublishStatus === 'published';
            const validation = validationResults[i];
            const publishStatus = getPublishStatusLabel(productPublishStatus);
            const inputBaseClass =
              'input mb-3 min-h-11 w-full min-w-0 rounded-lg border bg-slate-950/80 px-3 py-2.5 text-base text-slate-100 outline-none transition focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20 disabled:opacity-60 sm:text-sm';
            const titleInputClass = `${inputBaseClass} ${
              !p.title ? 'border-red-500' : 'border-white/10'
            }`;
            const priceInputClass = `${inputBaseClass} ${
              !p.price ? 'border-red-500' : 'border-white/10'
            }`;
            const categoryInputClass = `${inputBaseClass} ${
              !p.categoryName || !getProductCategoryId(p)
                ? 'border-red-500'
                : 'border-white/10'
            }`;
            const quantityInputClass = `${inputBaseClass} ${
              !p.quantity ? 'border-red-500' : 'border-white/10'
            }`;
            const categorySearchKey = getCategorySearchKey(p, i);
            const categorySearchQuery =
              categorySearchQueries[categorySearchKey] ?? '';
            const currentCategorySearchResults =
              categorySearchResults[categorySearchKey] ?? [];
            const currentCategorySearchError =
              categorySearchErrors[categorySearchKey];
            const isSearchingCategory =
              categorySearchLoading[categorySearchKey] ?? false;
            const selectedCategoryId = getProductCategoryId(p);
            const selectedCategoryPath = getProductCategoryPath(p);

            return (
              <div
                key={p.id ?? i}
                className={`w-full max-w-sm mx-auto ${
                  paginatedProducts.length === 1
                    ? 'sm:col-span-2 lg:col-span-1 lg:col-start-2'
                    : ''
                }`}
              >
                <div className="bg-gray-900 rounded-xl overflow-hidden shadow-md">
                  <label className="flex items-center gap-2 border-b border-white/10 px-4 py-3 text-sm font-medium text-slate-200">
                    <input
                      type="checkbox"
                      checked={
                        selectionId ? selectedIds.includes(selectionId) : false
                      }
                      onChange={(e) => {
                        if (selectionId) {
                          handleSelectProduct(selectionId, e.target.checked);
                        }
                      }}
                      disabled={!selectionId || bulkPublishing || isPublishing}
                      className="h-4 w-4 rounded border-white/20 bg-slate-950 text-violet-500"
                    />
                    Select
                  </label>

                  {p.images?.[0] && (
                    <img
                      src={p.images[0]}
                      alt={p.title ? `${p.title} product image` : 'Product image'}
                      className="w-full h-64 object-cover"
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

                  <div className="p-4 sm:p-5">
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
                          bulkPublishing ||
                          ((!validation.valid || !selectedCategoryId) &&
                            !isPublished)
                        }
                        className="min-h-10 rounded-lg bg-violet-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-violet-400 disabled:opacity-60 sm:w-auto"
                      >
                        {isPublishing
                          ? 'Publishing...'
                          : isPublished
                            ? 'Sync'
                          : productPublishStatus === 'error'
                            ? 'Retry'
                            : 'Publish'}
                      </button>
                      <button
                        onClick={() => p.id && deleteProduct(String(p.id))}
                        disabled={bulkPublishing || isPublishing || !p.id}
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

                {!selectedCategoryId && !isPublished && (
                  <p className="mb-3 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-200">
                    Select an eBay leaf category.
                  </p>
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
                  Search eBay Category
                </label>
                <div className="mb-3 flex gap-2">
                  <input
                    value={categorySearchQuery}
                    onChange={(e) =>
                      setCategorySearchQueries((currentQueries) => ({
                        ...currentQueries,
                        [categorySearchKey]: e.target.value,
                      }))
                    }
                    placeholder="Search eBay category..."
                    disabled={isPublishing || isSearchingCategory}
                    className={categoryInputClass}
                  />
                  <button
                    type="button"
                    onClick={() => searchEbayCategories(i)}
                    disabled={isPublishing || isSearchingCategory}
                    className="mb-3 min-h-11 rounded-lg bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-60"
                  >
                    {isSearchingCategory ? 'Searching...' : 'Search'}
                  </button>
                </div>

                {selectedCategoryId && (
                  <dl className="mb-3 space-y-1 rounded-lg border border-cyan-400/30 bg-cyan-400/10 p-3 text-xs text-cyan-100">
                    <div>
                      <dt className="font-semibold">Selected eBay category</dt>
                      <dd className="mt-1 break-words">
                        {selectedCategoryPath || p.categoryName}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-semibold">Category ID</dt>
                      <dd>{selectedCategoryId}</dd>
                    </div>
                  </dl>
                )}

                {currentCategorySearchError && (
                  <p className="mb-3 rounded-lg border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-sm text-amber-100">
                    {currentCategorySearchError}
                  </p>
                )}

                {currentCategorySearchResults.length > 0 && (
                  <div className="mb-3 space-y-2">
                    {currentCategorySearchResults.map((category) => (
                      <button
                        key={category.categoryId}
                        type="button"
                        onClick={() => updateProductCategory(i, category)}
                        disabled={isPublishing}
                        className="block w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-left text-sm text-slate-100 transition hover:border-cyan-300/50 hover:bg-cyan-400/10 disabled:opacity-60"
                      >
                        <span className="block font-semibold">
                          {category.categoryName}
                        </span>
                        <span className="mt-1 block break-words text-xs text-slate-400">
                          {category.categoryPath}
                        </span>
                        <span className="mt-1 block text-xs text-cyan-200">
                          ID: {category.categoryId}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                <label className="mb-1 block text-sm font-semibold text-slate-200">Title</label>
                <input
                  value={p.title ?? ''}
                  onChange={(e) => updateProductField(i, 'title', e.target.value)}
                  className={titleInputClass}
                />

                <label className="mb-1 block text-sm font-semibold text-slate-200">Price</label>
                <input
                  value={p.price ?? ''}
                  onChange={(e) => updateProductField(i, 'price', e.target.value)}
                  className={priceInputClass}
                />

                <label className="mb-1 block text-sm font-semibold text-slate-200">Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={p.quantity || 1}
                  onChange={(e) =>
                    updateProductField(
                      i,
                      'quantity',
                      parseInt(e.target.value) || 1
                    )
                  }
                  className={quantityInputClass}
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
                </div>
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
