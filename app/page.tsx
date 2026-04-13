// @ts-nocheck
"use client";
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
// --- 1. IMPORTACIÓN DEL SENSOR ---
import { useUserRole } from '../hooks/useUserRole'; 

export default function VelascoPOS_Ultimate() {
  // --- 2. ACTIVACIÓN DEL SENSOR ---
  const { rol, loading: cargandoPerfil } = useUserRole();
  
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
  const [inputBarras, setInputBarras] = useState('');

  // --- ESTADOS PARA PROVEEDORES ---
  const [proveedores, setProveedores] = useState([]);
  const [compras, setCompras] = useState([]);
  const [nuevoProv, setNuevoProv] = useState({ nombre: '', contacto: '', categoria: '' });
  const [nuevaCompra, setNuevaCompra] = useState({ proveedor_id: '', monto_total: '', detalles: '' });

  // --- NOTIFICACIONES ---
  const [toast, setToast] = useState({ visible: false, msg: '', tipo: 'success' });

  useEffect(() => {
    setMontado(true);
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if(session) {
        // Ya no necesitamos checar el email aquí, el hook lo hace por nosotros
        fetchData();
      }
    });
  }, []);

  const showMsg = (msg, tipo = 'success') => {
    setToast({ visible: true, msg, tipo });
    setTimeout(() => setToast({ visible: false, msg: '', tipo: 'success' }), 2500);
  };

  const fetchData = async () => {
    const { data: catData } = await supabase.from('productos').select('*').order('id', { ascending: true });
    if (catData) setCatalogo(catData);
    
    const { data: histData } = await supabase.from('ventas').select('*').order('id', { ascending: false }).limit(500);
    if (histData) setHistorial(histData);

    const { data: provData } = await supabase.from('proveedores').select('*');
    if (provData) setProveedores(provData);

    const { data: compData } = await supabase.from('compras_proveedores').select('*, proveedores(nombre)').order('id', { ascending: false });
    if (compData) setCompras(compData);
  };

    const handleLogin = async () => {
    alert("¡Botón presionado!"); // Para saber si el botón responde
    
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
      alert("Error de Supabase: " + error.message);
      showMsg("Credenciales incorrectas", "error");
    } else {
      alert("¡Entraste! Recargando...");
      window.location.reload();
    }
  };


  const agregarAlCarrito = (p) => {
    if(p.stock <= 0) return showMsg("¡Sin existencias!", "error");
    const ex = carrito.find(i => i.id === p.id);
    if (ex) setCarrito(carrito.map(i => i.id === p.id ? {...i, cant: i.cant + 1} : i));
    else setCarrito([...carrito, {...p, cant: 1}]);
  };

  const finalizarVenta = async (imprimir = false) => {
    if (carrito.length === 0) return;
    const subtotal = carrito.reduce((a,b)=>a+(b.precio*b.cant), 0);
    const totalVenta = subtotal * 1.16;
    
    const { error } = await supabase.from('ventas').insert([{ 
        items: carrito, 
        total: totalVenta, 
        vendedor: session.user.email,
        metodo_pago: metodoPago 
    }]).select();
    
    if (error) return showMsg("Error de red", "error");
    for (const item of carrito) {
        await supabase.rpc('decrement_stock', { row_id: item.id, amount: item.cant });
    }
    if (imprimir) {
        setTicketImpresion({ items: [...carrito], total: totalVenta, fecha: new Date().toLocaleString(), vendedor: session.user.email, metodo: metodoPago });
        setTimeout(() => { window.print(); setCarrito([]); fetchData(); }, 500);
    } else {
        showMsg("¡VENTA COMPLETADA! 🚀");
        setCarrito([]);
        fetchData();
    }
  };

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
    const totalDia = historial
        .filter(v => new Date(v.fecha).toDateString() === dia)
        .reduce((acc, v) => acc + parseFloat(v.total), 0);
    return { dia: dia.split(' ')[0], total: totalDia, esHoy: dia === hoyStr };
  });

  const maxVenta = Math.max(...dataGrafica.map(d => d.total), 1);
  const conteoProd = {};
  historial.forEach(v => {
    v.items?.forEach(item => {
        conteoProd[item.nombre] = (conteoProd[item.nombre] || 0) + item.cant;
    });
  });
  const top5 = Object.entries(conteoProd).sort((a,b) => b[1] - a[1]).slice(0, 5);

  // --- PANTALLA DE CARGA PARA SEGURIDAD ---
  if (cargandoPerfil && session) {
    return (
      <div className="h-screen bg-slate-900 flex items-center justify-center text-white font-black italic">
        VERIFICANDO PERFIL...
      </div>
    );
  }

  if (!session && montado) {
    return (
      <div className="bg-slate-900 h-screen flex items-center justify-center p-6 text-black">
        <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl w-full max-w-md text-center border-t-8 border-blue-600">
          <h1 className="text-blue-600 font-black italic text-4xl mb-2 tracking-tighter">VD POS</h1>
          <p className="text-slate-400 text-[10px] uppercase tracking-[0.3em] mb-8 font-bold">Velasco Digital Login</p>
          <input type="email" placeholder="Usuario" className="w-full bg-slate-50 p-5 rounded-2xl mb-4 font-bold outline-none" value={email} onChange={e => setEmail(e.target.value)} />
          <input type="password" placeholder="Clave" className="w-full bg-slate-50 p-5 rounded-2xl mb-8 font-bold outline-none" value={password} onChange={e => setPassword(e.target.value)} />
          <button onClick={handleLogin} className="w-full bg-blue-600 text-white font-black py-5 rounded-2xl shadow-xl">ACCEDER</button>
        </div>
      </div>
    );
  }

  if (!montado) return null;

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

      {/* TOAST IPHONE STYLE */}
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

      {/* TICKET IMPRESIÓN */}
      <div id="tk-gh">
          <center>
            <h2 className="font-bold">VELASCO DIGITAL</h2>
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
            {/* TRUCO DE DESAPARICIÓN: SOLO ADMIN */}
            {rol === 'admin' && (
                <button onClick={() => setVista('dashboard')} className={`flex-1 sm:px-4 py-2 rounded-xl text-[9px] font-black ${vista === 'dashboard' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>DASHBOARD</button>
            )}
            <button onClick={() => setVista('pos')} className={`flex-1 sm:px-4 py-2 rounded-xl text-[9px] font-black ${vista === 'pos' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>CAJA</button>
            
            {/* TRUCO DE DESAPARICIÓN: SOLO ADMIN */}
            {rol === 'admin' && (
                <>
                <button onClick={() => setVista('inventario')} className={`flex-1 sm:px-4 py-2 rounded-xl text-[9px] font-black ${vista === 'inventario' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>STOCK</button>
                <button onClick={() => setVista('proveedores')} className={`flex-1 sm:px-4 py-2 rounded-xl text-[9px] font-black ${vista === 'proveedores' ? 'bg-orange-600 text-white' : 'text-slate-400'}`}>PROVEEDORES</button>
                <button onClick={() => setVista('corte')} className={`flex-1 sm:px-4 py-2 rounded-xl text-[9px] font-black ${vista === 'corte' ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}>CORTE</button>
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
                                    className={`w-full rounded-t-xl transition-all duration-700 ${d.esHoy ? 'bg-blue-600 shadow-lg shadow-blue-500/30' : 'bg-slate-200 group-hover:bg-blue-300'}`} 
                                    style={{ height: `${(d.total / maxVenta) * 75}%`, minHeight: d.total > 0 ? '4px' : '2px' }}
                                ></div>
                                <span className={`text-[8px] font-black uppercase mt-2 ${d.esHoy ? 'text-blue-600' : 'text-slate-400'}`}>{d.dia}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white p-8 rounded-[3rem] shadow-sm border">
                    <h3 className="text-xs font-black uppercase mb-6 italic text-slate-800 tracking-tighter">Top 5 Productos</h3>
                    <div className="space-y-4">
                        {top5.map(([nombre, cant], i) => (
                            <div key={i} className="flex justify-between items-center border-b pb-2">
                                <span className="text-[10px] font-black text-slate-600 uppercase">{nombre}</span>
                                <span className="bg-blue-100 text-blue-600 px-3 py-1 rounded-full text-[9px] font-black">{cant} pz</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
          </div>
        </main>
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
                    className="w-full bg-white p-4 pl-10 rounded-2xl shadow-sm border border-blue-100 font-bold text-xs outline-none focus:border-blue-500 transition-all" 
                    value={inputBarras} 
                    onChange={(e) => setInputBarras(e.target.value)} 
                    autoFocus 
                />
            </form>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-3 content-start">
                {catalogoFiltrado.map(p => (
                <button key={p.id} onClick={() => agregarAlCarrito(p)} className={`bg-white p-5 rounded-[2rem] shadow-sm border text-left flex flex-col justify-between h-36 transform transition-all hover:scale-105 active:scale-95 ${p.stock < 5 ? 'border-red-200 bg-red-50/20' : 'border-slate-100'}`}>
                    <div>
                        <h3 className="font-black text-slate-800 uppercase text-[10px] leading-tight mb-2 h-8 overflow-hidden">{p.nombre}</h3>
                        <p className="text-blue-600 font-black text-lg tracking-tighter">${parseFloat(p.precio).toFixed(2)}</p>
                    </div>
                    <span className={`text-[8px] font-black px-2 py-1 rounded-lg w-fit ${p.stock < 5 ? 'bg-red-600 text-white animate-pulse' : 'bg-green-100 text-green-600'}`}>STOCK: {p.stock}</span>
                </button>
                ))}
            </div>
          </section>

          <section className="w-full md:w-80 lg:w-96 bg-white border-l shadow-2xl flex flex-col h-[45vh] md:h-full no-print">
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
              <div className="flex gap-2 mb-4">
                <button onClick={() => setMetodoPago('efectivo')} className={`flex-1 py-2 rounded-xl text-[9px] font-black border ${metodoPago === 'efectivo' ? 'bg-blue-600 border-blue-500' : 'border-slate-700 text-slate-500'}`}>EFECTIVO</button>
                <button onClick={() => setMetodoPago('tarjeta')} className={`flex-1 py-2 rounded-xl text-[9px] font-black border ${metodoPago === 'tarjeta' ? 'bg-indigo-600 border-indigo-500' : 'border-slate-700 text-slate-500'}`}>TARJETA</button>
              </div>
              <div className="flex justify-between items-end mb-6">
                <span className="text-blue-400 font-black italic text-xs">TOTAL:</span>
                <span className="text-4xl font-black text-green-400 tracking-tighter">${(carrito.reduce((a,b)=>a+(b.precio*b.cant),0)*1.16).toFixed(2)}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => finalizarVenta(false)} className="bg-slate-700 py-5 rounded-2xl font-black text-[10px] uppercase">Registrar</button>
                <button onClick={() => finalizarVenta(true)} className="bg-blue-600 py-5 rounded-2xl font-black text-[10px] uppercase shadow-lg shadow-blue-500/30">Ticket</button>
              </div>
            </div>
          </section>
        </main>
      )}

      {/* VISTA: PROVEEDORES */}
      {vista === 'proveedores' && (
        <main className="flex-1 p-4 md:p-8 overflow-y-auto animate-in slide-in-from-bottom-10">
          <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-[3rem] shadow-xl border-t-8 border-orange-500">
                <h2 className="font-black text-xl mb-6 italic uppercase text-slate-800">Registrar Pago</h2>
                <div className="space-y-4">
                    <select className="w-full bg-slate-50 p-5 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-orange-500" value={nuevaCompra.proveedor_id} onChange={e => setNuevaCompra({...nuevaCompra, proveedor_id: e.target.value})}>
                        <option value="">Seleccionar Proveedor</option>
                        {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                    <input type="number" placeholder="Monto ($)" className="w-full bg-slate-50 p-5 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-orange-500" value={nuevaCompra.monto_total} onChange={e => setNuevaCompra({...nuevaCompra, monto_total: e.target.value})}/>
                    <textarea placeholder="Detalles..." className="w-full bg-slate-50 p-5 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-orange-500 h-24" value={nuevaCompra.detalles} onChange={e => setNuevaCompra({...nuevaCompra, detalles: e.target.value})}></textarea>
                    <button onClick={async () => {
                        if(!nuevaCompra.proveedor_id || !nuevaCompra.monto_total) return showMsg("Llena los campos, viejo.", "error");
                        const { error } = await supabase.from('compras_proveedores').insert([nuevaCompra]);
                        if(error) return showMsg("Error al guardar", "error");
                        showMsg("¡GASTO REGISTRADO CON ÉXITO! 💰");
                        setNuevaCompra({proveedor_id:'', monto_total:'', detalles:''});
                        fetchData();
                    }} className="w-full bg-orange-600 text-white font-black py-5 rounded-2xl shadow-xl uppercase text-[10px]">Guardar Gasto</button>
                </div>
            </div>

            <div className="space-y-6">
                <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-slate-100">
                    <h2 className="font-black text-xl mb-6 italic uppercase text-slate-800">Nuevo Proveedor</h2>
                    <div className="space-y-4">
                        <input type="text" placeholder="Nombre" className="w-full bg-slate-50 p-4 rounded-xl font-bold outline-none" value={nuevoProv.nombre} onChange={e => setNuevoProv({...nuevoProv, nombre: e.target.value})}/>
                        <input type="text" placeholder="Contacto" className="w-full bg-slate-50 p-4 rounded-xl font-bold outline-none" value={nuevoProv.contacto} onChange={e => setNuevoProv({...nuevoProv, contacto: e.target.value})}/>
                        <button onClick={async () => {
                            if(!nuevoProv.nombre) return showMsg("Falta el nombre.", "error");
                            await supabase.from('proveedores').insert([nuevoProv]);
                            showMsg("¡PROVEEDOR AGREGADO! 🤝");
                            setNuevoProv({nombre:'', contacto:'', categoria:''});
                            fetchData();
                        }} className="w-full bg-slate-900 text-white font-black py-4 rounded-xl uppercase text-[9px]">Registrar</button>
                    </div>
                </div>

                <div className="bg-white rounded-[2.5rem] shadow-sm border overflow-hidden">
                    <div className="p-4 bg-orange-50 border-b text-[10px] font-black text-orange-600 uppercase tracking-widest">Últimos Pagos</div>
                    <div className="max-h-64 overflow-y-auto">
                        {compras.map(c => (
                            <div key={c.id} className="p-4 border-b border-slate-50 flex justify-between items-center">
                                <div>
                                    <span className="font-black text-[10px] text-slate-800 uppercase block">{c.proveedores?.nombre}</span>
                                    <span className="text-[8px] text-slate-400 font-bold">{new Date(c.fecha).toLocaleDateString()}</span>
                                </div>
                                <span className="text-orange-600 font-black text-sm">-${parseFloat(c.monto_total).toFixed(2)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
          </div>
        </main>
      )}

      {/* VISTA: INVENTARIO */}
      {vista === 'inventario' && (
        <main className="flex-1 p-4 md:p-8 overflow-y-auto animate-in fade-in text-black">
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-white p-8 md:p-12 rounded-[3rem] shadow-xl border border-slate-100">
              <h2 className="font-black text-2xl mb-8 italic uppercase text-slate-800 tracking-tighter text-center">Catálogo de Productos</h2>
              <div className="space-y-4">
                <input type="text" placeholder="Nombre" className="w-full bg-slate-50 p-5 rounded-2xl font-bold border-2 border-transparent focus:border-blue-500 outline-none" value={nuevoProd.nombre} onChange={e => setNuevoProd({...nuevoProd, nombre: e.target.value})}/>
                <input type="text" placeholder="Código de Barras" className="w-full bg-slate-50 p-5 rounded-2xl font-bold border-2 border-transparent focus:border-blue-500 outline-none" value={nuevoProd.barcode} onChange={e => setNuevoProd({...nuevoProd, barcode: e.target.value})}/>
                <div className="grid grid-cols-2 gap-4">
                    <input type="number" placeholder="Precio ($)" className="w-full bg-slate-50 p-5 rounded-2xl font-bold border-2 border-transparent focus:border-blue-500 outline-none" value={nuevoProd.precio} onChange={e => setNuevoProd({...nuevoProd, precio: e.target.value})}/>
                    <input type="number" placeholder="Stock Inicial" className="w-full bg-slate-50 p-5 rounded-2xl font-bold border-2 border-transparent focus:border-blue-500 outline-none" value={nuevoProd.stock} onChange={e => setNuevoProd({...nuevoProd, stock: e.target.value})}/>
                </div>
                <button onClick={async () => {
                    const finalStock = parseInt(nuevoProd.stock) || 0;
                    const { error } = await supabase.from('productos').insert([{...nuevoProd, stock: finalStock}]).select();
                    if (error) return showMsg("Error al guardar", "error");
                    showMsg("¡PRODUCTO AGREGADO AL STOCK! 📦");
                    setNuevoProd({nombre:'', precio:'', stock: '', barcode: ''});
                    fetchData();
                }} className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl shadow-xl uppercase text-[10px]">Añadir al Catálogo</button>
              </div>
            </div>
            <div className="bg-white rounded-[2.5rem] shadow-sm border overflow-hidden">
                <div className="p-4 bg-slate-50 border-b text-[10px] font-black text-slate-400 uppercase tracking-widest">Existencias Actuales</div>
                {catalogo.map(p => (
                    <div key={p.id} className="p-6 border-b border-slate-50 flex justify-between items-center gap-4">
                        <div className="flex-1">
                            <span className="font-black text-[10px] text-slate-800 uppercase block">{p.nombre}</span>
                            <span className={`text-[9px] font-bold uppercase ${p.stock < 5 ? 'text-red-500' : 'text-slate-400'}`}>Cant: {p.stock}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <input type="number" className="w-20 bg-slate-50 p-2 rounded-lg font-black text-center text-xs border" defaultValue={p.stock} onBlur={(e) => {
                                const val = parseInt(e.target.value) || 0;
                                supabase.from('productos').update({ stock: val }).eq('id', p.id).then(()=>{
                                    fetchData();
                                    showMsg("STOCK ACTUALIZADO 🔄");
                                });
                            }}/>
                            <button onClick={async () => { 
                                if(confirm("¿Eliminar?")) { 
                                    await supabase.from('productos').delete().eq('id', p.id); 
                                    fetchData(); 
                                    showMsg("PRODUCTO ELIMINADO", "error");
                                } 
                            }} className="text-red-500 font-black text-[9px] uppercase border px-3 py-2 rounded-lg">Borrar</button>
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

    </div>
  );
}
