import { NextResponse } from 'next/server';
import { request as undiciRequest } from 'undici';
import { requireEbayAuth } from '@/lib/ebay/auth';

const EBAY_API_BASE = {
  sandbox: 'https://api.sandbox.ebay.com',
  production: 'https://api.ebay.com',
} as const;

const EBAY_AU_MARKETPLACE_ID = 'EBAY_AU';
const EBAY_AU_CONTENT_LANGUAGE = 'en-AU';

type EbayCategorySuggestion = {
  category?: {
    categoryId?: string;
    categoryName?: string;
  };
  categoryTreeNodeAncestors?: Array<{
    categoryId?: string;
    categoryName?: string;
    categoryTreeNodeLevel?: number;
  }>;
};

type EbayCategorySearchResult = {
  categoryId: string;
  categoryName: string;
  categoryPath: string;
  isLeaf: true;
};

function getCategoryPath(suggestion: EbayCategorySuggestion) {
  const ancestors = [...(suggestion.categoryTreeNodeAncestors ?? [])]
    .sort(
      (left, right) =>
        (left.categoryTreeNodeLevel ?? 0) - (right.categoryTreeNodeLevel ?? 0)
    )
    .map((ancestor) => ancestor.categoryName?.trim())
    .filter((name): name is string => Boolean(name));
  const categoryName = suggestion.category?.categoryName?.trim();

  return [...ancestors, categoryName].filter(Boolean).join(' > ');
}

export async function GET(request: Request) {
  const auth = await requireEbayAuth();

  if (!auth) {
    return NextResponse.json(
      { success: false, error: 'Connect eBay before searching categories.' },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.trim();

  if (!query) {
    return NextResponse.json(
      { success: false, error: 'Search query is required.' },
      { status: 400 }
    );
  }

  const { tokenSet } = auth;
  const ebayBase = EBAY_API_BASE[tokenSet.environment];
  const taxonomyUrl = `${ebayBase}/commerce/taxonomy/v1/category_tree/0/get_category_suggestions?q=${encodeURIComponent(
    query
  )}`;

  const response = await undiciRequest(taxonomyUrl, {
    headers: {
      Authorization: `Bearer ${tokenSet.accessToken}`,
      'Content-Type': 'application/json',
      'Content-Language': EBAY_AU_CONTENT_LANGUAGE,
      'X-EBAY-C-MARKETPLACE-ID': EBAY_AU_MARKETPLACE_ID,
    },
    method: 'GET',
  });
  const responseBody = await response.body.text();

  if (response.statusCode < 200 || response.statusCode >= 300) {
    return NextResponse.json(
      {
        success: false,
        error: 'eBay category search failed.',
        details: responseBody,
      },
      { status: response.statusCode }
    );
  }

  const data = JSON.parse(responseBody || '{}') as {
    categorySuggestions?: EbayCategorySuggestion[];
  };
  const categories = (data.categorySuggestions ?? [])
    .map((suggestion) => {
      const categoryId = suggestion.category?.categoryId?.trim();
      const categoryName = suggestion.category?.categoryName?.trim();
      const categoryPath = getCategoryPath(suggestion);

      if (!categoryId || !categoryName || !categoryPath) {
        return null;
      }

      return {
        categoryId,
        categoryName,
        categoryPath,
        isLeaf: true,
      };
    })
    .filter((category): category is EbayCategorySearchResult =>
      Boolean(category)
    );

  return NextResponse.json({ success: true, data: categories });
}
