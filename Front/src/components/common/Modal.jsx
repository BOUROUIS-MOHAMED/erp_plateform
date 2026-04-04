// src/components/common/Modal.jsx
function Modal({ isOpen, onClose, title, children, onConfirm, confirmText = "Confirmer", showConfirm = true }) {
  if (!isOpen) return null
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} role="dialog">
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">{children}</div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Annuler</button>
          {showConfirm && <button className="btn-primary" onClick={onConfirm}>{confirmText}</button>}
        </div>
      </div>
    </div>
  )
}
export default Modal
