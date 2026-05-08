import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  let query = supabase
    .from('products')
    .select('*');

  if (status === 'draft') {
    query = query.or(
      'publish_status.is.null,publish_status.eq.draft,publish_status.eq.publishing,publish_status.eq.inventory_created,publish_status.eq.offer_created'
    );
  } else if (status === 'published') {
    query = query.eq('publish_status', 'published');
  } else if (status === 'error') {
    query = query.eq('publish_status', 'error');
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    console.log(error);
    return Response.json({ success: false, error });
  }

  return Response.json({
    success: true,
    data: data.map((product) => ({
      ...product,
      publishStatus:
        product.publish_status === 'published'
          ? 'published'
          : product.publish_status === 'error'
            ? 'error'
            : 'idle',
    })),
  });
}
