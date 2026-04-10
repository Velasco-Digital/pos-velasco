// @ts-nocheck"use client";

import React, { useState, useEffect } from 'react';

export default function VelascoPOS_Final_Fixed() {
  const [vista, setVista] = useState('pos');
  const [carrito, setCarrito] = useState([]);
  const [catalogo, setCatalogo] = useState([]);
  const [historial, setHistorial] = useState([]); 
  
  // Parche para evitar errores de hidratación (la hora roja)
  const [montado, setMontado] = useState(false);
  
  const [ticketImpresion, setTicketImpresion] = useState({ items: [], total: 0, fecha: '' });
  const [nuevoProd, setNuevoProd] = useState({ nombre: '', precio: '', icono: '📦' });

  // 1. Efecto para montar el componente y cargar datos
  useEffect(() => {
    setMontado(true); // El sistema ya está listo en el cliente
    const carSaved = localStorage.getItem('vd_carrito');
    const catSaved = localStorage.getItem('vd_catalogo');
    const histSaved = localStorage.getItem('vd_historial');
    if (carSaved) setCarrito(JSON.parse(carSaved));
    if (histSaved) setHistorial(JSON.parse(histSaved));
    if (catSaved) setCatalogo(JSON.parse(catSaved));
    else {
      const inicial = [
        { id: 1, nombre: "Birote Salado", precio: 12.00, icono: "🥖" },
        { id: 2, nombre: "Refresco 3L", precio: 38.00, icono: "🥤" },
        { id: 3, nombre: "Café", precio: 100.00, icono: "☕" }
      ];
      setCatalogo(inicial);
      localStorage.setItem('vd_catalogo', JSON.stringify(inicial));
    }
  }, []);

  useEffect(() => {
    if (montado) {
      localStorage.setItem('vd_carrito', JSON.stringify(carrito));
      localStorage.setItem('vd_catalogo', JSON.stringify(catalogo));
      localStorage.setItem('vd_historial', JSON.stringify(historial));
    }
  }, [carrito, catalogo, historial, montado]);

  // Si no está montado, mostramos una pantalla de carga para evitar el error rojo
  if (!montado) return <div className="bg-slate-900 h-screen flex items-center justify-center text-blue-500 font-black">VELASCO DIGITAL...</div>;

  const agregarAlCarrito = (p) => {
    const ex = carrito.find(i => i.id === p.id);
    if (ex) setCarrito(carrito.map(i => i.id === p.id ? {...i, cant: i.cant + 1} : i));
    else setCarrito([...carrito, {...p, cant: 1}]);
  };

  const finalizarVenta = (imprimir = false) => {
    if (carrito.length === 0) return;
    
    const subtotal = carrito.reduce((a,b)=>a+(b.precio*b.cant), 0);
    const totalVenta = subtotal * 1.16;
    const fechaActual = new Date().toLocaleString();
    
    const venta = { 
        id: Date.now(), 
        fecha: fechaActual, 
        items: [...carrito], 
        total: totalVenta 
    };

    setHistorial([venta, ...historial]);
    
    if (imprimir) {
        setTicketImpresion({ items: [...carrito], total: totalVenta, fecha: fechaActual });
        setTimeout(() => { 
            window.print(); 
            setCarrito([]); 
        }, 500);
    } else {
        setCarrito([]);
        alert("✅ Venta Guardada");
    }
  };

  const ingresosDelDia = historial.reduce((acc, v) => acc + v.total, 0);

  return (
    <div className="bg-slate-100 h-screen flex flex-col font-sans overflow-hidden">
      
      <style>{`
        @media screen {
            #printable-ticket { position: fixed; left: -9999px; top: 0; }
        }
        @media print {
            body * { visibility: hidden !important; }
            #printable-ticket, #printable-ticket * { visibility: visible !important; }
            #printable-ticket { 
                position: absolute; 
                left: 0; top: 0; 
                width: 100%; 
                display: block !important;
                color: black !important;
            }
        }
      `}</style>

      <div id="printable-ticket" className="bg-white p-4">
        <div style={{ fontFamily: 'monospace', width: '80mm', fontSize: '12px', color: 'black' }}>
          <center>
            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>VELASCO DIGITAL</h2>
            <p style={{ margin: '2px 0' }}>COMPROBANTE DE PAGO</p>
            <p>===============================</p>
          </center>
          <p style={{ fontSize: '10px' }}>Fecha: {ticketImpresion.fecha}</p>
          <p>-------------------------------</p>
          {ticketImpresion.items.map((item, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
              <span style={{ flex: 1 }}>{item.cant}x {item.nombre}</span>
              <span>${(item.precio * item.cant).toFixed(2)}</span>
            </div>
          ))}
          <p>-------------------------------</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '14px' }}>
            <span>TOTAL:</span>
            <span>${ticketImpresion.total.toFixed(2)}</span>
          </div>
          <center>
            <p style={{ marginTop: '20px', fontSize: '10px' }}>¡GRACIAS POR SU COMPRA!</p>
            <p style={{ fontSize: '8px' }}>Software by Velasco Digital Co.</p>
          </center>
        </div>
      </div>

      <nav className="bg-slate-900 p-3 flex justify-between items-center shadow-xl border-b-2 border-blue-600 no-print">
        <div className="flex items-center gap-4 px-2">
          <h1 className="text-blue-500 font-black italic text-xl">VD <span className="text-white font-light uppercase">Pos</span></h1>
          <div className="flex gap-1 bg-slate-800 p-1 rounded-xl">
            <button onClick={() => setVista('pos')} className={`px-4 py-2 rounded-lg text-[10px] font-black ${vista === 'pos' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>CAJA</button>
            <button onClick={() => setVista('inventario')} className={`px-4 py-2 rounded-lg text-[10px] font-black ${vista === 'inventario' ? 'bg-indigo-600 text-white' : 'text-gray-400'}`}>STOCK</button>
            <button onClick={() => setVista('corte')} className={`px-4 py-2 rounded-lg text-[10px] font-black ${vista === 'corte' ? 'bg-emerald-600 text-white' : 'text-gray-400'}`}>CORTE</button>
          </div>
        </div>
      </nav>

      {vista === 'pos' && (
        <main className="flex-1 flex overflow-hidden animate-in fade-in">
          <section className="flex-[3] p-4 overflow-y-auto grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 content-start">
            {catalogo.map(p => (
              <button key={p.id} onClick={() => agregarAlCarrito(p)} className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 hover:border-blue-500 active:scale-95 transition-all flex flex-col items-center">
                <div className="text-2xl mb-1">{p.icono}</div>
                <h3 className="font-bold text-slate-800 uppercase text-[10px] text-center h-8 overflow-hidden">{p.nombre}</h3>
                <p className="text-blue-600 font-black text-xs">${p.precio.toFixed(2)}</p>
              </button>
            ))}
          </section>

          <section className="flex-1 min-w-[300px] bg-white border-l shadow-2xl flex flex-col">
            <div className="p-4 bg-slate-50 border-b flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <span>Venta en curso</span>
                <button onClick={() => setCarrito([])} className="text-red-500">Vaciar</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {carrito.map(i => (
                <div key={i.id} className="flex justify-between items-center text-xs border-b border-dashed pb-2">
                  <div className="flex-1">
                    <p className="font-bold text-slate-800 uppercase leading-tight">{i.nombre}</p>
                    <p className="text-[10px] text-blue-500 font-bold">{i.cant} x ${i.precio.toFixed(2)}</p>
                  </div>
                  <span className="font-black text-slate-900 text-sm tabular-nums">${(i.precio * i.cant).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="p-6 bg-slate-900 text-white rounded-t-[2.5rem]">
              <div className="flex justify-between items-center mb-6">
                <span className="text-blue-400 font-black italic text-xl uppercase">Total:</span>
                <span className="text-3xl font-black font-mono text-green-400">${(carrito.reduce((a,b)=>a+(b.precio*b.cant),0)*1.16).toFixed(2)}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => finalizarVenta(false)} className="bg-slate-700 py-4 rounded-2xl font-black text-[10px] uppercase">Registrar</button>
                <button onClick={() => finalizarVenta(true)} className="bg-blue-600 py-4 rounded-2xl font-black text-[10px] uppercase shadow-lg">Ticket 🖨️</button>
              </div>
            </div>
          </section>
        </main>
      )}

      {vista === 'inventario' && (
        <main className="flex-1 p-6 overflow-y-auto">
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border-2 border-indigo-50">
              <h2 className="font-black text-slate-800 mb-6 uppercase italic text-xl">Gestión de Stock</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 ml-2 uppercase">Nombre</label>
                  <input 
                      type="text" 
                      placeholder="Ej: Café de Grano" 
                      className="w-full bg-slate-50 p-4 rounded-xl outline-none border-2 border-transparent focus:border-indigo-500 text-black font-bold" 
                      value={nuevoProd.nombre} 
                      onChange={e => setNuevoProd({...nuevoProd, nombre: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 ml-2 uppercase">Precio</label>
                  <input 
                      type="number" 
                      placeholder="0.00" 
                      className="w-full bg-slate-50 p-4 rounded-xl outline-none border-2 border-transparent focus:border-indigo-500 text-black font-bold" 
                      value={nuevoProd.precio} 
                      onChange={e => setNuevoProd({...nuevoProd, precio: e.target.value})}
                  />
                </div>
                <button onClick={() => {
                    if(!nuevoProd.nombre || !nuevoProd.precio) return;
                    setCatalogo([...catalogo, {...nuevoProd, id: Date.now(), precio: parseFloat(nuevoProd.precio)}]);
                    setNuevoProd({nombre:'', precio:'', icono:'📦'});
                }} className="md:col-span-2 bg-slate-900 text-white font-black py-5 rounded-2xl uppercase text-xs shadow-lg tracking-widest hover:bg-indigo-600 transition-all">Guardar Producto</button>
              </div>
            </div>
            
            <div className="bg-white rounded-[2.5rem] shadow-xl border overflow-hidden">
                {catalogo.map(p => (
                    <div key={p.id} className="p-4 border-b flex justify-between items-center hover:bg-indigo-50/30">
                        <span className="font-bold text-slate-700 text-xs uppercase">{p.icono} {p.nombre}</span>
                        <div className="flex items-center gap-6">
                            <span className="font-black text-indigo-600 text-sm tabular-nums">${p.precio.toFixed(2)}</span>
                            <button onClick={() => setCatalogo(catalogo.filter(x => x.id !== p.id))} className="text-red-400 text-[10px] font-black uppercase hover:text-red-600">Eliminar</button>
                        </div>
                    </div>
                ))}
            </div>
          </div>
        </main>
      )}

      {vista === 'corte' && (
        <main className="flex-1 p-6 overflow-y-auto animate-in fade-in">
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-gradient-to-br from-emerald-500 to-teal-700 p-10 rounded-[3rem] text-white shadow-2xl flex justify-between items-center relative overflow-hidden">
                <div className="z-10">
                    <p className="text-[10px] font-black uppercase opacity-70 tracking-[0.2em] mb-2">Total en Caja</p>
                    <h2 className="text-5xl font-black tracking-tighter">${ingresosDelDia.toFixed(2)}</h2>
                </div>
                <button onClick={() => {if(confirm("¿Cerrar día?")) setHistorial([])}} className="z-10 bg-white/20 px-5 py-3 rounded-2xl text-[10px] font-black uppercase border border-white/30">Reiniciar</button>
                <div className="absolute -right-8 -bottom-8 text-9xl opacity-10">💰</div>
            </div>

            <h3 className="font-black text-slate-800 uppercase italic text-xl tracking-tighter">Historial de tickets</h3>
            <div className="grid gap-4">
              {historial.length === 0 ? (
                <div className="text-center text-gray-400 py-20 italic bg-white rounded-[3rem] shadow-inner border border-gray-100">Sin ventas hoy.</div>
              ) : (
                historial.map(v => (
                  <div key={v.id} className="bg-white p-6 rounded-[2rem] shadow-sm border-l-8 border-emerald-500">
                    <div className="flex justify-between items-start mb-3">
                        <span className="text-[10px] text-gray-400 font-mono font-bold uppercase">{v.fecha}</span>
                        <span className="font-black text-slate-900 text-xl tabular-nums">${v.total.toFixed(2)}</span>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <p className="text-[9px] font-black text-slate-400 uppercase mb-2 tracking-widest">Detalle:</p>
                        <p className="text-[11px] text-slate-600 font-bold leading-relaxed uppercase italic">
                            {v.items.map(item => `${item.cant}x ${item.nombre}`).join(' • ')}
                        </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </main>
      )}

    </div>
  );
}
