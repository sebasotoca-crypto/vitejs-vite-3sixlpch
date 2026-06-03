import { createClient } from '@supabase/supabase-js';

// Aquí pegas la URL que encontraste en "Data API"
const supabaseUrl = 'https://ngscfefdrwvlaxqyvxjo.supabase.co/rest/v1/';

// Aquí pegas el código largo que copiaste de "Publishable key"
const supabaseAnonKey = 'sb_publishable_B_ORX9yKpYYj3sGkTDgn6A_0JwuR2wF';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
