import { LoginForm } from "@/components/auth/login-form";
import { supabaseConfig } from "@/lib/supabase/config";
export default function LoginPage() { return <LoginForm configured={Boolean(supabaseConfig())} />; }
