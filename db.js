import { createClient } from '@supabase/supabase-js';
import 'dotenv/config'; // Hỗ trợ đọc file .env khi chạy cục bộ

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('⚠️ Thiếu SUPABASE_URL hoặc SUPABASE_KEY trong biến môi trường!');
}

export const supabase = createClient(supabaseUrl, supabaseKey);
