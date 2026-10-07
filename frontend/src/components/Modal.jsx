import { useEffect, useRef } from 'react';

export default function Modal({ title, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog ref={ref} className="modal" onCancel={onClose} onClick={(e) => e.target === ref.current && onClose()}>
      <div className="modal-body">
        <header className="row-between">
          <h2 className="h3">{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
