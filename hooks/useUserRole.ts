import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getUsuarioPerfil } from '../lib/auth-utils';

export const useUserRole = () => {
  const [rol, setRol] = useState<string | null>(null);
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkUser = async () => {
      // 1. Le preguntamos a Supabase: "¿Quién inició sesión?"
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        // 2. Si hay usuario, buscamos su rol en la tabla de perfiles
        const perfil = await getUsuarioPerfil(user.id);
        if (perfil) {
          setRol(perfil.rol);
          setEmpresaId(perfil.empresa_id);
        }
      }
      setLoading(false);
    };

    checkUser();
  }, []);

  return { rol, empresaId, loading };
};
