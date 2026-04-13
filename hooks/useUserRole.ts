// hooks/useUserRole.ts
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export function useUserRole() {
  const [rol, setRol] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null); // <--- AGREGAMOS ESTO
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function getRole() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase
          .from('perfiles')
          .select('*') // <--- SELECCIONAMOS TODO
          .eq('id', user.id)
          .single();

        if (data) {
          setRol(data.rol);
          setProfile(data); // <--- GUARDAMOS EL PERFIL COMPLETO
        }
      }
      setLoading(false);
    }
    getRole();
  }, []);

  return { rol, profile, loading }; // <--- AHORA REGRESA EL PERFIL
}
