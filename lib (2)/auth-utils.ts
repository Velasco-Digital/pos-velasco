import { supabase } from './supabase';

export const getUsuarioPerfil = async (userId: string) => {
  const { data, error } = await supabase
    .from('perfiles')
    .select('rol, empresa_id')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Error al obtener perfil:', error.message);
    return null;
  }

  return data; // Esto te devuelve { rol: 'admin', empresa_id: '...' }
};
