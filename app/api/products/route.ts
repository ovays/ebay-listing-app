import { supabase } from '@/lib/supabase';

export async function GET() {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.log(error);
    return Response.json({ success: false, error });
  }

  return Response.json({ success: true, data });
}