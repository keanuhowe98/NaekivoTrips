import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

export default function Modal({ title, children, onClose, wide = false }: {title: string; children: ReactNode; onClose: () => void; wide?: boolean}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    return () => { dialog?.close(); previous?.focus(); };
  }, []);
  return <dialog ref={ref} className={`modal ${wide ? 'modal-wide' : ''}`} onCancel={onClose} aria-labelledby="modal-title" onClick={e => { if (e.target === ref.current) onClose(); }}>
    <div className="modal-heading"><div><span className="eyebrow">NAEKIVO TRIPS</span><h2 id="modal-title">{title}</h2></div><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={22}/></button></div>
    {children}
  </dialog>;
}
