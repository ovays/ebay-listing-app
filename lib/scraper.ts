import axios from 'axios';
import * as cheerio from 'cheerio';

interface Product {
  title: string;
  price: string;
  images: string[];
  description: string;
  quantity: number;
}

export async function scrapeCategory(categoryUrl: string): Promise<Product[]> {
  try {
    // Extract product links from all pages
    const productLinks: string[] = [];
    let currentPageUrl = categoryUrl;
    let pageNumber = 1;

    while (currentPageUrl) {
      console.log(`Scraping category page ${pageNumber}: ${currentPageUrl}`);

      const categoryResponse = await axios.get(currentPageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const $ = cheerio.load(categoryResponse.data);

      // Extract product links from current page
      $('a.woocommerce-LoopProduct-link').each((_, element) => {
        const href = $(element).attr('href');
        if (href && href.includes('/product/') && !productLinks.includes(href)) {
          productLinks.push(href);
        }
      });

      console.log(`Found ${productLinks.length} total product links so far`);

      // Check for next page
      const nextPageUrl = $('a.next.page-numbers').attr('href');
      if (nextPageUrl) {
        currentPageUrl = nextPageUrl;
        pageNumber++;
      } else {
        currentPageUrl = '';
      }
    }

    console.log(`Found ${productLinks.length} product links across all pages`);

    // Scrape each product page
    const products: Product[] = [];

    for (const link of productLinks) {
      console.log(`Scraping product URL: ${link}`);
      try {
        const productResponse = await axios.get(link, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });

        const productPage = cheerio.load(productResponse.data);

        // Extract title
        const title = productPage('h1.product_title').first().text().trim();

        // Extract price
        const price = productPage('.price').first().text().trim();

        // Extract images
        const uniqueImages = new Set<string>();
        productPage('.woocommerce-product-gallery img').each((_, el) => {
          const src =
            productPage(el).attr('data-src') ||
            productPage(el).attr('data-large_image') ||
            productPage(el).attr('src');

          if (src) {
            if (
              !src.includes('100x100') &&
              !src.includes('data:image') &&
              !src.includes('svg')
            ) {
              uniqueImages.add(src);
            }
          }
        });

        const images = Array.from(uniqueImages);

        const description = productPage('.woocommerce-Tabs-panel--description').text().trim();
        const truncatedDescription = description.replace(/\s+/g, ' ').substring(0, 1000).trim();
        const stockText = productPage('.stock.in-stock').text();
        let quantity = 1;

        if (stockText) {
          const match = stockText.match(/\d+/);

          if (match) {
            quantity = parseInt(match[0], 10);
          }
        }

        console.log('Parsed stock:', stockText, '→ quantity:', quantity);

        console.log(`Product title: ${title}`);
        console.log(`Product images: ${images.length}`);

        if (title && price && images.length > 0) {
          products.push({
            title,
            price,
            images,
            description: truncatedDescription,
            quantity
          });
        } else {
          console.log(`Skipping invalid product: ${link}`);
        }

      } catch (productError) {
        console.error(`Error scraping product ${link}:`, productError);
        continue;
      }
    }

    console.log(`Products before cleanup: ${products.length}`);
    const uniqueProducts: Product[] = [];
    const seenKeys = new Set<string>();

    for (const product of products) {
      const key = `${product.title}|${product.price}|${product.images.join(',')}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        uniqueProducts.push(product);
      }
    }

    console.log(`Products after cleanup: ${uniqueProducts.length}`);
    return uniqueProducts;

  } catch (error) {
    console.error('Error scraping category:', error);
    throw error;
  }
}

export async function scrapeToJson(categoryUrl: string): Promise<string> {
  const products = await scrapeCategory(categoryUrl);
  return JSON.stringify(products, null, 2);
}
