import { supabase } from '@/lib/supabase';

type UpdateBody = {
  id?: string | number;
  updates?: Record<string, unknown>;
  products?: Array<{
    id?: string | number;
    title?: string;
    price?: string | number;
    description?: string;
  }>;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as UpdateBody;

    if (body.id && body.updates && typeof body.updates === 'object') {
      const { data, error } = await supabase
        .from('products')
        .update(body.updates)
        .eq('id', body.id)
        .select();

      if (error) {
        console.log('UPDATE ERROR:', error);
        return Response.json({ success: false, error }, { status: 500 });
      }

      return Response.json({ success: true, data });
    }

    if (Array.isArray(body.products)) {
      const updates = [];

      for (const product of body.products) {
        const { id, title, price, description } = product;

        if (!id) {
          continue;
        }

        const { data, error } = await supabase
          .from('products')
          .update({
            title,
            price,
            description,
          })
          .eq('id', id)
          .select();

        if (error) {
          console.log('UPDATE ERROR:', error);
          return Response.json({ success: false, error }, { status: 500 });
        }

        updates.push(data);
      }

      return Response.json({ success: true, data: updates });
    }

    return Response.json(
      { success: false, error: 'Invalid body' },
      { status: 400 }
    );
  } catch (err) {
    console.log(err);
    return Response.json(
      { success: false, error: 'Server error' },
      { status: 500 }
    );
  }
}
