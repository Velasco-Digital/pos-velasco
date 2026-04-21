// @ts-nocheck
"use client";
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useUserRole } from '../hooks/useUserRole'; 

/**
 * VELASCO POS - ULTIMATE LUXURY EDITION
 * Versión: 5.1 (Velasco Digital Co. Engineering)
 * Corrección: Layout de Checkout y botones fijos
 */

export default function VelascoPOS_Ultimate() {
  // --- SENSORES DE PERFIL Y SESIÓN (LÓGICA CORE) ---
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
  const [nuevoProd, setNuevoProd] = useState({ 
    nombre: '', 
    precio: '', 
    stock: '', 
    barcode: '', 
    precio_compra: '',
    unidad_medida: 'pz'
  });
  
  const [file, setFile] = useState(null);
  const [pagoCon, setPagoCon] = useState('');
  const [inputBarras, setInputBarras] = useState('');

  const [proveedores, setProveedores] = useState([]);
  const [compras, setCompras] = useState([]);
  const [nuevoProv, setNuevoProv] = useState({ nombre: '', contacto: '', categoria: '' });
  const [editandoProv, setEditandoProv] = useState(null); 
  const [nuevaCompra, setNuevaCompra] = useState({ proveedor_id: '', monto_total: '', detalles: '' });

  // SISTEMA DE NOTIFICACIONES TIPO IPHONE
  const [toast, setToast] = useState({ visible: false, msg: '', tipo: 'success' });
  const [confirmModal, setConfirmModal] = useState({ visible: false, titulo: '', accion: null });

  // AJUSTES DE SISTEMA
  const [ajustes, setAjustes] = useState({ aplicar_isr: false, mostrar_top_productos: true, mostrar_ganancias: true });

  // --- LÓGICA DE CARGA DE IMÁGENES ---
  const uploadImagen = async (file) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${profile.empresa_id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('productos_fotos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('productos_fotos')
        .getPublicUrl(filePath);

      return data.publicUrl;
    } catch (error) {
      showMsg("Error al subir la imagen", "error");
      return null;
    }
  };

  // --- EFECTOS DE MONTAJE Y SINCRONIZACIÓN ---
  useEffect(() => {
    setMontado(true);
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
  }, []);

  useEffect(() => {
    if (session && profile?.empresa_id) {
      fetchData();
      cargarAjustes();
      verificarCorteAutomaticoProv();
    }
  }, [session, profile]);

  const showMsg = (msg, tipo = 'success') => {
    setToast({ visible: true, msg, tipo });
    setTimeout(() => setToast({ visible: false, msg: '', tipo: 'success' }), 3000);
  };

  const cargarAjustes = async () => {
    const { data, error } = await supabase
      .from('configuracion_sistema')
      .select('*')
      .eq('user_id', session.user.id)
      .single();
    
    if (data) {
      setAjustes(data);
    } else if (error && error.code === 'PGRST116') {
      const { data: newData } = await supabase
        .from('configuracion_sistema')
        .insert([{ user_id: session.user.id }])
        .select()
        .single();
      if (newData) setAjustes(newData);
    }
  };

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

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      showMsg("Credenciales incorrectas", "error");
    } else {
      window.location.reload();
    }
  };

  const ultimoEscaneo = useRef(0);

  const agregarAlCarrito = (p) => {
    const ahora = Date.now();
    if (ahora - ultimoEscaneo.current < 500) return;
    ultimoEscaneo.current = ahora;

    let cantidadFinal = 1;

    if (p.unidad_medida === 'kg') {
        const peso = prompt(`BÁSCULA: Ingrese peso para ${p.nombre} (Kg):`, "0.500");
        if (peso === null || isNaN(peso) || peso <= 0) return showMsg("Operación cancelada", "error");
        cantidadFinal = parseFloat(peso);
    }

    const enCarrito = carrito.find(i => i.id === p.id);
    const cantActual = enCarrito ? enCarrito.cant : 0;

    if(p.stock < (cantActual + cantidadFinal)) return showMsg(`¡Stock insuficiente!`, "error");
    
    if (enCarrito) {
      setCarrito(carrito.map(i => i.id === p.id ? {...i, cant: i.cant + cantidadFinal} : i));
    } else {
      setCarrito([...carrito, {...p, cant: cantidadFinal}]);
    }
  };

  const verificarCorteAutomaticoProv = () => {
      setInterval(() => {
          const ahora = new Date();
          if (ahora.getHours() === 23 && ahora.getMinutes() === 59 && ahora.getSeconds() === 0) {
              generarTicketCorteProveedores();
          }
      }, 1000);
  };

  const generarTicketCorteProveedores = () => {
    const hoy = new Date().toLocaleDateString('en-CA');
    const pagosHoy = compras.filter(c => new Date(c.fecha).toLocaleDateString('en-CA') === hoy);
    const total = pagosHoy.reduce((acc, c) => acc + parseFloat(c.monto_total), 0);

    const ticketVentana = window.open('', '_blank');
    ticketVentana.document.write(`
        <html>
          <head>
              <title>Corte Proveedores - VD POS</title>
              <style>
                  body { font-family: monospace; width: 80mm; padding: 10px; color: black; }
                  .flex { display: flex; justify-content: space-between; font-size: 12px; }
                  hr { border: none; border-top: 1px dashed #000; margin: 10px 0; }
              </style>
          </head>
          <body>
              <center>
                  <h2 style="margin:0;">CORTE PROVEEDORES</h2>
                  <p style="font-size:10px; margin:2px;">VD POS v5.</p>
                  <p style="font-size:12px;">${hoy}</p>
                  <hr>
              </center>
              ${pagosHoy.map(p => `
                  <div class="flex">
                      <span>${p.proveedores?.nombre?.substring(0,15)}</span>
                      <span>$${parseFloat(p.monto_total).toFixed(2)}</span>
                  </div>
              `).join('')}
              <hr>
              <div class="flex" style="font-weight:bold; font-size:14px;">
                  <span>TOTAL PAGADO:</span>
                  <span>$${total.toFixed(2)}</span>
              </div>
              <center>
                  <p style="font-size:9px; margin-top:30px;">*** FIN DEL REPORTE ***</p>
                  <p style="font-size:8px;">Control Físico Sugerido</p>
              </center>
              <script>
                  window.onload = function() {
                      window.print();
                      setTimeout(() => { window.close(); }, 1000);
                  };
              </script>
          </body>
        </html>
    `);
    ticketVentana.document.close();
    showMsg("GENERANDO VISTA DE IMPRESIÓN...");
  };

  const finalizarVenta = async (imprimir = false) => {
    if (carrito.length === 0 || !profile?.empresa_id) return;

    for (const item of carrito) {
        const prodOriginal = catalogo.find(p => p.id === item.id);
        if (prodOriginal && prodOriginal.stock < item.cant) {
            return showMsg(`Stock insuficiente: ${item.nombre}`, "error");
        }
    }

    const subtotal = carrito.reduce((a,b)=>a+(b.precio*b.cant), 0);
    const factorImpuesto = ajustes.aplicar_isr ? 1.16 : 1;
    const totalVenta = subtotal * factorImpuesto;
    
    const { error } = await supabase.from('ventas').insert([{ 
        items: carrito, 
        total: totalVenta, 
        vendedor: session.user.email,
        metodo_pago: metodoPago,
        empresa_id: profile.empresa_id
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

  const registrarComisionServicio = async (tipo) => {
    if (!profile?.empresa_id) return;
    const comisionFija = 10.00;
    
    const { error } = await supabase.from('ventas').insert([{ 
        items: [{ nombre: `COMISION: ${tipo.toUpperCase()}`, precio: comisionFija, cant: 1 }], 
        total: comisionFija, 
        vendedor: session.user.email,
        metodo_pago: 'efectivo',
        empresa_id: profile.empresa_id 
    }]);

    if (error) {
        showMsg("Error al registrar comisión", "error");
    } else {
        showMsg(`¡COMISIÓN DE ${tipo} REGISTRADA!`);
        fetchData(); 
    }
  };

  // --- CÁLCULOS DE UI ---
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
    const utilidadReal = ventasDelDia.reduce((acc, v) => {
        const gananciaVenta = v.items?.reduce((subAcc, item) => {
            const prodOriginal = catalogo.find(p => p.nombre === item.nombre);
            const costo = prodOriginal?.precio_compra || 0;
            return subAcc + ((item.precio - costo) * item.cant);
        }, 0);
        return acc + gananciaVenta;
    }, 0);
    return { dia: dia.split(' ')[0], total: totalVenta, ganancia: utilidadReal, esHoy: dia === hoyStr };
  });

  const maxVenta = Math.max(...dataGrafica.map(d => d.total), 1);
  const conteoProd = {};
  historial.forEach(v => {
    v.items?.forEach(item => {
        conteoProd[item.nombre] = (conteoProd[item.nombre] || 0) + item.cant;
    });
  });
  const top5 = Object.entries(conteoProd).sort((a,b) => b[1] - a[1]).slice(0, 5);

  // --- RENDERIZADO DE INTERFAZ ---
  if ((cargandoPerfil || !montado) && session) {
    return <div className="h-screen bg-black flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>; 
  }

  if (!session && montado) {
    return (
      <div className="bg-[#050505] h-screen flex items-center justify-center p-6 font-sans">
        <div className="bg-[#1c1c1e] p-12 rounded-[3rem] shadow-[0_32px_64px_rgba(0,0,0,0.5)] w-full max-w-md text-center border border-white/5 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600"></div>
          <div className="mb-10">
            <h1 className="text-white font-black italic text-5xl mb-2 tracking-tighter">VD POS</h1>
            <p className="text-blue-500 text-[10px] uppercase tracking-[0.4em] font-black">Engineering the Future</p>
          </div>
          
          <div className="space-y-4">
            <input 
                type="email" 
                placeholder="Identificador" 
                className="w-full bg-[#2c2c2e] text-white p-6 rounded-2xl font-bold outline-none border border-transparent focus:border-blue-500 transition-all placeholder:text-gray-500" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
            />
            <input 
                type="password" 
                placeholder="Llave Maestra" 
                className="w-full bg-[#2c2c2e] text-white p-6 rounded-2xl font-bold outline-none border border-transparent focus:border-blue-500 transition-all placeholder:text-gray-500" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
            />
          </div>
          
          <button 
            onClick={handleLogin} 
            className="w-full bg-blue-600 text-white font-black py-6 rounded-2xl shadow-[0_20px_40px_rgba(37,99,235,0.3)] hover:bg-blue-500 hover:-translate-y-1 transition-all mt-10 uppercase tracking-widest text-xs"
          >
            Acceder al Sistema
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#f2f2f7] h-screen flex flex-col font-sans overflow-hidden text-black selection:bg-blue-100">
      
      {/* ESTILOS GLOBALES Y NOTIFICACIONES IPHONE */}
      <style>{`
        @media screen { #tk-gh { display: none !important; } }
        @media print {
            body * { visibility: hidden !important; }
            #tk-gh, #tk-gh * { visibility: visible !important; }
            #tk-gh { position: absolute; left: 0; top: 0; width: 80mm !important; padding: 5mm; font-family: monospace; color: black !important; display: block !important; }
        }
        .apple-shadow { shadow: 0 10px 30px -5px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05); }
        .dynamic-island-enter { transform: translateY(-50px) scale(0.9); opacity: 0; }
        .dynamic-island-active { transform: translateY(0) scale(1); opacity: 1; transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1); }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-thumb { background: #d1d1d6; border-radius: 10px; }
        .squircle { border-radius: 2.5rem; }
      `}</style>

      {/* DYNAMIC ISLAND NOTIFICATIONS */}
      {toast.visible && (
        <div className="fixed top-8 left-0 right-0 z-[6000] flex justify-center px-6 pointer-events-none">
            <div className={`dynamic-island-active flex items-center gap-4 px-8 py-4 rounded-[3rem] shadow-[0_20px_50px_rgba(0,0,0,0.15)] backdrop-blur-3xl border ${toast.tipo === 'success' ? 'bg-white/90 border-emerald-100' : 'bg-red-50/90 border-red-100'}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${toast.tipo === 'success' ? 'bg-emerald-500 shadow-lg shadow-emerald-200' : 'bg-red-500 shadow-lg shadow-red-200'}`}>
                    <span className="text-white text-lg">{toast.tipo === 'success' ? '✓' : '✕'}</span>
                </div>
                <p className={`font-black text-[12px] uppercase tracking-tighter ${toast.tipo === 'success' ? 'text-emerald-900' : 'text-red-900'}`}>
                    {toast.msg}
                </p>
            </div>
        </div>
      )}

      {/* MODAL IPHONE ALERTA PRO */}
      {confirmModal.visible && (
        <div className="fixed inset-0 z-[7000] flex items-center justify-center p-6 backdrop-blur-md bg-black/20 animate-in fade-in duration-300">
            <div className="bg-white/90 backdrop-blur-2xl w-full max-w-[300px] rounded-[2rem] shadow-[0_40px_80px_rgba(0,0,0,0.2)] overflow-hidden animate-in zoom-in-95 duration-200 text-center border border-white">
                <div className="p-8">
                    <h3 className="text-black font-black text-lg mb-2">{confirmModal.titulo}</h3>
                    <p className="text-slate-500 text-xs leading-relaxed font-medium">Esta acción modificará los registros permanentes de la empresa en la nube.</p>
                </div>
                <div className="grid grid-cols-2 border-t border-slate-200/50">
                    <button 
                        onClick={() => setConfirmModal({visible: false, titulo: '', accion: null})}
                        className="py-5 text-blue-600 font-bold text-sm border-r border-slate-200/50 active:bg-slate-200/30 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={() => { confirmModal.accion(); setConfirmModal({visible: false, titulo: '', accion: null}); }}
                        className="py-5 text-red-500 font-black text-sm active:bg-slate-200/30 transition-colors"
                    >
                        Confirmar
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* TICKET DE IMPRESIÓN (VISIBLE SÓLO EN PRINT) */}
      <div id="tk-gh">
          <center>
            <h2 className="font-bold">VELASCO POS</h2>
            <p style={{fontSize: '9px'}}>Terminal: {profile?.nombre_empresa || 'VD Co.'}</p>
            <p style={{fontSize: '9px'}}>Vendedor: {ticketImpresion.vendedor}</p>
            <p>----------------------------</p>
          </center>
          {ticketImpresion.items.map((it, idx) => (
            <div key={idx} style={{display:'flex', justifyBetween:'space-between', fontSize:'12px'}}>
                <span>{it.cant} {it.nombre}</span><span>${(it.precio*it.cant).toFixed(2)}</span>
            </div>
          ))}
          <p>----------------------------</p>
          <div style={{display:'flex', justifyBetween:'space-between', fontWeight:'bold'}}><span>TOTAL:</span><span>${ticketImpresion.total.toFixed(2)}</span></div>
          <center><p style={{fontSize:'9px', marginTop:'15px'}}>{ticketImpresion.fecha}</p></center>
      </div>

      {/* NAVIGATION BAR - GLASSMORPHISM STYLE */}
      <nav className="bg-white/80 backdrop-blur-md p-4 flex flex-col sm:flex-row justify-between items-center shadow-[0_1px_0_0_rgba(0,0,0,0.05)] no-print gap-4 z-50">
        <div className="flex items-center gap-4">
            <div className="bg-blue-600 w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200 rotate-3">
                <span className="text-white font-black italic text-xl">V</span>
            </div>
            <div>
                <h1 className="text-black font-black text-xl tracking-tighter">VD POS <span className="text-blue-600">Ultimate</span></h1>
                <p className="text-[8px] text-slate-400 uppercase font-black tracking-widest">{profile?.nombre_empresa || 'Engineering Agency'}</p>
            </div>
        </div>
        
        <div className="flex gap-1 bg-[#e3e3e8] p-1 rounded-2xl w-full sm:w-auto overflow-x-auto">
            {[
                {id: 'dashboard', label: 'DASHBOARD', color: 'bg-white text-black'},
                {id: 'pos', label: 'TERMINAL', color: 'bg-white text-black'},
                {id: 'servicios', label: 'SERVICIOS', color: 'bg-emerald-500 text-white'},
                {id: 'inventario', label: 'STOCK', color: 'bg-indigo-500 text-white', admin: true},
                {id: 'proveedores', label: 'PROV', color: 'bg-orange-500 text-white', admin: true},
                {id: 'corte', label: 'CORTE', color: 'bg-slate-800 text-white', admin: true}
            ].map(tab => (
                (!tab.admin || rol === 'admin') && (
                    <button 
                        key={tab.id}
                        onClick={() => setVista(tab.id)} 
                        className={`px-5 py-2.5 rounded-xl text-[10px] font-black transition-all duration-300 ${vista === tab.id ? tab.color + ' shadow-md scale-[1.02]' : 'text-slate-500 hover:text-black'}`}
                    >
                        {tab.label}
                    </button>
                )
            ))}
        </div>

        <div className="flex items-center gap-3">
            {rol === 'admin' && (
                <button 
                    onClick={() => setVista('ajustes')} 
                    className={`p-3 rounded-2xl transition-all ${vista === 'ajustes' ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-black'}`}
                >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" /></svg>
                </button>
            )}
            <button 
                onClick={() => supabase.auth.signOut().then(()=>window.location.reload())} 
                className="bg-red-50 text-red-500 p-3 rounded-2xl font-black text-[10px] uppercase hover:bg-red-500 hover:text-white transition-all shadow-sm"
            >
                Salir
            </button>
        </div>
      </nav>

      {/* VIEW: DASHBOARD - APPLE INSPIRED WIDGETS */}
      {vista === 'dashboard' && (
        <main className="flex-1 p-6 md:p-10 overflow-y-auto animate-in fade-in slide-in-from-bottom-5 duration-700">
          <div className="max-w-6xl mx-auto space-y-8">
            
            <header className="flex justify-between items-end">
                <div>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Resumen General</p>
                    <h2 className="text-4xl font-black text-black tracking-tight">Hola, <span className="text-blue-600">{profile?.nombre || 'Dimitri'}</span></h2>
                </div>
                <div className="text-right hidden md:block">
                    <p className="text-slate-400 text-xs font-bold uppercase">{new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>
            </header>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    {label: 'Ingresos Hoy', value: `$${totalCorte.toFixed(2)}`, color: 'text-blue-600', bg: 'bg-white', icon: '💎'},
                    {label: 'Salidas Prov', value: `-$${totalGastos.toFixed(2)}`, color: 'text-orange-600', bg: 'bg-white', icon: '💸'},
                    {label: 'Utilidad Neta', value: `$${utilidadNeta.toFixed(2)}`, color: utilidadNeta >= 0 ? 'text-emerald-600' : 'text-red-600', bg: utilidadNeta >= 0 ? 'bg-emerald-50' : 'bg-red-50', icon: '📈'},
                    {label: 'Stock Crítico', value: `${productosBajos.length} Items`, color: 'text-red-600', bg: 'bg-white', icon: '⚠️'}
                ].map((stat, i) => (
                    <div key={i} className={`${stat.bg} p-8 rounded-[2.5rem] shadow-[0_10px_40px_rgba(0,0,0,0.03)] border border-white flex flex-col justify-between hover:scale-[1.03] transition-transform duration-500 h-44`}>
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</span>
                            <span className="text-2xl">{stat.icon}</span>
                        </div>
                        <h2 className={`text-3xl font-black ${stat.color} tracking-tighter`}>{stat.value}</h2>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* GRÁFICA DE RENDIMIENTO */}
                <div className="lg:col-span-2 bg-white p-10 rounded-[3rem] shadow-[0_10px_50px_rgba(0,0,0,0.04)] border border-white">
                    <div className="flex justify-between items-center mb-10">
                        <h3 className="text-sm font-black uppercase italic text-black tracking-tighter">Rendimiento 7 Días</h3>
                        <div className="flex gap-3">
                            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-blue-600"></div><span className="text-[9px] font-bold text-slate-400">VENTAS</span></div>
                            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div><span className="text-[9px] font-bold text-slate-400">GANANCIA</span></div>
                        </div>
                    </div>
                    
                    <div className="flex items-end justify-between h-64 gap-4 pb-4">
                        {dataGrafica.map((d, i) => (
                            <div key={i} className="flex-1 flex flex-col items-center gap-3 h-full justify-end group">
                                <div className="hidden group-hover:block absolute mb-64 bg-black text-white text-[8px] py-1 px-2 rounded-lg z-10">
                                    ${d.total.toFixed(0)}
                                </div>
                                <div 
                                    className={`w-full rounded-2xl transition-all duration-1000 relative overflow-hidden shadow-sm ${d.esHoy ? 'bg-blue-600 shadow-xl shadow-blue-200 scale-x-105' : 'bg-slate-100 hover:bg-slate-200'}`} 
                                    style={{ height: `${(d.total / maxVenta) * 85}%`, minHeight: d.total > 0 ? '12px' : '4px' }}
                                >
                                    {d.total > 0 && (
                                        <div 
                                            className="absolute bottom-0 left-0 right-0 bg-emerald-500 transition-all duration-1000 delay-300 shadow-[0_-4px_10px_rgba(16,185,129,0.2)]"
                                            style={{ height: `${(d.ganancia / d.total) * 100}%` }}
                                        ></div>
                                    )}
                                </div>
                                <span className={`text-[9px] font-black uppercase mt-2 ${d.esHoy ? 'text-blue-600' : 'text-slate-400'}`}>{d.dia}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* TOP PRODUCTOS - GLASS LIST */}
                <div className="bg-white p-10 rounded-[3rem] shadow-[0_10px_50px_rgba(0,0,0,0.04)] border border-white">
                    <h3 className="text-sm font-black uppercase mb-8 italic text-black tracking-tighter">Más Vendidos</h3>
                    <div className="space-y-5">
                        {top5.length > 0 ? top5.map(([nombre, cant], i) => (
                            <div key={i} className="flex justify-between items-center p-4 rounded-2xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                                <div className="flex items-center gap-3">
                                    <span className="w-6 h-6 bg-blue-100 text-blue-600 text-[10px] font-black rounded-lg flex items-center justify-center">{i+1}</span>
                                    <span className="text-[11px] font-black text-slate-700 uppercase truncate w-32">{nombre}</span>
                                </div>
                                <span className="bg-slate-900 text-white px-3 py-1.5 rounded-xl text-[10px] font-black shadow-lg shadow-slate-200">{cant} pz</span>
                            </div>
                        )) : (
                            <div className="flex flex-col items-center justify-center h-full opacity-20 py-20 text-center">
                                <span className="text-5xl mb-4">📊</span>
                                <p className="text-[10px] font-black uppercase">Sin datos suficientes</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

          </div>
        </main>
      )}

      {/* VIEW: POS - MODERN RETAIL EXPERIENCE */}
      {vista === 'pos' && (
        <main className="flex-1 flex flex-col md:flex-row overflow-hidden animate-in fade-in duration-500">
          
          <section className="flex-1 p-6 overflow-y-auto">
            <div className="max-w-5xl mx-auto">
                <form 
                    onSubmit={(e) => {
                        e.preventDefault(); 
                        const p = catalogo.find(x => x.barcode === inputBarras); 
                        if(p) { agregarAlCarrito(p); setInputBarras(''); }
                    }} 
                    className="mb-8 relative"
                >
                    <div className="absolute left-6 top-1/2 -translate-y-1/2 text-blue-500">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                    <input 
                        type="text" 
                        placeholder="Busca por nombre o escanea el código..." 
                        className="w-full bg-white p-7 pl-16 rounded-[2rem] shadow-[0_15px_40px_rgba(0,0,0,0.04)] border border-white font-bold text-sm outline-none focus:ring-4 focus:ring-blue-500/5 transition-all text-black placeholder:text-slate-300" 
                        value={inputBarras} 
                        onChange={(e) => setInputBarras(e.target.value)} 
                        autoFocus 
                    />
                </form>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                    {catalogoFiltrado.map(p => (
                        <button 
                            key={p.id} 
                            onClick={() => agregarAlCarrito(p)} 
                            className={`group bg-white p-5 rounded-[2.5rem] shadow-sm border border-white text-left flex flex-col justify-between h-56 transform transition-all hover:scale-[1.05] hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)] active:scale-95 relative overflow-hidden ${p.stock < 5 ? 'border-red-100' : ''}`}
                        >
                            {p.stock < 5 && <div className="absolute top-0 right-0 bg-red-500 text-white text-[7px] font-black px-3 py-1 rounded-bl-xl uppercase">Agotándose</div>}
                            
                            <div className="space-y-4">
                                {p.imagen_url ? (
                                    <div className="w-full h-24 rounded-[1.5rem] overflow-hidden shadow-inner border border-slate-50">
                                        <img src={p.imagen_url} alt={p.nombre} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                    </div>
                                ) : (
                                    <div className="w-full h-24 bg-slate-50 rounded-[1.5rem] flex items-center justify-center border border-dashed border-slate-200">
                                        <span className="text-[8px] text-slate-300 font-black uppercase text-center p-4 leading-tight">Sin imagen premium</span>
                                    </div>
                                )}
                                
                                <div>
                                    <h3 className="font-black text-slate-800 uppercase text-[10px] leading-tight mb-1 truncate group-hover:text-blue-600 transition-colors">
                                        {p.nombre}
                                    </h3>
                                    <p className="text-black font-black text-xl tracking-tighter">
                                        ${parseFloat(p.precio).toFixed(2)}
                                    </p>
                                </div>
                            </div>

                            <div className="flex justify-between items-center mt-3">
                                <span className={`text-[8px] font-black px-2.5 py-1.5 rounded-xl ${p.stock < 5 ? 'bg-red-600 text-white' : 'bg-blue-50 text-blue-600'}`}>
                                    {p.stock} {p.unidad_medida}
                                </span>
                                {p.unidad_medida === 'kg' && (
                                    <div className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center shadow-sm">
                                        <span className="text-[10px]">⚖️</span>
                                    </div>
                                )}
                            </div>
                        </button>
                    ))}
                </div>
            </div>
          </section>

          {/* SHOPPING CART SIDEBAR - THE "PAYMENT TERMINAL" LOOK */}
          <section className="w-full md:w-96 bg-white border-l border-slate-100 shadow-[0_0_80px_rgba(0,0,0,0.05)] flex flex-col h-[70vh] md:h-full z-40 relative">
            <div className="p-8 pb-4">
                <span className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em]">Checkout</span>
                <h2 className="text-2xl font-black text-black tracking-tight">Tu Carrito</h2>
            </div>

            {/* AREA SCROLLABLE: Carrito + Calculadora */}
            <div className="flex-1 overflow-y-auto px-8 space-y-6">
                {carrito.length > 0 ? (
                  <>
                    <div className="space-y-6 mb-6">
                        {carrito.map(i => (
                            <div key={i.id} className="flex justify-between items-start animate-in slide-in-from-right-4">
                                <div className="flex-1 pr-4">
                                    <span className="font-black text-slate-800 uppercase text-[11px] block leading-tight">{i.nombre}</span>
                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{i.cant} {i.unidad_medida} x ${i.precio}</span>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                    <span className="font-black text-black text-sm">${(i.precio * i.cant).toFixed(2)}</span>
                                    <button 
                                        onClick={() => setCarrito(carrito.filter(x => x.id !== i.id))} 
                                        className="w-6 h-6 rounded-full bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all shadow-sm"
                                    >
                                        <span className="text-[14px]">×</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* CALCULETA DE CAMBIO DENTRO DEL SCROLL */}
                    {metodoPago === 'efectivo' && (
                        <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 animate-in zoom-in-95 mb-6">
                            <p className="text-[8px] font-black text-blue-600 uppercase tracking-[0.2em] mb-2 text-center">Calculadora de Cambio</p>
                            <input 
                                type="number" 
                                placeholder="Monto recibido" 
                                className="w-full bg-transparent text-center text-black p-2 rounded-xl font-black text-3xl outline-none placeholder:text-slate-300"
                                value={pagoCon}
                                onChange={(e) => setPagoCon(e.target.value)}
                            />
                            {pagoCon > 0 && (
                                <div className="mt-4 pt-4 border-t border-slate-200 flex justify-between items-center px-4">
                                    <span className="text-[10px] font-black text-emerald-600 uppercase">Cambio:</span>
                                    <span className="text-2xl font-black text-emerald-600">
                                        ${(pagoCon - (carrito.reduce((a,b)=>a+(b.precio*b.cant),0) * (ajustes.aplicar_isr ? 1.16 : 1))).toFixed(2)}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}
                  </>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center opacity-20 text-center space-y-4 py-20">
                        <div className="text-6xl">🛒</div>
                        <p className="text-[10px] font-black uppercase tracking-widest leading-loose">Terminal lista para<br/>escaneo de productos</p>
                    </div>
                )}
            </div>
            
            {/* FOOTER FIJO: Total y Botones de Pago */}
            <div className="p-8 bg-slate-900 md:rounded-t-[4rem] shadow-[0_-20px_60px_rgba(0,0,0,0.2)] text-white">
                
                <div className="flex gap-2 mb-8 bg-white/5 p-1.5 rounded-2xl">
                    <button onClick={() => setMetodoPago('efectivo')} className={`flex-1 py-3 rounded-xl text-[10px] font-black transition-all ${metodoPago === 'efectivo' ? 'bg-white text-black shadow-lg' : 'text-slate-400'}`}>EFECTIVO</button>
                    <button onClick={() => setMetodoPago('tarjeta')} className={`flex-1 py-3 rounded-xl text-[10px] font-black transition-all ${metodoPago === 'tarjeta' ? 'bg-white text-black shadow-lg' : 'text-slate-400'}`}>TARJETA</button>
                </div>

                <div className="flex justify-between items-center mb-8">
                    <div>
                        <span className="text-slate-500 font-black uppercase text-[10px] tracking-widest block mb-1">Total Final</span>
                        {ajustes.aplicar_isr && <span className="text-emerald-500 font-black text-[8px] uppercase">ISR 16% Incluido</span>}
                    </div>
                    <span className="text-4xl font-black text-white tracking-tighter tabular-nums">
                        ${(carrito.reduce((a,b)=>a+(b.precio*b.cant),0) * (ajustes.aplicar_isr ? 1.16 : 1)).toFixed(2)}
                    </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <button 
                        onClick={() => finalizarVenta(false)} 
                        className="bg-slate-800 py-6 rounded-3xl font-black text-[11px] uppercase tracking-widest active:scale-95 transition-transform"
                    >
                        Registro
                    </button>
                    <button 
                        onClick={() => finalizarVenta(true)} 
                        className="bg-blue-600 py-6 rounded-3xl font-black text-[11px] uppercase tracking-widest shadow-xl shadow-blue-500/20 active:scale-95 transition-transform"
                    >
                        Imprimir
                    </button>
                </div>
            </div>
          </section>
        </main>
      )}

      {/* VIEW: SERVICIOS - THE PROFESSIONAL HUB */}
      {vista === 'servicios' && (
        <main className="flex-1 p-8 md:p-12 overflow-y-auto animate-in slide-in-from-right-10 duration-700">
          <div className="max-w-5xl mx-auto">
            <div className="mb-12">
                <span className="bg-blue-100 text-blue-600 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest mb-4 inline-block">Multipagos Hub</span>
                <h2 className="text-5xl font-black text-black tracking-tight mb-4">Ingresos Extra</h2>
                <p className="text-slate-400 text-sm font-medium max-w-xl">Módulo de ingeniería para la gestión de servicios digitales. Registra comisiones de forma automática en tu corte diario.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="bg-white p-10 rounded-[4rem] shadow-sm border border-white group hover:shadow-[0_30px_60px_rgba(37,99,235,0.1)] transition-all duration-500 flex flex-col justify-between h-[450px]">
                    <div className="space-y-6">
                        <div className="w-20 h-20 bg-blue-50 rounded-[2rem] flex items-center justify-center text-4xl shadow-inner border border-blue-100 group-hover:rotate-6 transition-transform">📱</div>
                        <div>
                            <h3 className="font-black text-2xl text-black uppercase mb-3">Recargas TAE</h3>
                            <p className="text-slate-400 text-[12px] font-medium leading-relaxed">Vende saldo Telcel, AT&T y Movistar. La integración abre el portal oficial y registra tu ganancia automáticamente.</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => { window.open('https://portal.taecel.com/', '_blank'); registrarComisionServicio('Recarga'); }} 
                        className="w-full bg-blue-600 text-white font-black py-7 rounded-[2rem] shadow-xl shadow-blue-200 uppercase text-[12px] tracking-widest hover:bg-blue-700 transition-all hover:scale-[1.02]"
                    >
                        Abrir Terminal TAE
                    </button>
                </div>

                <div className="bg-white p-10 rounded-[4rem] shadow-sm border border-white group hover:shadow-[0_30px_60px_rgba(16,185,129,0.1)] transition-all duration-500 flex flex-col justify-between h-[450px]">
                    <div className="space-y-6">
                        <div className="w-20 h-20 bg-emerald-50 rounded-[2rem] flex items-center justify-center text-4xl shadow-inner border border-emerald-100 group-hover:-rotate-6 transition-transform">⚡</div>
                        <div>
                            <h3 className="font-black text-2xl text-black uppercase mb-3">Recibo CFE/IZZI</h3>
                            <p className="text-slate-400 text-[12px] font-medium leading-relaxed">Gestión de pagos para servicios domésticos. Cobra la comisión sugerida de $10.00 por trámite físico.</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => { registrarComisionServicio('Pago de Servicio'); showMsg("RECIBO REGISTRADO"); }}
                        className="w-full bg-emerald-600 text-white font-black py-7 rounded-[2rem] shadow-xl shadow-emerald-200 uppercase text-[12px] tracking-widest hover:bg-emerald-700 transition-all hover:scale-[1.02]"
                    >
                        Registrar Pago Físico
                    </button>
                </div>
            </div>

            <div className="mt-12 p-10 bg-slate-900 rounded-[3.5rem] text-white flex flex-col md:flex-row justify-between items-center gap-8 border-b-[12px] border-blue-600 shadow-2xl">
                <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center text-2xl text-blue-400">💡</div>
                    <div className="space-y-1">
                        <p className="text-[12px] font-black uppercase tracking-[0.2em] text-blue-400">Estrategia de Negocio</p>
                        <p className="text-lg font-bold">Ganancia Neta Sugerida: <span className="text-blue-400">$10.00 MXN</span> por operación.</p>
                    </div>
                </div>
            </div>
          </div>
        </main>
      )}

      {/* VIEW: STOCK - DATA MANAGEMENT PRO */}
      {vista === 'inventario' && (
        <main className="flex-1 p-8 md:p-12 overflow-y-auto animate-in slide-in-from-left-10 duration-700">
          <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-5 gap-12">
            
            <div className="lg:col-span-2 space-y-8">
                <div className="bg-white p-10 rounded-[3.5rem] shadow-xl border border-white">
                    <h2 className="font-black text-2xl mb-10 italic uppercase text-black tracking-tighter text-center">Nuevo Registro</h2>
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Nombre Comercial</label>
                            <input type="text" placeholder="Ej. Coca Cola 600ml" className="w-full bg-slate-50 p-6 rounded-3xl font-bold border-2 border-transparent focus:border-blue-500 focus:bg-white outline-none transition-all" value={nuevoProd.nombre} onChange={e => setNuevoProd({...nuevoProd, nombre: e.target.value})}/>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Código de Barras</label>
                            <input type="text" placeholder="Escanear o Escribir..." className="w-full bg-slate-50 p-6 rounded-3xl font-bold border-2 border-transparent focus:border-blue-500 focus:bg-white outline-none transition-all" value={nuevoProd.barcode} onChange={e => setNuevoProd({...nuevoProd, barcode: e.target.value})}/>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3 p-1.5 bg-slate-50 rounded-[1.8rem]">
                            <button 
                                onClick={() => setNuevoProd({...nuevoProd, unidad_medida: 'pz'})}
                                className={`py-4 rounded-2xl font-black text-[10px] uppercase transition-all ${nuevoProd.unidad_medida === 'pz' ? 'bg-white text-black shadow-md' : 'text-slate-400'}`}
                            >
                                Pieza
                            </button>
                            <button 
                                onClick={() => setNuevoProd({...nuevoProd, unidad_medida: 'kg'})}
                                className={`py-4 rounded-2xl font-black text-[10px] uppercase transition-all ${nuevoProd.unidad_medida === 'kg' ? 'bg-white text-black shadow-md' : 'text-slate-400'}`}
                            >
                                Kilo
                            </button>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Fotografía de Alta Calidad</label>
                            <input 
                                type="file" 
                                accept="image/*" 
                                className="w-full bg-slate-50 p-5 rounded-3xl font-bold text-[10px] text-black border border-slate-100 file:mr-4 file:py-2 file:px-6 file:rounded-full file:border-0 file:text-[10px] file:font-black file:bg-blue-600 file:text-white" 
                                onChange={(e) => { if(e.target.files[0]) { setFile(e.target.files[0]); showMsg("MEDIA CARGADA"); } }}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Costo ($)</label>
                                <input type="number" placeholder="0.00" className="w-full bg-slate-50 p-6 rounded-3xl font-bold border-2 border-transparent focus:border-blue-500 outline-none" value={nuevoProd.precio_compra} onChange={e => setNuevoProd({...nuevoProd, precio_compra: e.target.value})}/>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest ml-4">Venta ($)</label>
                                <input type="number" placeholder="0.00" className="w-full bg-slate-50 p-6 rounded-3xl font-bold border-2 border-transparent focus:border-blue-500 outline-none" value={nuevoProd.precio} onChange={e => setNuevoProd({...nuevoProd, precio: e.target.value})}/>
                            </div>
                        </div>

                        {nuevoProd.precio && nuevoProd.precio_compra && (
                            <div className="bg-blue-600 p-6 rounded-[2rem] text-white flex justify-between items-center shadow-xl shadow-blue-200 animate-in zoom-in-95">
                                <span className="text-[10px] font-black uppercase">Rentabilidad:</span>
                                <div className="text-right">
                                    <span className="font-black text-xl block">${(parseFloat(nuevoProd.precio) - parseFloat(nuevoProd.precio_compra)).toFixed(2)}</span>
                                    <span className="text-[10px] font-bold opacity-80">{(((parseFloat(nuevoProd.precio) - parseFloat(nuevoProd.precio_compra)) / parseFloat(nuevoProd.precio_compra)) * 100).toFixed(0)}% de margen</span>
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Stock Inicial</label>
                            <input 
                                type="number" 
                                step={nuevoProd.unidad_medida === 'kg' ? '0.001' : '1'} 
                                placeholder="Cantidad" 
                                className="w-full bg-slate-50 p-6 rounded-3xl font-bold border-2 border-transparent focus:border-blue-500 outline-none" 
                                value={nuevoProd.stock} 
                                onChange={e => setNuevoProd({...nuevoProd, stock: e.target.value})}
                            />
                        </div>

                        <button 
                            onClick={async () => {
                                let url = null;
                                if (file) url = await uploadImagen(file); 
                                const finalStock = parseFloat(nuevoProd.stock) || 0;
                                const { error } = await supabase.from('productos').insert([{...nuevoProd, stock: finalStock, empresa_id: profile.empresa_id, imagen_url: url }]);
                                if (error) return showMsg("Error", "error");
                                showMsg("¡PRODUCTO CREADO!");
                                setNuevoProd({nombre:'', precio:'', stock: '', barcode: '', precio_compra: '', unidad_medida: 'pz'});
                                setFile(null); fetchData();
                            }} 
                            className="w-full bg-black text-white font-black py-7 rounded-3xl shadow-2xl shadow-slate-300 uppercase text-[12px] tracking-[0.3em] transition-all hover:bg-slate-800"
                        >
                            Alta en Nube
                        </button>
                    </div>
                </div>
            </div>

            <div className="lg:col-span-3 space-y-6">
                <div className="bg-white rounded-[4rem] shadow-sm border border-white overflow-hidden">
                    <div className="p-10 border-b border-slate-50 flex justify-between items-center">
                        <h2 className="text-xl font-black uppercase tracking-tighter italic">Inventario Activo</h2>
                        <span className="bg-slate-100 text-slate-600 px-4 py-1.5 rounded-full text-[10px] font-black">{catalogo.length} SKUS</span>
                    </div>
                    <div className="max-h-[800px] overflow-y-auto">
                        {catalogo.map(p => (
                            <div key={p.id} className="p-8 border-b border-slate-50 flex justify-between items-center gap-6 hover:bg-slate-50 transition-colors group">
                                <div className="flex items-center gap-6">
                                    <div className="w-16 h-16 bg-slate-100 rounded-2xl overflow-hidden flex items-center justify-center border border-slate-100">
                                        {p.imagen_url ? <img src={p.imagen_url} className="w-full h-full object-cover" /> : <span className="text-[8px] font-black text-slate-300">N/A</span>}
                                    </div>
                                    <div className="flex-1">
                                        <span className="font-black text-sm text-black uppercase block tracking-tight">{p.nombre}</span>
                                        <div className="flex items-center gap-4 mt-1">
                                            <span className={`text-[10px] font-bold uppercase ${p.stock < 5 ? 'text-red-500' : 'text-slate-400'}`}>Disp: {p.stock}</span>
                                            <span className="text-[10px] font-black text-emerald-600 uppercase bg-emerald-50 px-3 py-0.5 rounded-full">UTIL: ${(p.precio - p.precio_compra).toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <input 
                                        type="number" 
                                        step={p.unidad_medida === 'kg' ? '0.001' : '1'} 
                                        className="w-24 bg-white p-3 rounded-xl font-black text-center text-sm border-2 border-slate-100 focus:border-blue-500 outline-none" 
                                        defaultValue={p.stock} 
                                        onBlur={(e) => {
                                            const val = parseFloat(e.target.value) || 0;
                                            supabase.from('productos').update({ stock: val }).eq('id', p.id).then(()=>{ fetchData(); showMsg("STOCK SINCRONIZADO"); });
                                        }}
                                    />
                                    <button 
                                        onClick={async () => { 
                                            setConfirmModal({
                                                visible: true,
                                                titulo: `¿Eliminar ${p.nombre}?`,
                                                accion: async () => {
                                                    const { error } = await supabase.from('productos').delete().eq('id', p.id); 
                                                    if (error) showMsg("Error", "error"); else { fetchData(); showMsg("¡ELIMINADO!"); }
                                                }
                                            });
                                        }} 
                                        className="bg-white text-red-500 w-12 h-12 flex items-center justify-center rounded-2xl border-2 border-red-50 hover:bg-red-500 hover:text-white transition-all shadow-sm"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
          </div>
        </main>
      )}

      {/* VIEW: PROVEEDORES - SUPPLY CHAIN PREMIUM */}
      {vista === 'proveedores' && (
        <main className="flex-1 p-8 md:p-12 overflow-y-auto animate-in zoom-in-95 duration-700">
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-10">
            
            <div className="lg:col-span-2 space-y-10">
                <div className="bg-white p-12 rounded-[4rem] shadow-xl border border-white">
                    <h2 className="font-black text-3xl mb-10 italic uppercase text-black tracking-tighter flex items-center gap-4">
                        <span className="bg-orange-500 text-white w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-200">💰</span> Registrar Gasto
                    </h2>
                    
                    <div className="space-y-10">
                        <div>
                            <p className="text-[12px] font-black text-slate-400 uppercase tracking-[0.3em] mb-6 ml-2">Selección de Proveedor</p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                {proveedores.map(p => (
                                    <div key={p.id} className="relative group">
                                        <button 
                                            onClick={() => setNuevaCompra({...nuevaCompra, proveedor_id: p.id})}
                                            className={`w-full p-6 rounded-[2rem] border-2 transition-all text-left h-32 flex flex-col justify-between ${nuevaCompra.proveedor_id === p.id ? 'border-orange-500 bg-orange-50 ring-4 ring-orange-500/5' : 'border-slate-100 bg-slate-50 hover:border-orange-200'}`}
                                        >
                                            <span className={`block text-[12px] font-black uppercase ${nuevaCompra.proveedor_id === p.id ? 'text-orange-600' : 'text-slate-700'}`}>{p.nombre}</span>
                                            <span className="text-[9px] text-slate-400 font-bold uppercase truncate w-full">{p.contacto || 'Sin contacto'}</span>
                                        </button>
                                        <div className="absolute -top-2 -right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={(e) => { e.stopPropagation(); setEditandoProv(p.id); setNuevoProv({nombre: p.nombre, contacto: p.contacto}); }} className="bg-blue-600 text-white w-8 h-8 rounded-xl text-[10px] font-black shadow-lg">✎</button>
                                            <button onClick={(e) => { e.stopPropagation(); setConfirmModal({ visible: true, titulo: `Eliminar ${p.nombre}`, accion: async () => { await supabase.from('proveedores').delete().eq('id', p.id); fetchData(); showMsg("ELIMINADO"); } }); }} className="bg-red-600 text-white w-8 h-8 rounded-xl text-[10px] font-black shadow-lg">×</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Importe Neto ($)</label>
                                <input type="number" placeholder="0.00" className="w-full bg-slate-50 p-7 rounded-[2rem] font-black outline-none border-2 border-transparent focus:border-orange-500 focus:bg-white transition-all text-2xl" value={nuevaCompra.monto_total} onChange={e => setNuevaCompra({...nuevaCompra, monto_total: e.target.value})}/>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Referencia de Compra</label>
                                <textarea placeholder="¿Qué insumos recibiste?" className="w-full bg-slate-50 p-7 rounded-[2rem] font-black outline-none border-2 border-transparent focus:border-orange-500 focus:bg-white transition-all text-xs resize-none h-[92px]" value={nuevaCompra.detalles} onChange={e => setNuevaCompra({...nuevaCompra, detalles: e.target.value})}></textarea>
                            </div>
                        </div>

                        <button 
                            onClick={async () => {
                                if(!nuevaCompra.proveedor_id || !nuevaCompra.monto_total) return showMsg("Datos incompletos", "error");
                                await supabase.from('compras_proveedores').insert([{...nuevaCompra, empresa_id: profile.empresa_id}]);
                                showMsg("SALIDA DE DINERO REGISTRADA");
                                setNuevaCompra({proveedor_id:'', monto_total:'', detalles:''});
                                fetchData();
                            }} 
                            className="w-full bg-orange-600 text-white font-black py-8 rounded-[2.5rem] shadow-[0_20px_40px_rgba(234,88,12,0.2)] uppercase text-[12px] tracking-[0.4em] hover:bg-orange-500 transition-all hover:scale-[1.01]"
                        >
                            Confirmar Transacción
                        </button>
                    </div>
                </div>

                <div className="bg-white rounded-[4rem] shadow-sm border border-white overflow-hidden">
                    <div className="p-10 border-b flex justify-between items-center bg-orange-50/30">
                        <h2 className="text-xl font-black uppercase tracking-tighter italic text-orange-950">Últimos Egresos</h2>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                        {compras.map(c => (
                            <div key={c.id} className="p-8 border-b border-slate-50 flex justify-between items-center hover:bg-slate-50 transition-colors">
                                <div className="flex items-center gap-6">
                                    <div className="w-14 h-14 bg-orange-100 rounded-2xl flex items-center justify-center text-orange-600 font-black text-sm">
                                        {c.proveedores?.nombre?.substring(0,2).toUpperCase()}
                                    </div>
                                    <div>
                                        <span className="font-black text-[13px] text-slate-800 uppercase block tracking-tight">{c.proveedores?.nombre}</span>
                                        <span className="text-[10px] text-slate-400 font-bold uppercase">{new Date(c.fecha).toLocaleDateString()}</span>
                                    </div>
                                </div>
                                <span className="text-red-500 font-black text-2xl tracking-tighter">-${parseFloat(c.monto_total).toFixed(2)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="space-y-10">
                <div className={`p-10 rounded-[4rem] shadow-2xl border-b-[16px] transition-all duration-700 ${editandoProv ? 'bg-blue-600 border-white' : 'bg-slate-900 border-blue-600'}`}>
                    <h2 className="font-black text-2xl mb-8 italic uppercase text-white tracking-tighter flex items-center gap-4">
                        <span>{editandoProv ? '📝' : '🔌'}</span> {editandoProv ? 'Edición' : 'Alta de Alianza'}
                    </h2>
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-blue-400 uppercase tracking-widest ml-4">Nombre de la Empresa</label>
                            <input type="text" placeholder="Ej. Sigma Alimentos" className="w-full bg-white/10 text-white p-6 rounded-[1.8rem] font-bold outline-none border border-white/5 focus:bg-white/20 transition-all placeholder:text-white/20" value={nuevoProv.nombre} onChange={e => setNuevoProv({...nuevoProv, nombre: e.target.value})}/>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-blue-400 uppercase tracking-widest ml-4">Contacto Directo</label>
                            <input type="text" placeholder="Teléfono o Correo" className="w-full bg-white/10 text-white p-6 rounded-[1.8rem] font-bold outline-none border border-white/5 focus:bg-white/20 transition-all placeholder:text-white/20" value={nuevoProv.contacto} onChange={e => setNuevoProv({...nuevoProv, contacto: e.target.value})}/>
                        </div>
                        <button 
                            onClick={async () => {
                                if(!nuevoProv.nombre) return showMsg("Nombre requerido", "error");
                                if(editandoProv) await supabase.from('proveedores').update(nuevoProv).eq('id', editandoProv);
                                else await supabase.from('proveedores').insert([{...nuevoProv, empresa_id: profile.empresa_id}]);
                                showMsg(editandoProv ? "ACTUALIZADO" : "REGISTRADO");
                                setEditandoProv(null); setNuevoProv({nombre:'', contacto:'', categoria:''}); fetchData();
                            }} 
                            className={`w-full font-black py-7 rounded-[1.8rem] shadow-xl uppercase text-[11px] tracking-[0.3em] transition-all ${editandoProv ? 'bg-white text-blue-600' : 'bg-blue-600 text-white'}`}
                        >
                            {editandoProv ? 'Sincronizar Cambios' : 'Registrar Proveedor'}
                        </button>
                    </div>
                </div>
                
                <div className="bg-orange-600 p-10 rounded-[4rem] text-white shadow-[0_30px_60px_rgba(234,88,12,0.3)] relative overflow-hidden group h-52 flex flex-col justify-between">
                    <div className="relative z-10">
                        <p className="text-[11px] font-black uppercase opacity-80 mb-1 tracking-widest">Gastos Totales</p>
                        <h2 className="text-5xl font-black tracking-tighter tabular-nums">${totalGastos.toFixed(2)}</h2>
                    </div>
                    <div className="absolute -right-6 -bottom-6 text-9xl opacity-20 group-hover:scale-110 transition-transform">📊</div>
                </div>

                <button 
                    onClick={generarTicketCorteProveedores}
                    className="w-full bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center justify-between group hover:bg-slate-900 transition-all duration-500"
                >
                    <span className="text-[11px] font-black uppercase tracking-widest group-hover:text-white transition-colors">Generar Ticket de Corte Físico</span>
                    <span className="text-2xl group-hover:translate-x-2 transition-transform">🖨️</span>
                </button>
            </div>

          </div>
        </main>
      )}


      {/* VIEW: CORTE - FINANCIAL REPORTING PRO */}
      {vista === 'corte' && (
        <main className="flex-1 p-8 md:p-12 overflow-y-auto animate-in fade-in duration-1000">
          <div className="max-w-4xl mx-auto space-y-10">
            
            <div className="bg-white p-8 rounded-[3.5rem] shadow-xl border border-slate-50 flex flex-col md:flex-row justify-between items-center gap-8">
                <div>
                    <h3 className="font-black text-3xl text-black tracking-tight uppercase italic">Auditoría de Ventas</h3>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1">Sincronización en tiempo real con Supabase</p>
                </div>
                <input 
                    type="date" 
                    className="bg-black text-white p-6 rounded-[1.8rem] font-black text-sm outline-none shadow-2xl shadow-blue-500/20 active:scale-95 transition-all" 
                    value={fechaConsulta} 
                    onChange={(e) => setFechaConsulta(e.target.value)}
                />
            </div>

            <div className="bg-[#1c1c1e] p-16 rounded-[4.5rem] text-white shadow-[0_40px_100px_rgba(0,0,0,0.3)] relative overflow-hidden border border-white/5">
                <div className="absolute top-0 right-0 p-10 opacity-10">
                    <div className="w-40 h-40 border-[20px] border-blue-500 rounded-full"></div>
                </div>
                
                <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-12">
                    <div className="space-y-4">
                        <p className="text-[12px] font-black uppercase tracking-[0.4em] text-blue-500">Corte Diario Total</p>
                        <h2 className="text-7xl font-black tracking-tighter tabular-nums">${totalCorte.toFixed(2)}</h2>
                        <div className="flex gap-4 pt-4">
                            <span className="bg-emerald-500/20 text-emerald-400 px-4 py-2 rounded-xl text-[10px] font-black uppercase border border-emerald-500/30">Caja Operativa</span>
                        </div>
                    </div>
                    <div className="flex flex-col justify-center space-y-6 border-l border-white/5 pl-12">
                        <div>
                            <p className="text-[10px] font-black text-white/40 uppercase mb-1">Entrada Efectivo</p>
                            <p className="text-3xl font-black tracking-tight text-blue-400">${efectivoCorte.toFixed(2)}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-white/40 uppercase mb-1">Terminal Bancaria</p>
                            <p className="text-3xl font-black tracking-tight text-purple-400">${tarjetaCorte.toFixed(2)}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 ml-6">Log de Transacciones</h3>
                {ventasFiltradas.length > 0 ? ventasFiltradas.map(v => (
                    <div key={v.id} className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-50 flex flex-col gap-6 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-4">
                                <div className={`w-3 h-3 rounded-full ${v.metodo_pago === 'tarjeta' ? 'bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]' : 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]'}`}></div>
                                <span className="text-[11px] font-black uppercase text-slate-400">{new Date(v.fecha).toLocaleTimeString()}</span>
                            </div>
                            <span className={`px-5 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${v.metodo_pago === 'tarjeta' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>{v.metodo_pago}</span>
                        </div>
                        
                        <div className="bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100/50">
                            <div className="flex flex-wrap gap-3">
                                {v.items?.map((item, idx) => (
                                    <span key={idx} className="bg-white px-4 py-2 rounded-xl shadow-sm border border-white text-[10px] font-black text-slate-800 uppercase">
                                        <span className="text-blue-600 mr-2">{item.cant}{item.unidad_medida === 'kg' ? 'kg' : 'x'}</span> {item.nombre}
                                    </span>
                                ))}
                            </div>
                        </div>

                        <div className="flex justify-between items-center pt-2">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-slate-900 rounded-full flex items-center justify-center text-white text-[8px] font-black">VD</div>
                                <span className="text-[10px] font-black text-slate-600 uppercase tracking-tighter">Atendió: {v.vendedor?.split('@')[0]}</span>
                            </div>
                            <span className="text-3xl font-black tabular-nums text-black tracking-tighter">${parseFloat(v.total).toFixed(2)}</span>
                        </div>
                    </div>
                )) : (
                    <div className="p-20 text-center bg-white rounded-[3rem] border border-dashed border-slate-200">
                        <p className="text-slate-300 font-black uppercase text-[12px] tracking-[0.4em]">Sin registros para esta fecha</p>
                    </div>
                )}
            </div>
          </div>
        </main>
      )}

      {/* VIEW: SETTINGS - CONTROL PANEL */}
      {vista === 'ajustes' && (
        <main className="flex-1 p-8 md:p-12 overflow-y-auto animate-in slide-in-from-right-10 duration-700">
          <div className="max-w-xl mx-auto space-y-10">
            <div className="bg-white p-12 rounded-[4rem] shadow-2xl border border-white">
              <div className="text-center mb-12">
                <h2 className="font-black text-4xl mb-3 italic uppercase text-black tracking-tighter">Panel Maestro</h2>
                <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.4em]">Configuración Global de Sistema</p>
              </div>
              
              <div className="space-y-6">
                {[
                  {
                    id: 'aplicar_isr', 
                    label: 'Algoritmo ISR (16%)', 
                    desc: 'Aplica impuestos automáticos en el checkout',
                    checked: ajustes.aplicar_isr,
                    action: (val) => {
                        setAjustes({...ajustes, aplicar_isr: val});
                        supabase.from('configuracion_sistema').update({ aplicar_isr: val }).eq('user_id', session.user.id).then(()=>showMsg("ISR ACTUALIZADO"));
                    }
                  },
                  {
                    id: 'mostrar_top_productos', 
                    label: 'Analytics: Top Productos', 
                    desc: 'Visualiza los productos más rentables',
                    checked: ajustes.mostrar_top_productos,
                    action: (val) => {
                        setAjustes({...ajustes, mostrar_top_productos: val});
                        supabase.from('configuracion_sistema').update({ mostrar_top_productos: val }).eq('user_id', session.user.id).then(()=>showMsg("ANALYTICS ACTUALIZADO"));
                    }
                  },
                  {
                    id: 'mostrar_ganancias', 
                    label: 'Sensor de Ganancias', 
                    desc: 'Muestra la utilidad real en el inventario',
                    checked: ajustes.mostrar_ganancias,
                    action: (val) => {
                        setAjustes({...ajustes, mostrar_ganancias: val});
                        supabase.from('configuracion_sistema').update({ mostrar_ganancias: val }).eq('user_id', session.user.id).then(()=>showMsg("SENSORES ACTUALIZADOS"));
                    }
                  }
                ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-8 bg-slate-50 rounded-[2.5rem] border border-transparent hover:border-blue-100 transition-all group">
                        <div className="flex-1 pr-6">
                            <span className="font-black text-[13px] text-black uppercase block mb-1 tracking-tight">{item.label}</span>
                            <span className="text-[10px] text-slate-400 font-medium leading-relaxed block">{item.desc}</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                                type="checkbox" 
                                className="sr-only peer"
                                checked={item.checked} 
                                onChange={(e) => item.action(e.target.checked)} 
                            />
                            <div className="w-14 h-8 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600 shadow-inner"></div>
                        </label>
                    </div>
                ))}
              </div>

              <div className="mt-16 pt-10 border-t border-dashed border-slate-100 text-center space-y-4">
                 <div className="flex justify-center gap-4">
                    <span className="w-3 h-3 rounded-full bg-blue-600 animate-pulse"></span>
                    <span className="w-3 h-3 rounded-full bg-indigo-600 animate-pulse delay-75"></span>
                    <span className="w-3 h-3 rounded-full bg-purple-600 animate-pulse delay-150"></span>
                 </div>
                 <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.5em]">Velasco Digital Co. Engineering</p>
                 <p className="text-[8px] font-bold text-slate-200 uppercase">Licensed to: {profile?.nombre_empresa || 'Premium User'}</p>
              </div>
            </div>
          </div>
        </main>
      )}
    </div>
  );
}
