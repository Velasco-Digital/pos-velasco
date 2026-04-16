// @ts-nocheck
"use client";
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useUserRole } from '../hooks/useUserRole'; 

export default function VelascoPOS_Ultimate() {
  // 1. Sensor activado con el perfil completo para obtener el empresa_id
  const { rol, profile, loading: cargandoPerfil } = useUserRole();
  
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [vista, setVista] = useState('pos');
  const [carrito, setCarrito] = useState([]);
  const [catalogo, setCatalogo] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [montado, setMontado] = useState(false);
  const [metodoPago, setMetodoPago] = useState('efectivo');
  
  const [fechaConsulta, setFechaConsulta] = useState(new Date().toLocaleDateString('en-CA'));
  const [ticketImpresion, setTicketImpresion] = useState({ items: [], total: 0, fecha: '', vendedor: '', metodo: '' });
  const [nuevoProd, setNuevoProd] = useState({ nombre: '', precio: '', stock: '', barcode: '' });
  const [file, setFile] = useState(null); // Para guardar la foto antes de subirla
  const [pagoCon, setPagoCon] = useState(''); // Cantidad con la que paga el cliente
  const [inputBarras, setInputBarras] = useState('');

  const [proveedores, setProveedores] = useState([]);
  const [compras, setCompras] = useState([]);
  const [nuevoProv, setNuevoProv] = useState({ nombre: '', contacto: '', categoria: '' });
  const [nuevaCompra, setNuevaCompra] = useState({ proveedor_id: '', monto_total: '', detalles: '' });

  const [toast, setToast] = useState({ visible: false, msg: '', tipo: 'success' });

  // --- NUEVA FUNCIÓN: ESTADO DE AJUSTES ---
  const [ajustes, setAjustes] = useState({ aplicar_isr: false, mostrar_top_productos: true, mostrar_ganancias: true });

// --- FUNCIÓN DE CARGA DE IMÁGENES A SUPABASE STORAGE ---
const uploadImagen = async (file) => {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `${profile.empresa_id}/${fileName}`; // Organiza por ID de empresa

    const { error: uploadError } = await supabase.storage
      .from('productos_fotos') // Asegúrate de haber creado este bucket en Supabase
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from('productos_fotos')
      .getPublicUrl(filePath);

    return data.publicUrl; // Nos regresa el link real para la base de datos
  } catch (error) {
    showMsg("Error al subir la imagen", "error");
    return null;
  }
};
  // 2. Control de sesión y carga de datos automática al detectar el perfil
  useEffect(() => {
    setMontado(true);
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
  }, []);

  useEffect(() => {
    if (session && profile?.empresa_id) {
      fetchData();
      cargarAjustes(); // <--- Cargar ajustes al iniciar
    }
  }, [session, profile]);

  const showMsg = (msg, tipo = 'success') => {
    setToast({ visible: true, msg, tipo });
    setTimeout(() => setToast({ visible: false, msg: '', tipo: 'success' }), 2500);
  };

  // --- NUEVA FUNCIÓN: CARGAR AJUSTES DESDE SUPABASE ---
  const cargarAjustes = async () => {
    const { data, error } = await supabase
      .from('configuracion_sistema')
      .select('*')
      .eq('user_id', session.user.id)
      .single();
    
    if (data) {
      setAjustes(data);
    } else if (error && error.code === 'PGRST116') {
      // Si no existe, creamos el registro inicial para este usuario
      const { data: newData } = await supabase
        .from('configuracion_sistema')
        .insert([{ user_id: session.user.id }])
        .select()
        .single();
      if (newData) setAjustes(newData);
    }
  };

  // 3. Consultas filtradas por empresa_id (Cada quien ve lo suyo)
  const fetchData = async () => {
    if (!profile?.empresa_id) return;

    const { data: catData } = await supabase.from('productos')
      .select('*')
      .eq('empresa_id', profile.empresa_id)
      .order('id', { ascending: true });
    if (catData) setCatalogo(catData);
    
    const { data: histData } = await supabase.from('ventas')
      .select('*')
      .eq('empresa_id', profile.empresa_id)
      .order('id', { ascending: false }).limit(500);
    if (histData) setHistorial(histData);

    const { data: provData } = await supabase.from('proveedores')
      .select('*')
      .eq('empresa_id', profile.empresa_id);
    if (provData) setProveedores(provData);

    const { data: compData } = await supabase.from('compras_proveedores')
      .select('*, proveedores(nombre)')
      .eq('empresa_id', profile.empresa_id)
      .order('id', { ascending: false });
    if (compData) setCompras(compData);
  };

  // 4. Login limpio (Sin alertas intrusivas)
  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      showMsg("Credenciales incorrectas", "error");
    } else {
      // Recarga silenciosa
      window.location.reload();
    }
  };

    // Referencia para evitar duplicados del escáner (Anti-rebote)
  const ultimoEscaneo = useRef(0);

  const agregarAlCarrito = (p) => {
    const ahora = Date.now();
    // Si se intenta agregar el mismo producto en menos de 500ms, lo ignoramos
    if (ahora - ultimoEscaneo.current < 500) return;
    ultimoEscaneo.current = ahora;

    if(p.stock <= 0) return showMsg("¡Sin existencias!", "error");
    
    const ex = carrito.find(i => i.id === p.id);
    if (ex) {
      setCarrito(carrito.map(i => i.id === p.id ? {...i, cant: i.cant + 1} : i));
    } else {
      setCarrito([...carrito, {...p, cant: 1}]);
    }
  };


  // 5. Ventas con etiqueta de empresa (IMPLEMENTACIÓN DE AJUSTE ISR)
  const finalizarVenta = async (imprimir = false) => {
    if (carrito.length === 0 || !profile?.empresa_id) return;
    const subtotal = carrito.reduce((a,b)=>a+(b.precio*b.cant), 0);
    
    // Si el ajuste está activo usa 1.16, si no, usa 1 (sin cambios)
    const factorImpuesto = ajustes.aplicar_isr ? 1.16 : 1;
    const totalVenta = subtotal * factorImpuesto;
    
    const { error } = await supabase.from('ventas').insert([{ 
        items: carrito, 
        total: totalVenta, 
        vendedor: session.user.email,
        metodo_pago: metodoPago,
        empresa_id: profile.empresa_id // <--- Etiqueta de dueño
    }]);
    
    if (error) return showMsg("Error de red", "error");
    for (const item of carrito) {
        await supabase.rpc('decrement_stock', { row_id: item.id, amount: item.cant });
    }
    if (imprimir) {
        setTicketImpresion({ items: [...carrito], total: totalVenta, fecha: new Date().toLocaleString(), vendedor: session.user.email, metodo: metodoPago });
        setTimeout(() => { window.print(); setCarrito([]); setPagoCon(''); fetchData(); }, 500);
    } else {
        showMsg("¡VENTA COMPLETADA!");
        setCarrito([]);
        setPagoCon('');
        fetchData();
    }
  };

  // Filtros de interfaz (Calculados en el cliente)
  const catalogoFiltrado = catalogo.filter(p => 
    p.nombre.toLowerCase().includes(inputBarras.toLowerCase()) || 
    p.barcode?.includes(inputBarras)
  );

  const ventasFiltradas = historial.filter(v => {
    const d = new Date(v.fecha);
    return d.toLocaleDateString('en-CA') === fechaConsulta;
  });
  
  const totalCorte = ventasFiltradas.reduce((acc, v) => acc + parseFloat(v.total), 0);
  const gastosFiltrados = compras.filter(c => {
    const d = new Date(c.fecha);
    return d.toLocaleDateString('en-CA') === fechaConsulta;
  });
  
  const totalGastos = gastosFiltrados.reduce((acc, c) => acc + parseFloat(c.monto_total), 0);
  const utilidadNeta = totalCorte - totalGastos;
  const efectivoCorte = ventasFiltradas.filter(v => v.metodo_pago === 'efectivo').reduce((acc, v) => acc + parseFloat(v.total), 0);
  const tarjetaCorte = ventasFiltradas.filter(v => v.metodo_pago === 'tarjeta').reduce((acc, v) => acc + parseFloat(v.total), 0);
  const productosBajos = catalogo.filter(p => p.stock < 5);

  const hoyStr = new Date().toDateString();
  const ultimos7Dias = [...Array(7)].map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toDateString();
  }).reverse();

  const dataGrafica = ultimos7Dias.map(dia => {
    const ventasDelDia = historial.filter(v => new Date(v.fecha).toDateString() === dia);
    
    const totalVenta = ventasDelDia.reduce((acc, v) => acc + parseFloat(v.total), 0);
    
    // CALCULO DE GANANCIA REAL:
    const utilidadReal = ventasDelDia.reduce((acc, v) => {
        const gananciaVenta = v.items?.reduce((subAcc, item) => {
            // Buscamos el producto en el catálogo para saber su precio_compra
            const prodOriginal = catalogo.find(p => p.nombre === item.nombre);
            const costo = prodOriginal?.precio_compra || 0;
            return subAcc + ((item.precio - costo) * item.cant);
        }, 0);
        return acc + gananciaVenta;
    }, 0);

    return { 
        dia: dia.split(' ')[0], 
        total: totalVenta, 
        ganancia: utilidadReal, // <--- Dato nuevo
        esHoy: dia === hoyStr 
    };
});


  const maxVenta = Math.max(...dataGrafica.map(d => d.total), 1);
  const conteoProd = {};
  historial.forEach(v => {
    v.items?.forEach(item => {
        conteoProd[item.nombre] = (conteoProd[item.nombre] || 0) + item.cant;
    });
  });
  const top5 = Object.entries(conteoProd).sort((a,b) => b[1] - a[1]).slice(0, 5);

  // 6. Pantalla de carga profesional (Solo fondo, sin textos feos)
  if ((cargandoPerfil || !montado) && session) {
    return <div className="h-screen bg-slate-900" />; 
  }

  if (!session && montado) {
    return (
      <div className="bg-slate-900 h-screen flex items-center justify-center p-6">
        <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl w-full max-w-md text-center border-t-8 border-blue-600 animate-in zoom-in-95 duration-300">
          <h1 className="text-blue-600 font-black italic text-4xl mb-2 tracking-tighter">VD POS</h1>
          <p className="text-slate-400 text-[10px] uppercase tracking-[0.3em] mb-8 font-bold">Velasco Digital Login</p>
          <input type="email" placeholder="Usuario" className="w-full bg-slate-50 p-5 rounded-2xl mb-4 font-bold outline-none text-black" value={email} onChange={e => setEmail(e.target.value)} />
          <input type="password" placeholder="Clave" className="w-full bg-slate-50 p-5 rounded-2xl mb-8 font-bold outline-none text-black" value={password} onChange={e => setPassword(e.target.value)} />
          <button onClick={handleLogin} className="w-full bg-blue-600 text-white font-black py-5 rounded-2xl shadow-xl hover:bg-blue-700 transition-colors">ACCEDER</button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 h-screen flex flex-col font-sans overflow-hidden text-black">
      
      <style>{`
        @media screen { #tk-gh { display: none !important; } }
        @media print {
            body * { visibility: hidden !important; }
            #tk-gh, #tk-gh * { visibility: visible !important; }
            #tk-gh { position: absolute; left: 0; top: 0; width: 80mm !important; padding: 5mm; font-family: monospace; color: black !important; display: block !important; }
        }
        .toast-enter { transform: translateY(-100px); opacity: 0; }
        .toast-active { transform: translateY(0); opacity: 1; transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
      `}</style>

      {toast.visible && (
        <div className="fixed top-6 left-0 right-0 z-[5000] flex justify-center px-6 pointer-events-none">
            <div className={`toast-active flex items-center gap-3 px-6 py-4 rounded-[2rem] shadow-2xl backdrop-blur-xl border ${toast.tipo === 'success' ? 'bg-white/80 border-emerald-100' : 'bg-red-50/90 border-red-100'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${toast.tipo === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`}>
                    <span className="text-white text-xs">{toast.tipo === 'success' ? '✓' : '✕'}</span>
                </div>
                <p className={`font-black text-[11px] uppercase tracking-wider ${toast.tipo === 'success' ? 'text-emerald-700' : 'text-red-700'}`}>
                    {toast.msg}
                </p>
            </div>
        </div>
      )}

      <div id="tk-gh">
          <center>
            <h2 className="font-bold">VD POS</h2>
            <p style={{fontSize: '9px'}}>Atendió: {ticketImpresion.vendedor}</p>
            <p style={{fontSize: '9px'}}>Pago: {ticketImpresion.metodo.toUpperCase()}</p>
            <p>----------------------------</p>
          </center>
          {ticketImpresion.items.map((it, idx) => (
            <div key={idx} style={{display:'flex', justifyContent:'space-between', fontSize:'12px'}}>
                <span>{it.cant}x {it.nombre}</span><span>${(it.precio*it.cant).toFixed(2)}</span>
            </div>
          ))}
          <p>----------------------------</p>
          <div style={{display:'flex', justifyContent:'space-between', fontWeight:'bold'}}><span>TOTAL:</span><span>${ticketImpresion.total.toFixed(2)}</span></div>
          <center><p style={{fontSize:'9px', marginTop:'15px'}}>{ticketImpresion.fecha}</p></center>
      </div>

      <nav className="bg-slate-900 p-3 flex flex-col sm:flex-row justify-between items-center shadow-xl border-b border-blue-600/30 no-print gap-3">
        <div className="flex flex-col items-start">
            <h1 className="text-blue-500 font-black italic text-xl">VD POS</h1>
            <span className="text-[8px] text-white/50 uppercase font-bold">Sesión: {rol}</span>
        </div>
        <div className="flex gap-1 bg-slate-800 p-1 rounded-2xl w-full sm:w-auto overflow-x-auto">
            {rol === 'admin' && (
                <button onClick={() => setVista('dashboard')} className={`flex-1 sm:px-4 py-2 rounded-xl text-[9px] font-black ${vista === 'dashboard' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>DASHBOARD</button>
            )}
            <button onClick={() => setVista('pos')} className={`flex-1 sm:px-4 py-2 rounded-xl text-[9px] font-black ${vista === 'pos' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>CAJA</button>
            
            {rol === 'admin' && (
                <>
                <button onClick={() => setVista('inventario')} className={`flex-1 sm:px-4 py-2 rounded-xl text-[9px] font-black ${vista === 'inventario' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>STOCK</button>
                <button onClick={() => setVista('proveedores')} className={`flex-1 sm:px-4 py-2 rounded-xl text-[9px] font-black ${vista === 'proveedores' ? 'bg-orange-600 text-white' : 'text-slate-400'}`}>PROVEEDORES</button>
                <button onClick={() => setVista('corte')} className={`flex-1 sm:px-4 py-2 rounded-xl text-[9px] font-black ${vista === 'corte' ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}>CORTE</button>
                {/* BOTON NUEVO: AJUSTES */}
                <button onClick={() => setVista('ajustes')} className={`flex-1 sm:px-4 py-2 rounded-xl text-[9px] font-black ${vista === 'ajustes' ? 'bg-slate-700 text-white' : 'text-slate-400'}`}>AJUSTES</button>
                </>
            )}
        </div>
        <button onClick={() => supabase.auth.signOut().then(()=>window.location.reload())} className="text-red-500 font-bold text-[9px] uppercase">Salir</button>
      </nav>

      {/* VISTA: DASHBOARD */}
      {vista === 'dashboard' && (
        <main className="flex-1 p-4 md:p-8 overflow-y-auto animate-in fade-in">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-blue-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Ventas Hoy</p>
                    <h2 className="text-2xl font-black text-blue-600">${totalCorte.toFixed(2)}</h2>
                </div>
                <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-orange-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Pagos Prov.</p>
                    <h2 className="text-2xl font-black text-orange-600">-${totalGastos.toFixed(2)}</h2>
                </div>
                <div className={`p-6 rounded-[2rem] shadow-sm border ${utilidadNeta >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Utilidad Neta</p>
                    <h2 className={`text-2xl font-black ${utilidadNeta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>${utilidadNeta.toFixed(2)}</h2>
                </div>
                <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-red-100">
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Alertas Stock</p>
                    <h2 className="text-2xl font-black text-red-600">{productosBajos.length} Prod.</h2>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-8 rounded-[3rem] shadow-sm border">
                    <h3 className="text-xs font-black uppercase mb-8 italic text-slate-800 tracking-tighter">Ventas de la Semana</h3>
                    <div className="flex items-end justify-between h-56 gap-3 pb-2">
                        {dataGrafica.map((d, i) => (
                            <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                                <span className={`text-[7px] font-black ${d.total > 0 ? 'text-blue-600' : 'text-slate-300'}`}>
                                    ${d.total.toFixed(0)}
                                </span>
                                                                <div 
                                    className={`w-full rounded-t-xl transition-all duration-700 relative overflow-hidden ${d.esHoy ? 'bg-blue-600 shadow-lg shadow-blue-500/30' : 'bg-slate-200 group-hover:bg-blue-300'}`} 
                                    style={{ height: `${(d.total / maxVenta) * 75}%`, minHeight: d.total > 0 ? '4px' : '2px' }}
                                >
                                    {/* BARRA DE GANANCIA REAL (VERDE) */}
                                    {d.total > 0 && (
                                        <div 
                                            className="absolute bottom-0 left-0 right-0 bg-emerald-500 shadow-lg"
                                            style={{ height: `${(d.ganancia / d.total) * 100}%` }}
                                        ></div>
                                    )}
                                </div>
                            <span className={`text-[8px] font-black uppercase mt-2 ${d.esHoy ? 'text-blue-600' : 'text-slate-400'}`}>{d.dia}</span>
                        </div>
                    ))}
                    </div>

    {/* Solo se muestra si el ajuste está activo */}
    {ajustes.mostrar_top_productos && (
        <div className="bg-white p-8 rounded-[3rem] shadow-sm border">
            <h3 className="text-xs font-black uppercase mb-6 italic text-slate-800 tracking-tighter">Top 5 Productos</h3>
            <div className="space-y-4">
                {top5.map(([nombre, cant], i) => (
                    <div key={i} className="flex justify-between items-center border-b pb-2">
                        <span className="text-[10px] font-black text-slate-600 uppercase">{nombre}</span>
                         <span className="bg-blue-100 text-blue-600 px-3 py-1 rounded-full text-[9px] font-black">{cant} pz</span>
                              </div>
        )) }
      </div>
    </div>
  )}

  {/* VISTA: POS (CAJA) */}
      {vista === 'pos' && (
        <main className="flex-1 flex flex-col md:flex-row overflow-hidden animate-in fade-in">
          <section className="flex-1 p-4 overflow-y-auto">
            <form onSubmit={(e) => { 
                e.preventDefault(); 
                const p = catalogo.find(x => x.barcode === inputBarras); 
                if(p) { agregarAlCarrito(p); setInputBarras(''); }
            }} className="mb-4 relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
                <input 
                    type="text" 
                    placeholder="Buscar por nombre o escanear..." 
                    className="w-full bg-white p-4 pl-10 rounded-2xl shadow-sm border border-blue-100 font-bold text-xs outline-none focus:border-blue-500 transition-all text-black" 
                    value={inputBarras} 
                    onChange={(e) => setInputBarras(e.target.value)} 
                    autoFocus 
                />
            </form>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-3 content-start">
                {catalogoFiltrado.map(p => (
                <button 
  key={p.id} 
  onClick={() => agregarAlCarrito(p)} 
  className={`bg-white p-4 rounded-[2.5rem] shadow-sm border text-left flex flex-col justify-between h-40 transform transition-all hover:scale-105 active:scale-95 ${p.stock < 5 ? 'border-red-200 bg-red-50/20' : 'border-slate-100'}`}
>
  <div className="flex gap-3 items-start w-full">
      {/* Lógica de Imagen: Si existe la muestra, si no, cuadro gris estilo VD POS */}
      {p.imagen_url ? (
          <img 
              src={p.imagen_url} 
              alt={p.nombre} 
              className="w-14 h-14 rounded-2xl object-cover shadow-inner border border-slate-50" 
          />
      ) : (
          <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center text-[7px] text-slate-400 font-black uppercase text-center p-1 border border-dashed border-slate-200">
              Sin Foto
          </div>
      )}
      
      <div className="flex-1 overflow-hidden">
          <h3 className="font-black text-slate-800 uppercase text-[9px] leading-tight mb-1 truncate">
              {p.nombre}
          </h3>
          <p className="text-blue-600 font-black text-base tracking-tighter">
              ${parseFloat(p.precio).toFixed(2)}
          </p>
      </div>
  </div>

  <div className="w-full flex justify-between items-center mt-2">
      <span className={`text-[8px] font-black px-2 py-1 rounded-lg ${p.stock < 5 ? 'bg-red-600 text-white animate-pulse' : 'bg-green-100 text-green-600'}`}>
          STOCK: {p.stock}
      </span>
      {p.imagen_url && <span className="text-[10px]">📸</span>}
  </div>
</button>
                ))}
            </div>
          </section>

          <section className="w-full md:w-80 lg:w-96 bg-white border-l shadow-2xl flex flex-col h-[45vh] md:h-full overflow-y-auto no-print">
            <div className="p-5 bg-slate-50 border-b text-[10px] font-black text-slate-400 uppercase tracking-widest">Carrito de Venta</div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {carrito.map(i => (
                <div key={i.id} className="flex justify-between items-start text-xs border-b border-dashed border-slate-200 pb-3">
                  <span className="font-black text-slate-800 uppercase flex-1 pr-2">{i.cant}x {i.nombre}</span>
                  <div className="flex flex-col items-end">
                    <span className="font-black text-slate-900">${(i.precio * i.cant).toFixed(2)}</span>
                    <button onClick={() => setCarrito(carrito.filter(x => x.id !== i.id))} className="text-[8px] text-red-500 font-bold uppercase">Quitar</button>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="p-6 bg-slate-900 text-white md:rounded-t-[3rem] shadow-2xl">
              {/* CALCULADORA DE CAMBIO COMPACTA VD POS */}
{metodoPago === 'efectivo' && (
  <div className="mb-2 animate-in slide-in-from-right-5 px-6">
    <p className="text-[7px] font-black text-blue-400 uppercase mb-1 ml-1">¿Con cuánto paga?</p>
    <div className="relative">
      <input 
        type="number" 
        placeholder="Monto..." 
        className="w-full bg-slate-800 text-white p-3 rounded-xl font-black text-lg outline-none border-2 border-transparent focus:border-green-500 transition-all shadow-inner"
        value={pagoCon}
        onChange={(e) => setPagoCon(e.target.value)}
      />
    </div>
    
    {pagoCon > 0 && (
      <div className="mt-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex justify-between items-center">
        <span className="text-[8px] font-black text-emerald-400 uppercase">Cambio:</span>
        <span className="text-xl font-black text-emerald-400 tracking-tighter">
          ${(pagoCon - (carrito.reduce((a,b)=>a+(b.precio*b.cant),0) * (ajustes.aplicar_isr ? 1.16 : 1))).toFixed(2)}
        </span>
      </div>
    )}
  </div>
)}


              <div className="flex gap-2 mb-4">
                <button onClick={() => setMetodoPago('efectivo')} className={`flex-1 py-2 rounded-xl text-[9px] font-black border ${metodoPago === 'efectivo' ? 'bg-blue-600 border-blue-500' : 'border-slate-700 text-slate-500'}`}>EFECTIVO</button>
                <button onClick={() => setMetodoPago('tarjeta')} className={`flex-1 py-2 rounded-xl text-[9px] font-black border ${metodoPago === 'tarjeta' ? 'bg-indigo-600 border-indigo-500' : 'border-slate-700 text-slate-500'}`}>TARJETA</button>
              </div>
              <div className="flex justify-between items-end mb-6">
                <span className="text-blue-400 font-black italic text-xs">TOTAL:</span>
                <span className="text-4xl font-black text-green-400 tracking-tighter">
                    {/* IMPLEMENTACIÓN VISUAL DE AJUSTE ISR EN CARRITO */}
                    ${(carrito.reduce((a,b)=>a+(b.precio*b.cant),0) * (ajustes.aplicar_isr ? 1.16 : 1)).toFixed(2)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => finalizarVenta(false)} className="bg-slate-700 py-5 rounded-2xl font-black text-[10px] uppercase">Registrar</button>
                <button onClick={() => finalizarVenta(true)} className="bg-blue-600 py-5 rounded-2xl font-black text-[10px] uppercase shadow-lg shadow-blue-500/30">Ticket</button>
              </div>
            </div>
          </section>
        </main>
      )}

      {/* VISTA: PROVEEDORES REDISEÑADA */}
      {vista === 'proveedores' && (
        <main className="flex-1 p-4 md:p-8 overflow-y-auto animate-in slide-in-from-bottom-10">
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* COLUMNA 1: SELECCIÓN Y PAGO */}
            <div className="lg:col-span-2 space-y-6">
                <div className="bg-white p-8 rounded-[3rem] shadow-xl border-t-8 border-orange-500">
                    <h2 className="font-black text-xl mb-6 italic uppercase text-slate-800 flex items-center gap-2">
                        <span className="bg-orange-100 p-2 rounded-xl">💰</span> Registrar Pago
                    </h2>
                    
                    <div className="space-y-6">
                        {/* Selector Estético de Proveedores */}
                        <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase mb-3 ml-2">1. Selecciona el Proveedor</p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {proveedores.map(p => (
                                    <button 
                                        key={p.id} 
                                        onClick={() => setNuevaCompra({...nuevaCompra, proveedor_id: p.id})}
                                        className={`p-4 rounded-2xl border-2 transition-all text-left group ${nuevaCompra.proveedor_id === p.id ? 'border-orange-500 bg-orange-50' : 'border-slate-100 bg-slate-50 hover:border-orange-200'}`}
                                    >
                                        <span className={`block text-[10px] font-black uppercase ${nuevaCompra.proveedor_id === p.id ? 'text-orange-600' : 'text-slate-600'}`}>{p.nombre}</span>
                                        <span className="text-[8px] text-slate-400 font-bold">{p.categoria || 'General'}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Inputs de Monto y Detalles */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <p className="text-[9px] font-black text-slate-400 uppercase mb-2 ml-2">2. Importe del Gasto</p>
                                <input type="number" placeholder="0.00" className="w-full bg-slate-50 p-5 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-orange-500 text-black text-xl" value={nuevaCompra.monto_total} onChange={e => setNuevaCompra({...nuevaCompra, monto_total: e.target.value})}/>
                            </div>
                            <div>
                                <p className="text-[9px] font-black text-slate-400 uppercase mb-2 ml-2">3. Concepto o Nota</p>
                                <textarea placeholder="¿Qué se compró?" className="w-full bg-slate-50 p-5 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-orange-500 h-[68px] text-black text-xs resize-none" value={nuevaCompra.detalles} onChange={e => setNuevaCompra({...nuevaCompra, detalles: e.target.value})}></textarea>
                            </div>
                        </div>

                        <button onClick={async () => {
                            if(!nuevaCompra.proveedor_id || !nuevaCompra.monto_total || !profile?.empresa_id) return showMsg("Selecciona proveedor y monto", "error");
                            const { error } = await supabase.from('compras_proveedores').insert([{...nuevaCompra, empresa_id: profile.empresa_id}]);
                            if(error) return showMsg("Error al guardar", "error");
                            showMsg("¡PAGO REGISTRADO EXITOSAMENTE! 💸");
                            setNuevaCompra({proveedor_id:'', monto_total:'', detalles:''});
                            fetchData();
                        }} className="w-full bg-orange-600 text-white font-black py-6 rounded-3xl shadow-lg shadow-orange-500/30 uppercase text-xs tracking-widest hover:bg-orange-700 transition-all">Confirmar Salida de Dinero</button>
                    </div>
                </div>

                {/* Tabla de Últimos Pagos con mejor diseño */}
                <div className="bg-white rounded-[3rem] shadow-sm border border-slate-100 overflow-hidden">
                    <div className="p-6 bg-orange-50 border-b flex justify-between items-center">
                        <span className="text-[10px] font-black text-orange-600 uppercase tracking-widest">Historial Reciente de Pagos</span>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                        {compras.length > 0 ? compras.map(c => (
                            <div key={c.id} className="p-5 border-b border-slate-50 flex justify-between items-center hover:bg-slate-50 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 font-black text-xs">
                                        {c.proveedores?.nombre?.substring(0,2).toUpperCase()}
                                    </div>
                                    <div>
                                        <span className="font-black text-[11px] text-slate-800 uppercase block">{c.proveedores?.nombre}</span>
                                        <span className="text-[8px] text-slate-400 font-bold uppercase">{new Date(c.fecha).toLocaleDateString()} • {c.detalles || 'Sin detalles'}</span>
                                    </div>
                                </div>
                                <span className="text-red-500 font-black text-lg tracking-tighter">-${parseFloat(c.monto_total).toFixed(2)}</span>
                            </div>
                        )) : (
                            <div className="p-10 text-center text-slate-300 font-bold text-xs uppercase">No hay pagos registrados aún</div>
                        )}
                    </div>
                </div>
            </div>

            {/* COLUMNA 2: ALTA DE PROVEEDORES */}
            <div className="space-y-6">
                <div className="bg-slate-900 p-8 rounded-[3rem] shadow-2xl border-b-8 border-blue-500">
                    <h2 className="font-black text-xl mb-6 italic uppercase text-white flex items-center gap-2">
                        <span className="bg-blue-500 p-2 rounded-xl text-white">🤝</span> Nuevo Socio
                    </h2>
                    <div className="space-y-4">
                        <div className="space-y-1">
                            <p className="text-[8px] font-black text-blue-400 uppercase ml-2">PROVEEDOR</p>
                            <input type="text" placeholder="Ej. Coca-Cola México" className="w-full bg-slate-800 text-white p-4 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500 transition-all" value={nuevoProv.nombre} onChange={e => setNuevoProv({...nuevoProv, nombre: e.target.value})}/>
                        </div>
                        <div className="space-y-1">
                            <p className="text-[8px] font-black text-blue-400 uppercase ml-2">Contacto / Teléfono</p>
                            <input type="text" placeholder="Ej. 33 1234 5678" className="w-full bg-slate-800 text-white p-4 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500 transition-all" value={nuevoProv.contacto} onChange={e => setNuevoProv({...nuevoProv, contacto: e.target.value})}/>
                        </div>
                        <button onClick={async () => {
                            if(!nuevoProv.nombre || !profile?.empresa_id) return showMsg("Falta el nombre.", "error");
                            await supabase.from('proveedores').insert([{...nuevoProv, empresa_id: profile.empresa_id}]);
                            showMsg("¡NUEVO PROVEEDOR REGISTRADO!");
                            setNuevoProv({nombre:'', contacto:'', categoria:''});
                            fetchData();
                        }} className="w-full bg-blue-600 text-white font-black py-5 rounded-2xl shadow-xl uppercase text-[10px] tracking-widest mt-4">Dar de Alta</button>
                    </div>
                </div>
                
                <div className="bg-orange-600 p-8 rounded-[3rem] text-white shadow-xl relative overflow-hidden group">
                    <div className="relative z-10">
                        <p className="text-[10px] font-black uppercase opacity-80 mb-1 text-orange-200">Total Gastos Mes</p>
                        <h2 className="text-4xl font-black tracking-tighter">${totalGastos.toFixed(2)}</h2>
                    </div>
                    <div className="absolute -right-4 -bottom-4 text-7xl opacity-20 group-hover:scale-110 transition-transform">📉</div>
                </div>
            </div>

          </div>
        </main>
      )}


      {/* VISTA: INVENTARIO CON CÁLCULO DE GANANCIAS */}
      {vista === 'inventario' && (
        <main className="flex-1 p-4 md:p-8 overflow-y-auto animate-in fade-in">
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-white p-8 md:p-12 rounded-[3rem] shadow-xl border border-slate-100">
              <h2 className="font-black text-2xl mb-8 italic uppercase text-slate-800 tracking-tighter text-center">Catálogo de Productos</h2>
              <div className="space-y-4">
                <input type="text" placeholder="Nombre del Producto" className="w-full bg-slate-50 p-5 rounded-2xl font-bold border-2 border-transparent focus:border-blue-500 outline-none text-black" value={nuevoProd.nombre} onChange={e => setNuevoProd({...nuevoProd, nombre: e.target.value})}/>
                <input type="text" placeholder="Código de Barras" className="w-full bg-slate-50 p-5 rounded-2xl font-bold border-2 border-transparent focus:border-blue-500 outline-none text-black" value={nuevoProd.barcode} onChange={e => setNuevoProd({...nuevoProd, barcode: e.target.value})}/>
                {/* SECCIÓN DE CARGA DE IMAGEN ESTILO IPHONE */}
<div className="space-y-1">
    <p className="text-[8px] font-black text-slate-400 uppercase ml-2">Foto del Producto (Opcional)</p>
    <input 
        type="file" 
        accept="image/*" 
        className="w-full bg-slate-50 p-4 rounded-2xl font-bold text-[10px] text-black border-2 border-transparent focus:border-blue-500 outline-none transition-all file:mr-4 file:py-1 file:px-4 file:rounded-full file:border-0 file:text-[10px] file:font-black file:bg-blue-100 file:text-blue-600" 
        onChange={(e) => {
            if(e.target.files[0]) {
                setFile(e.target.files[0]);
                showMsg("IMAGEN LISTA PARA SUBIR 📸");
            }
        }}
    />
</div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <p className="text-[8px] font-black text-slate-400 uppercase ml-2">Costo Compra ($)</p>
                        <input type="number" placeholder="0.00" className="w-full bg-slate-50 p-5 rounded-2xl font-bold border-2 border-transparent focus:border-blue-500 outline-none text-black" value={nuevoProd.precio_compra} onChange={e => setNuevoProd({...nuevoProd, precio_compra: e.target.value})}/>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[8px] font-black text-blue-500 uppercase ml-2">Precio Venta ($)</p>
                        <input type="number" placeholder="0.00" className="w-full bg-slate-50 p-5 rounded-2xl font-bold border-2 border-transparent focus:border-blue-500 outline-none text-black" value={nuevoProd.precio} onChange={e => setNuevoProd({...nuevoProd, precio: e.target.value})}/>
                    </div>
                </div>

                {/* INDICADOR DE GANANCIA EN TIEMPO REAL */}
                {nuevoProd.precio && nuevoProd.precio_compra && (
                    <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 flex justify-between items-center animate-in zoom-in-95">
                        <span className="text-[9px] font-black text-emerald-700 uppercase">Utilidad Proyectada:</span>
                        <span className="text-emerald-600 font-black text-sm">
                            ${(parseFloat(nuevoProd.precio) - parseFloat(nuevoProd.precio_compra)).toFixed(2)} 
                            <span className="ml-2 text-[10px] opacity-70">
                                ({(((parseFloat(nuevoProd.precio) - parseFloat(nuevoProd.precio_compra)) / parseFloat(nuevoProd.precio_compra)) * 100).toFixed(0)}%)
                            </span>
                        </span>
                    </div>
                )}

                <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-1">
                        <p className="text-[8px] font-black text-slate-400 uppercase ml-2">Stock Inicial</p>
                        <input type="number" placeholder="0" className="w-full bg-slate-50 p-5 rounded-2xl font-bold border-2 border-transparent focus:border-blue-500 outline-none text-black" value={nuevoProd.stock} onChange={e => setNuevoProd({...nuevoProd, stock: e.target.value})}/>
                    </div>
                </div>

                <button onClick={async () => {
    if(!profile?.empresa_id) return showMsg("Error de sesión", "error");
    
    // 1. Iniciamos subida de imagen si el usuario seleccionó una
    let url = null;
    if (file) {
        url = await uploadImagen(file); 
    }

    const finalStock = parseInt(nuevoProd.stock) || 0;

    // 2. Insertamos en la base de datos incluyendo el link de la imagen
    const { error } = await supabase.from('productos').insert([{
        ...nuevoProd, 
        stock: finalStock, 
        empresa_id: profile.empresa_id,
        imagen_url: url // <--- Este es el campo nuevo en tu tabla
    }]);

    if (error) return showMsg("Error al guardar", "error");
    
    // 3. Limpiamos todo para el siguiente producto
    showMsg("¡PRODUCTO AGREGADO CON ÉXITO!");
    setNuevoProd({nombre:'', precio:'', stock: '', barcode: '', precio_compra: ''});
    setFile(null); // Reseteamos el selector de archivos
    fetchData();
}} className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl shadow-xl uppercase text-[10px] tracking-widest mt-2">
    Añadir al Catálogo
</button>
              </div>
            </div>

            <div className="bg-white rounded-[2.5rem] shadow-sm border overflow-hidden">
                <div className="p-4 bg-slate-50 border-b text-[10px] font-black text-slate-400 uppercase tracking-widest">Existencias Actuales</div>
                {catalogo.map(p => (
                    <div key={p.id} className="p-6 border-b border-slate-50 flex justify-between items-center gap-4 hover:bg-slate-50 transition-colors">
                        <div className="flex-1">
                            <span className="font-black text-[10px] text-slate-800 uppercase block">{p.nombre}</span>
                            <div className="flex items-center gap-3">
                                <span className={`text-[9px] font-bold uppercase ${p.stock < 5 ? 'text-red-500' : 'text-slate-400'}`}>Cant: {p.stock}</span>
                                {p.precio_compra && (
                                    <span className="text-[9px] font-black text-emerald-600 uppercase bg-emerald-50 px-2 py-0.5 rounded-md">
                                        Ganancia: ${(parseFloat(p.precio) - parseFloat(p.precio_compra)).toFixed(2)}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <input type="number" className="w-20 bg-slate-50 p-2 rounded-lg font-black text-center text-xs border text-black" defaultValue={p.stock} onBlur={(e) => {
                                const val = parseInt(e.target.value) || 0;
                                supabase.from('productos').update({ stock: val }).eq('id', p.id).then(()=>{
                                    fetchData();
                                    showMsg("STOCK ACTUALIZADO 🔄");
                                });
                            }}/>
                            <button onClick={async () => { 
    // Quitamos el confirm nativo para que sea acción directa o puedes armar un modal después
    const { error } = await supabase.from('productos').delete().eq('id', p.id); 
    
    if (error) {
        showMsg("Error al eliminar", "error");
    } else {
        fetchData(); 
        // Usamos el tipo 'success' para que salga con el diseño limpio de iPhone que ya programaste
        showMsg("¡PRODUCTO ELIMINADO EXITOSAMENTE! 🗑️", "success"); 
    }
}} className="bg-red-50 text-red-500 font-black text-[9px] uppercase px-4 py-2 rounded-xl hover:bg-red-500 hover:text-white transition-all border border-red-100">
    Eliminar
</button>
                        </div>
                    </div>
                ))}
            </div>
          </div>
        </main>
      )}


      {/* VISTA: CORTE */}
      {vista === 'corte' && (
        <main className="flex-1 p-4 md:p-8 overflow-y-auto animate-in fade-in">
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-blue-500/20 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Consultar Reporte</span>
                    <h3 className="font-black text-slate-800 italic uppercase">Historial de Ventas</h3>
                </div>
                <input type="date" className="bg-slate-900 text-white p-4 rounded-2xl font-black text-xs outline-none shadow-lg shadow-blue-500/20" value={fechaConsulta} onChange={(e) => setFechaConsulta(e.target.value)}/>
            </div>

            <div className="bg-slate-900 p-10 rounded-[3rem] text-white shadow-2xl border-b-8 border-emerald-500">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <p className="text-[10px] font-black uppercase opacity-70 tracking-widest">Resumen del {fechaConsulta}</p>
                        <h2 className="text-5xl font-black tracking-tighter tabular-nums">${totalCorte.toFixed(2)}</h2>
                    </div>
                    <div className="text-right">
                        <p className="text-[9px] font-black text-blue-400">EFECTIVO: ${efectivoCorte.toFixed(2)}</p>
                        <p className="text-[9px] font-black text-indigo-400">TARJETA: ${tarjetaCorte.toFixed(2)}</p>
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                {ventasFiltradas.map(v => (
                    <div key={v.id} className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col gap-3">
                        <div className="flex justify-between items-center text-[9px] font-black uppercase">
                            <span className="text-slate-400">{new Date(v.fecha).toLocaleString()}</span>
                            <span className={`px-3 py-1 rounded-full ${v.metodo_pago === 'tarjeta' ? 'bg-indigo-100 text-indigo-600' : 'bg-blue-100 text-blue-600'}`}>{v.metodo_pago}</span>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                            <div className="flex flex-wrap gap-2">
                                {v.items?.map((item, idx) => (
                                    <span key={idx} className="bg-white px-2 py-1 rounded-lg border text-[9px] font-black text-slate-700">{item.cant}x {item.nombre}</span>
                                ))}
                            </div>
                        </div>
                        <div className="flex justify-between items-center mt-2">
                            <span className="text-[10px] font-black text-slate-700">Vendedor: {v.vendedor}</span>
                            <span className="text-xl font-black tabular-nums">${parseFloat(v.total).toFixed(2)}</span>
                        </div>
                    </div>
                ))}
            </div>
          </div>
        </main>
      )}

      {/* VISTA: AJUSTES (LIMPIA Y FUNCIONAL) */}
      {vista === 'ajustes' && (
        <main className="flex-1 p-4 md:p-8 overflow-y-auto animate-in slide-in-from-right-10">
          <div className="max-w-md mx-auto space-y-6">
            <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-slate-100">
              <h2 className="font-black text-2xl mb-8 italic uppercase text-slate-800 tracking-tighter text-center">Configuración del Sistema</h2>
              
              <div className="space-y-4">
                {/* SWITCH ISR */}
                <div className="flex items-center justify-between p-6 bg-slate-50 rounded-3xl border-2 border-transparent hover:border-blue-500 transition-all">
                  <div>
                    <span className="font-black text-[10px] text-slate-800 uppercase block">Sumar ISR (16%) al cobrar</span>
                    <span className="text-[8px] text-slate-400 font-bold">Activa o desactiva el impuesto en ventas</span>
                  </div>
                  <input 
                    type="checkbox" 
                    className="w-8 h-8 rounded-xl accent-blue-600 cursor-pointer"
                    checked={ajustes.aplicar_isr} 
                    onChange={async (e) => {
                      const val = e.target.checked;
                      setAjustes({...ajustes, aplicar_isr: val});
                      const { error } = await supabase.from('configuracion_sistema').update({ aplicar_isr: val }).eq('user_id', session.user.id);
                      if(!error) showMsg(val ? "COBRO DE ISR ACTIVADO ✅" : "COBRO DE ISR DESACTIVADO ❌");
                    }} 
                  />
                </div>

                {/* SWITCH TOP PRODUCTOS */}
                <div className="flex items-center justify-between p-6 bg-slate-50 rounded-3xl border-2 border-transparent hover:border-blue-500 transition-all">
                  <div>
                    <span className="font-black text-[10px] text-slate-800 uppercase block">Mostrar Top Productos</span>
                    <span className="text-[8px] text-slate-400 font-bold">Ver los más vendidos en Dashboard</span>
                  </div>
                  <input 
                    type="checkbox" 
                    className="w-8 h-8 rounded-xl accent-blue-600 cursor-pointer"
                    checked={ajustes.mostrar_top_productos} 
                    onChange={async (e) => {
                      const val = e.target.checked;
                      setAjustes({...ajustes, mostrar_top_productos: val});
                      const { error } = await supabase.from('configuracion_sistema').update({ mostrar_top_productos: val }).eq('user_id', session.user.id);
                      if(!error) showMsg(val ? "TOP PRODUCTOS VISIBLE 📊" : "TOP PRODUCTOS OCULTO 👁️");
                    }} 
                  />
                </div>
              </div>

              <div className="mt-10 pt-6 border-t border-dashed text-center">
                 <p className="text-[8px] font-black text-slate-300 uppercase tracking-[0.3em]">VD POS - Velasco Digital Co.</p>
              </div>
            </div>
          </div>
        </main>
      )}
    )} 
  );
}
