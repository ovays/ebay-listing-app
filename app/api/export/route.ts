import { supabase } from '@/lib/supabase';

type ExportProduct = {
  title?: string;
  price?: string | number;
  description?: string;
  images?: string[];
};

export async function GET() {
  const { data, error } = await supabase.from('products').select('*');

  if (error) {
    return new Response('Error fetching products', { status: 500 });
  }

  // CSV headers (simple version)
  let csv = 'Title,Price,Description,ImageURL\n';

  data.forEach((p: ExportProduct) => {
    const title = `"${p.title}"`;
    const price = p.price;
    const desc = `"${p.description?.replace(/"/g, '""')}"`;
    const image = p.images?.[0] || '';

    csv += `${title},${price},${desc},${image}\n`;
  });

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename=ebay-products.csv',
    },
  });
}
