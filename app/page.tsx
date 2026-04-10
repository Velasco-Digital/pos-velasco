// @ts-nocheck
"use client";
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabase';

export default function VelascoPOS_Ultimate() {
  const [session, setSession] = useState(null);
  const [rol, setRol] = useState('cajero');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [vista, setVista] = useState('pos');
  const [carrito, setCarrito] = useState([]);
  const [catalogo, setCatalogo] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [montado, setMontado] = useState(false);
  const [metodoPago, setMetodoPago] = useState('efectivo');
  const [ticketImpresion, setTicketImpresion] = useState({ items: [], total: 0, fecha: '', vendedor: '', metodo: '' });
  const [nuevoProd, setNuevoProd] = useState({ nombre: '', precio: '', stock: '', barcode: '' }); // Stock como string vacío
  const [inputBarras, setInputBarras] = useState('');

  useEffect(() => {
    setMontado(true);
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if(session) {
        if(session.user.email === 'admin@velasco.com') setRol('admin'); 
        fetchData();
      }
    });
  }, []);

  const fetchData = async () => {
    const { data: catData } = await supabase.from('productos').select('*').order('id', { ascending: true });
    if (catData) setCatalogo(catData);
    const { data: histData } = await supabase.from('ventas').select('*').order('id', { ascending: false }).limit(100);
    if (histData) setHistorial(histData);
  };

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert("Credenciales incorrectas, viejo.");
    else window.location.reload();
  };

  const agregarAlCarrito = (p) => {
    if(p.stock <= 0) return alert("¡Sin existencias!");
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
    
    if (error) return alert("Error de red: revisa la columna metodo_pago");
    for (const item of carrito) {
        await supabase.rpc('decrement_stock', { row_id: item.id, amount: item.cant });
    }
    if (imprimir) {
        setTicketImpresion({ items: [...carrito], total: totalVenta, fecha: new Date().toLocaleString(), vendedor: session.user.email, metodo: metodoPago });
        setTimeout(() => { window.print(); setCarrito([]); fetchData(); }, 500);
    } else {
        alert("VENTA EXITOSA");
        setCarrito([]);
        fetchData();
    }
  };

  // --- LÓGICA DE NEGOCIOS (DASHBOARD) ---
  const ventasHoy = historial.filter(v => new Date(v.fecha).toDateString() === new Date().toDateString());
  const totalHoy = ventasHoy.reduce((acc, v) => acc + parseFloat(v.total), 0);
  const totalEfectivo = ventasHoy.filter(v => v.metodo_pago === 'efectivo').reduce((acc, v) => acc + parseFloat(v.total), 0);
  const totalTarjeta = ventasHoy.filter(v => v.metodo_pago === 'tarjeta').reduce((acc, v) => acc + parseFloat(v.total), 0);
  const productosBajos = catalogo.filter(p => p.stock < 5);

  const conteoProd = {};
  historial.forEach(v => {
    v.items?.forEach(item => {
        conteoProd[item.nombre] = (conteoProd[item.nombre] || 0) + item.cant;
    });
  });
  const top5 = Object.entries(conteoProd).sort((a,b) => b[1] - a[1]).slice(0, 5);

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
      `}</style>

      {/* TICKET */}
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
            {rol === 'admin' && (
                <button onClick={() => setVista('dashboard')} className={`flex-1 sm:px-4 py-2 rounded-xl text-[9px] font-black ${vista === 'dashboard' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>DASHBOARD</button>
            )}
            <button onClick={() => setVista('pos')} className={`flex-1 sm:px-4 py-2 rounded-xl text-[9px] font-black ${vista === 'pos' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>CAJA</button>
            {rol === 'admin' && (
                <>
                <button onClick={() => setVista('inventario')} className={`flex-1 sm:px-4 py-2 rounded-xl text-[9px] font-black ${vista === 'inventario' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>STOCK</button>
                <button onClick={() => setVista('corte')} className={`flex-1 sm:px-4 py-2 rounded-xl text-[9px] font-black ${vista === 'corte' ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}>CORTE</button>
                </>
            )}
        </div>
        <button onClick={() => supabase.auth.signOut().then(()=>window.location.reload())} className="text-red-500 font-bold text-[9px] uppercase">Salir</button>
      </nav>

      {/* DASHBOARD */}
      {vista === 'dashboard' && rol === 'admin' && (
        <main className="flex-1 p-4 md:p-8 overflow-y-auto animate-in fade-in">
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button onClick={() => setVista('corte')} className="bg-white p-6 rounded-[2rem] shadow-sm border border-blue-100 text-left hover:scale-95 transition-all">
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Ventas Hoy (Efe/Tar)</p>
                    <h2 className="text-2xl font-black text-blue-600">${totalHoy.toFixed(2)}</h2>
                    <p className="text-[8px] font-bold text-slate-400 mt-2">${totalEfectivo.toFixed(0)} E / ${totalTarjeta.toFixed(0)} T</p>
                </button>
                <button onClick={() => setVista('inventario')} className="bg-white p-6 rounded-[2rem] shadow-sm border border-red-100 text-left hover:scale-95 transition-all">
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Alertas Stock</p>
                    <h2 className="text-2xl font-black text-red-600">{productosBajos.length} Productos</h2>
                    <p className="text-[8px] font-bold text-slate-400 mt-2">Pica aquí para reabastecer</p>
                </button>
                <button onClick={() => setVista('corte')} className="bg-white p-6 rounded-[2rem] shadow-sm border border-emerald-100 text-left hover:scale-95 transition-all">
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Transacciones</p>
                    <h2 className="text-2xl font-black text-emerald-600">{ventasHoy.length} ventas</h2>
                    <p className="text-[8px] font-bold text-slate-400 mt-2">Ver historial completo</p>
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-8 rounded-[3rem] shadow-sm border">
                    <h3 className="text-xs font-black uppercase mb-6 italic text-slate-800">Flujo de Dinero</h3>
                    <div className="flex items-end justify-between h-48 gap-2">
                        {historial.slice(0, 7).reverse().map((v, i) => (
                            <div key={i} className="flex-1 flex flex-col items-center gap-2">
                                <div className="bg-blue-500 w-full rounded-t-lg" style={{ height: `${(v.total / 1000) * 100}%`, minHeight: '10%' }}></div>
                                <span className="text-[8px] font-bold text-slate-400">${v.total.toFixed(0)}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="bg-white p-8 rounded-[3rem] shadow-sm border">
                    <h3 className="text-xs font-black uppercase mb-6 italic text-slate-800">Top 5 Más Vendidos</h3>
                    <div className="space-y-4">
                        {top5.map(([nombre, cant], i) => (
                            <div key={i} className="flex justify-between items-center border-b pb-2">
                                <span className="text-[10px] font-black text-slate-600 uppercase">{nombre}</span>
                                <span className="bg-blue-100 text-blue-600 px-3 py-1 rounded-full text-[9px] font-black">{cant} un.</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
          </div>
        </main>
      )}

      {/* CAJA */}
      {vista === 'pos' && (
        <main className="flex-1 flex flex-col md:flex-row overflow-hidden animate-in fade-in">
          <section className="flex-1 p-4 overflow-y-auto">
            <form onSubmit={(e) => { e.preventDefault(); const p = catalogo.find(x => x.barcode === inputBarras); if(p) agregarAlCarrito(p); setInputBarras(''); }} className="mb-4">
                <input type="text" placeholder="Escanear Producto..." className="w-full bg-white p-4 rounded-2xl shadow-sm border border-blue-100 font-bold text-xs outline-none" value={inputBarras} onChange={(e) => setInputBarras(e.target.value)} autoFocus />
            </form>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-3 content-start">
                {catalogo.map(p => (
                <button key={p.id} onClick={() => agregarAlCarrito(p)} className={`bg-white p-5 rounded-[2rem] shadow-sm border text-left flex flex-col justify-between h-36 ${p.stock < 5 ? 'border-red-200 bg-red-50/20' : 'border-slate-100'}`}>
                    <div>
                        <h3 className="font-black text-slate-800 uppercase text-[10px] leading-tight mb-2 h-8 overflow-hidden">{p.nombre}</h3>
                        <p className="text-blue-600 font-black text-lg tracking-tighter">${parseFloat(p.precio).toFixed(2)}</p>
                    </div>
                    <span className={`text-[8px] font-black px-2 py-1 rounded-lg w-fit ${p.stock < 5 ? 'bg-red-600 text-white' : 'bg-green-100 text-green-600'}`}>STK: {p.stock}</span>
                </button>
                ))}
            </div>
          </section>

          <section className="w-full md:w-80 lg:w-96 bg-white border-l shadow-2xl flex flex-col h-[45vh] md:h-full">
            <div className="p-5 bg-slate-50 border-b flex justify-between font-black text-[10px] text-slate-400 uppercase tracking-widest">Carrito de Venta</div>
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

      {/* STOCK / INVENTARIO */}
      {vista === 'inventario' && rol === 'admin' && (
        <main className="flex-1 p-4 md:p-8 overflow-y-auto animate-in fade-in text-black">
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-white p-8 md:p-12 rounded-[3rem] shadow-xl border border-slate-100">
              <h2 className="font-black text-2xl mb-8 italic uppercase text-slate-800 tracking-tighter text-center">Alta de Productos</h2>
              <div className="space-y-4">
                <input type="text" placeholder="Nombre" className="w-full bg-slate-50 p-5 rounded-2xl font-bold border-2 border-transparent focus:border-blue-500 outline-none" value={nuevoProd.nombre} onChange={e => setNuevoProd({...nuevoProd, nombre: e.target.value})}/>
                <input type="text" placeholder="Código de Barras" className="w-full bg-slate-50 p-5 rounded-2xl font-bold border-2 border-transparent focus:border-blue-500 outline-none" value={nuevoProd.barcode} onChange={e => setNuevoProd({...nuevoProd, barcode: e.target.value})}/>
                <div className="grid grid-cols-2 gap-4">
                    <input type="number" placeholder="Precio ($)" className="w-full bg-slate-50 p-5 rounded-2xl font-bold border-2 border-transparent focus:border-blue-500 outline-none" value={nuevoProd.precio} onChange={e => setNuevoProd({...nuevoProd, precio: e.target.value})}/>
                    <input type="number" placeholder="Stock" className="w-full bg-slate-50 p-5 rounded-2xl font-bold border-2 border-transparent focus:border-blue-500 outline-none" value={nuevoProd.stock} onChange={e => setNuevoProd({...nuevoProd, stock: e.target.value})}/>
                </div>
                <button onClick={async () => {
                    const finalStock = parseInt(nuevoProd.stock) || 0;
                    const { data, error } = await supabase.from('productos').insert([{...nuevoProd, stock: finalStock}]).select();
                    if (error) return alert("Error al guardar: " + error.message);
                    alert("PRODUCTO GUARDADO");
                    setNuevoProd({nombre:'', precio:'', stock: '', barcode: ''}); // Reinicia stock a vacío
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
                            <input type="number" placeholder="Stock" className="w-20 bg-slate-50 p-2 rounded-lg font-black text-center text-xs border" defaultValue={p.stock} onBlur={(e) => {
                                const val = parseInt(e.target.value) || 0;
                                supabase.from('productos').update({ stock: val }).eq('id', p.id).then(()=>fetchData());
                            }}/>
                            <button onClick={async () => { if(confirm("¿Eliminar?")) { await supabase.from('productos').delete().eq('id', p.id); fetchData(); } }} className="text-red-500 font-black text-[9px] uppercase border px-3 py-2 rounded-lg">Borrar</button>
                        </div>
                    </div>
                ))}
            </div>
          </div>
        </main>
      )}

      {/* CORTE */}
      {vista === 'corte' && rol === 'admin' && (
        <main className="flex-1 p-4 md:p-8 overflow-y-auto animate-in fade-in">
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-slate-900 p-10 rounded-[3rem] text-white shadow-2xl border-b-8 border-emerald-500">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <p className="text-[10px] font-black uppercase opacity-70 tracking-widest">Corte del Día</p>
                        <h2 className="text-5xl font-black tracking-tighter tabular-nums">${totalHoy.toFixed(2)}</h2>
                    </div>
                    <div className="text-right">
                        <p className="text-[9px] font-black text-blue-400">EFECTIVO: ${totalEfectivo.toFixed(2)}</p>
                        <p className="text-[9px] font-black text-indigo-400">TARJETA: ${totalTarjeta.toFixed(2)}</p>
                    </div>
                </div>
            </div>
            <div className="space-y-4">
                {historial.map(v => (
                    <div key={v.id} className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col gap-3">
                        <div className="flex justify-between items-center text-[9px] font-black uppercase">
                            <span className="text-slate-400">{new Date(v.fecha).toLocaleString()}</span>
                            <span className={`px-3 py-1 rounded-full ${v.metodo_pago === 'tarjeta' ? 'bg-indigo-100 text-indigo-600' : 'bg-blue-100 text-blue-600'}`}>{v.metodo_pago}</span>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                            <p className="text-[8px] font-black text-slate-400 uppercase mb-2 tracking-widest">Productos:</p>
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
