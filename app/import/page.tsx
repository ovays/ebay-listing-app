'use client';

/* eslint-disable @next/next/no-img-element */
import { useState } from 'react';
import {
  getProductValidationSummary,
  validateProduct,
} from '@/lib/product-validation';

interface Product {
  title: string;
  price: string;
  images: string[];
  description: string;
  quantity: number;
}

export default function ImportPage() {
  const [url, setUrl] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [approvedProducts, setApprovedProducts] = useState<Set<number>>(
    new Set()
  );
  const [selectedProducts, setSelectedProducts] = useState<Set<number>>(
    new Set()
  );
  const [brokenImageKeys, setBrokenImageKeys] = useState<Set<string>>(
    new Set()
  );
  const validationResults = products.map((product, index) =>
    validateProduct(product, products, index, brokenImageKeys)
  );
  const validationSummary = getProductValidationSummary(validationResults);

  const toggleApprove = (index: number) => {
    const validation = validationResults[index];

    if (!validation?.valid) {
      setError(
        `Fix this product before approving: ${
          validation?.messages.join(' ') ?? 'Product is invalid.'
        }`
      );
      return;
    }

    const newApproved = new Set(approvedProducts);

    if (newApproved.has(index)) {
      newApproved.delete(index);
    } else {
      newApproved.add(index);
    }

    setApprovedProducts(newApproved);
  };

  const toggleSelect = (index: number) => {
    if (!validationResults[index]?.valid) {
      setError('Fix this product before selecting it.');
      return;
    }

    const newSelected = new Set(selectedProducts);

    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }

    setSelectedProducts(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedProducts.size === validationSummary.valid) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(
        new Set(
          products
            .map((_, i) => i)
            .filter((index) => validationResults[index]?.valid)
        )
      );
    }
  };

  const approveSelected = () => {
    const newApproved = new Set(approvedProducts);
    let approvedCount = 0;

    selectedProducts.forEach((index) => {
      if (validationResults[index]?.valid) {
        newApproved.add(index);
        approvedCount += 1;
      }
    });

    if (approvedCount === 0) {
      setError('Select at least one valid product to approve.');
      return;
    }

    setError('');
    setApprovedProducts(newApproved);
  };

  const saveApproved = async () => {
    if (approvedProducts.size === 0) {
      setError('No approved products to save');
      return;
    }

    const invalidApproved = [...approvedProducts].filter(
      (index) => !validationResults[index]?.valid
    );

    if (invalidApproved.length > 0) {
      setError('Fix invalid approved products before saving them.');
      setApprovedProducts(
        new Set(
          [...approvedProducts].filter(
            (index) => validationResults[index]?.valid
          )
        )
      );
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const approvedProductsToSave = products
        .filter((_, index) => approvedProducts.has(index))
        .map((product) => ({
          ...product,
          price: parseFloat(product.price.replace(/[^0-9.]/g, '')),
          approved: true,
        }));

      console.log('Sending:', approvedProductsToSave);

      const response = await fetch('/api/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          products: approvedProductsToSave,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to save products');
        return;
      }

      setSuccess('Successfully saved approved products');
      setApprovedProducts(new Set());
      setSelectedProducts(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleFetch = async () => {
    if (!url.trim()) {
      setError('Please enter a URL');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    setProducts([]);
    setApprovedProducts(new Set());
    setSelectedProducts(new Set());
    setBrokenImageKeys(new Set());

    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to fetch products');
        return;
      }

      if (data.success && data.data) {
        setProducts(data.data);
      } else {
        setError('No products found');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-4 py-6 text-slate-100 sm:px-6 sm:py-8 lg:px-8">
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 border-b border-white/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-1 text-sm font-medium text-cyan-300">Product sourcing</p>
            <h1 className="text-2xl font-semibold leading-tight text-white sm:text-3xl">
              Import Products
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              Fetch products from a supplier URL, validate the data, and approve listings for your catalog.
            </p>
          </div>
        </div>

        <section className="mb-6 rounded-xl border border-white/10 bg-slate-900/80 p-4 shadow-2xl shadow-slate-950/30 backdrop-blur sm:mb-8 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste category URL here..."
              className="min-h-11 min-w-0 flex-1 rounded-lg border border-white/10 bg-slate-950/80 px-3 py-2.5 text-base text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/20 sm:px-4 sm:text-sm"
              disabled={loading}
            />
            <button
              onClick={handleFetch}
              disabled={loading}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-cyan-400 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-950/30 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {loading && <span className="spinner spinner-sm" />}
              {loading ? 'Fetching products...' : 'Fetch Products'}
            </button>
          </div>

          {error && (
            <p className="mt-4 break-words rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-200">{error}</p>
          )}
          {success && (
            <p className="mt-4 break-words rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-200">
              {success}
            </p>
          )}
          {loading && (
            <div className="mt-4 flex items-center gap-3 rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-sm text-cyan-100">
              <span className="spinner h-5 w-5 border-2" />
              <span>Fetching products...</span>
            </div>
          )}
        </section>

        {products.length > 0 && (
          <section>
            <h2 className="mb-4 text-xl font-bold sm:text-2xl">
              Found {products.length} Products
            </h2>

            <div className="mb-6 rounded-xl border border-white/10 bg-slate-900/80 p-4 shadow-2xl shadow-slate-950/30 backdrop-blur sm:p-5">
              <div className="mb-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4 lg:grid-cols-7">
                <div className="rounded-lg bg-emerald-400/10 px-3 py-2 text-emerald-200 ring-1 ring-emerald-400/20">
                  Valid: {validationSummary.valid}
                </div>
                <div className="rounded-lg bg-red-400/10 px-3 py-2 text-red-200 ring-1 ring-red-400/20">
                  Invalid: {validationSummary.invalid}
                </div>
                <div className="rounded-lg bg-white/[0.04] px-3 py-2 text-slate-300 ring-1 ring-white/10">
                  Missing title: {validationSummary.missingTitle}
                </div>
                <div className="rounded-lg bg-white/[0.04] px-3 py-2 text-slate-300 ring-1 ring-white/10">
                  Bad price: {validationSummary.invalidPrice}
                </div>
                <div className="rounded-lg bg-white/[0.04] px-3 py-2 text-slate-300 ring-1 ring-white/10">
                  No description: {validationSummary.missingDescription}
                </div>
                <div className="rounded-lg bg-white/[0.04] px-3 py-2 text-slate-300 ring-1 ring-white/10">
                  Image issues:{' '}
                  {validationSummary.missingImages +
                    validationSummary.brokenImages}
                </div>
                <div className="rounded-lg bg-white/[0.04] px-3 py-2 text-slate-300 ring-1 ring-white/10">
                  Duplicates: {validationSummary.duplicates}
                </div>
              </div>

              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <label className="flex min-w-0 cursor-pointer items-center gap-2 font-semibold">
                  <input
                    type="checkbox"
                    checked={
                      selectedProducts.size === validationSummary.valid &&
                      validationSummary.valid > 0
                    }
                    onChange={toggleSelectAll}
                    disabled={validationSummary.valid === 0}
                    className="h-5 w-5 shrink-0 cursor-pointer accent-cyan-400"
                  />
                  <span className="min-w-0 break-words text-sm sm:text-base">
                    Select Valid ({selectedProducts.size}/
                    {validationSummary.valid})
                  </span>
                </label>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:ml-auto md:flex md:flex-wrap">
                  {selectedProducts.size > 0 && (
                    <button
                      onClick={approveSelected}
                    className="min-h-11 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-400 md:w-auto"
                    >
                      Approve Selected ({selectedProducts.size})
                    </button>
                  )}
                  {approvedProducts.size > 0 && (
                    <button
                      onClick={saveApproved}
                      disabled={loading}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60 md:w-auto"
                    >
                      {loading && <span className="spinner spinner-sm" />}
                      {loading
                        ? 'Saving...'
                        : `Save Approved (${approvedProducts.size})`}
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-2 xl:grid-cols-3">
              {products.map((product, index) => {
                const isApproved = approvedProducts.has(index);
                const isSelected = selectedProducts.has(index);
                const validation = validationResults[index];

                return (
                  <article
                    key={index}
                    className={`min-w-0 overflow-hidden rounded-xl bg-slate-900/80 shadow-2xl shadow-slate-950/30 transition hover:-translate-y-0.5 hover:shadow-slate-950/50 ${
                      isApproved && validation.valid
                        ? 'border-2 border-emerald-400'
                        : validation.valid
                          ? 'border-2 border-white/10'
                          : 'border-2 border-red-400/40'
                    } ${isSelected ? 'ring-2 ring-cyan-300' : ''}`}
                  >
                    {product.images.length > 0 && (
                      <div className="aspect-[4/3] w-full overflow-hidden bg-slate-950">
                        <img
                          src={product.images[0]}
                          alt={product.title}
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            e.currentTarget.src = '';
                            e.currentTarget.classList.add('hidden');
                            setBrokenImageKeys((currentKeys) => {
                              const nextKeys = new Set(currentKeys);
                              nextKeys.add(
                                `${index}:0:${product.images[0] ?? ''}`
                              );
                              return nextKeys;
                            });
                          }}
                        />
                      </div>
                    )}

                    <div className="p-4">
                      <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex min-w-0 flex-1 items-start gap-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(index)}
                            disabled={!validation.valid}
                            className="mt-1 h-5 w-5 shrink-0 cursor-pointer accent-cyan-400 disabled:opacity-50"
                          />
                          <h3 className="min-w-0 break-words text-base font-semibold leading-snug text-white sm:text-lg">
                            {product.title}
                          </h3>
                        </div>
                        <span
                          className={`w-fit shrink-0 rounded px-2 py-1 text-xs ${
                            validation.valid
                              ? 'bg-emerald-400/10 text-emerald-200 ring-1 ring-emerald-400/20'
                              : 'bg-red-400/10 text-red-200 ring-1 ring-red-400/20'
                          }`}
                        >
                          {validation.valid ? 'Valid' : 'Needs fixes'}
                        </span>
                        {isApproved && validation.valid && (
                          <span className="w-fit shrink-0 rounded bg-emerald-500 px-2 py-1 text-xs text-white">
                            Approved
                          </span>
                        )}
                      </div>

                      <p className="mb-2 break-words font-semibold text-cyan-300">
                        {product.price}
                      </p>
                      <p className="mb-4 line-clamp-3 break-words text-sm text-slate-400">
                        {product.description}
                      </p>
                      {!validation.valid && (
                        <ul className="mb-4 space-y-1 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-200">
                          {validation.messages.map((message) => (
                            <li key={message}>{message}</li>
                          ))}
                        </ul>
                      )}
                      <button
                        onClick={() => toggleApprove(index)}
                        disabled={!validation.valid}
                        className={`min-h-11 w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition disabled:opacity-60 ${
                          isApproved
                            ? 'bg-emerald-500 text-white hover:bg-emerald-400'
                            : 'bg-white/[0.06] text-slate-100 ring-1 ring-white/10 hover:bg-white/10'
                        }`}
                      >
                        {isApproved ? 'Approved' : 'Approve'}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {!loading && products.length === 0 && !error && (
          <div className="py-10 text-center text-sm text-slate-500 sm:py-12 sm:text-base">
            <p>Enter a URL and click &quot;Fetch Products&quot; to get started</p>
          </div>
        )}
      </div>
    </div>
  );
}
