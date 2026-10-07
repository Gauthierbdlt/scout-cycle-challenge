// Re-export the singleton Supabase client to ensure consistent authentication session across the entire app
export { supabase } from "@/integrations/supabase/client";
import { supabase } from "@/integrations/supabase/client";
export default supabase;
