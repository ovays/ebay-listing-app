import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log('BODY:', body);

    const products = body.products;

    if (!products || !Array.isArray(products) || products.length === 0) {
      return Response.json({
        success: false,
        error: 'Invalid request format',
      });
    }

    console.log('FINAL PRODUCTS:', products);

    const { data, error } = await supabase
      .from('products')
      .insert(products)
      .select();

    console.log('INSERT DATA:', data);
    console.log('INSERT ERROR:', error);

    if (error) {
      return Response.json({ success: false, error });
    }

    return Response.json({ success: true, data });
  } catch (err) {
    console.log('API ERROR:', err);
    return Response.json({ success: false, error: 'Server error' });
  }
}