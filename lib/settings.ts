import { supabase } from './supabase';

export interface SystemSettings {
    aplicar_isr: boolean;
    mostrar_top_productos: boolean;
    mostrar_ganancias: boolean;
}

// 1. Obtener ajustes del usuario
export const getSystemSettings = async (userId: string): Promise<SystemSettings | null> => {
    const { data, error } = await supabase
        .from('configuracion_sistema')
        .select('aplicar_isr, mostrar_top_productos, mostrar_ganancias')
        .eq('user_id', userId)
        .single();

    if (error && error.code === 'PGRST116') {
        // Si no existe, creamos uno por defecto
        const { data: newData } = await supabase
            .from('configuracion_sistema')
            .insert([{ user_id: userId }])
            .select()
            .single();
        return newData;
    }
    return data;
};

// 2. Actualizar un ajuste específico
export const updateSetting = async (userId: string, setting: Partial<SystemSettings>) => {
    const { error } = await supabase
        .from('configuracion_sistema')
        .update(setting)
        .eq('user_id', userId);
    
    return { success: !error, error };
};
