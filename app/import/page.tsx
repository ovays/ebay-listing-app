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
    <main className="min-h-screen overflow-x-hidden bg-gray-50 px-4 py-6 text-slate-950 sm:px-6 sm:py-8 lg:px-8">
      <div className="mx-auto w-full max-w-7xl">
        <h1 className="mb-5 text-2xl font-bold leading-tight sm:mb-8 sm:text-3xl">
          Import Products
        </h1>

        <section className="mb-6 rounded-lg bg-white p-4 shadow sm:mb-8 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste category URL here..."
              className="min-h-11 min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 sm:px-4 sm:text-sm"
              disabled={loading}
            />
            <button
              onClick={handleFetch}
              disabled={loading}
              className="min-h-11 w-full rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:bg-gray-400 sm:w-auto"
            >
              {loading ? 'Fetching...' : 'Fetch Products'}
            </button>
          </div>

          {error && (
            <p className="mt-4 break-words text-sm text-red-600">{error}</p>
          )}
          {success && (
            <p className="mt-4 break-words text-sm text-green-600">
              {success}
            </p>
          )}
        </section>

        {products.length > 0 && (
          <section>
            <h2 className="mb-4 text-xl font-bold sm:text-2xl">
              Found {products.length} Products
            </h2>

            <div className="mb-6 rounded-lg bg-white p-4 shadow sm:p-5">
              <div className="mb-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4 lg:grid-cols-7">
                <div className="rounded-md bg-green-50 px-3 py-2 text-green-800">
                  Valid: {validationSummary.valid}
                </div>
                <div className="rounded-md bg-red-50 px-3 py-2 text-red-800">
                  Invalid: {validationSummary.invalid}
                </div>
                <div className="rounded-md bg-slate-50 px-3 py-2 text-slate-700">
                  Missing title: {validationSummary.missingTitle}
                </div>
                <div className="rounded-md bg-slate-50 px-3 py-2 text-slate-700">
                  Bad price: {validationSummary.invalidPrice}
                </div>
                <div className="rounded-md bg-slate-50 px-3 py-2 text-slate-700">
                  No description: {validationSummary.missingDescription}
                </div>
                <div className="rounded-md bg-slate-50 px-3 py-2 text-slate-700">
                  Image issues:{' '}
                  {validationSummary.missingImages +
                    validationSummary.brokenImages}
                </div>
                <div className="rounded-md bg-slate-50 px-3 py-2 text-slate-700">
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
                    className="h-5 w-5 shrink-0 cursor-pointer"
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
                      className="min-h-11 rounded-md bg-green-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-green-700 md:w-auto"
                    >
                      Approve Selected ({selectedProducts.size})
                    </button>
                  )}
                  {approvedProducts.size > 0 && (
                    <button
                      onClick={saveApproved}
                      disabled={loading}
                      className="min-h-11 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:bg-gray-400 md:w-auto"
                    >
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
                    className={`min-w-0 overflow-hidden rounded-lg bg-white shadow transition hover:shadow-lg ${
                      isApproved && validation.valid
                        ? 'border-2 border-green-500'
                        : validation.valid
                          ? 'border-2 border-transparent'
                          : 'border-2 border-red-200'
                    } ${isSelected ? 'ring-2 ring-blue-400' : ''}`}
                  >
                    {product.images.length > 0 && (
                      <div className="aspect-[4/3] w-full overflow-hidden bg-gray-200">
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
                            className="mt-1 h-5 w-5 shrink-0 cursor-pointer disabled:opacity-50"
                          />
                          <h3 className="min-w-0 break-words text-base font-bold leading-snug sm:text-lg">
                            {product.title}
                          </h3>
                        </div>
                        <span
                          className={`w-fit shrink-0 rounded px-2 py-1 text-xs ${
                            validation.valid
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {validation.valid ? 'Valid' : 'Needs fixes'}
                        </span>
                        {isApproved && validation.valid && (
                          <span className="w-fit shrink-0 rounded bg-green-500 px-2 py-1 text-xs text-white">
                            Approved
                          </span>
                        )}
                      </div>

                      <p className="mb-2 break-words font-semibold text-blue-600">
                        {product.price}
                      </p>
                      <p className="mb-4 line-clamp-3 break-words text-sm text-gray-600">
                        {product.description}
                      </p>
                      {!validation.valid && (
                        <ul className="mb-4 space-y-1 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                          {validation.messages.map((message) => (
                            <li key={message}>{message}</li>
                          ))}
                        </ul>
                      )}
                      <button
                        onClick={() => toggleApprove(index)}
                        disabled={!validation.valid}
                        className={`min-h-11 w-full rounded-md px-4 py-2.5 text-sm font-medium transition disabled:opacity-60 ${
                          isApproved
                            ? 'bg-green-600 text-white hover:bg-green-700'
                            : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
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
          <div className="py-10 text-center text-sm text-gray-500 sm:py-12 sm:text-base">
            <p>Enter a URL and click &quot;Fetch Products&quot; to get started</p>
          </div>
        )}
      </div>
    </main>
  );
}
