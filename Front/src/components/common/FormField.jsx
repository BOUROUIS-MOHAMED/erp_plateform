// src/components/common/FormField.jsx
function FormField({ label, id, error, children }) {
  return (
    <div className="form-group">
      <label htmlFor={id}>{label}</label>
      {children}
      {error && <span className="error-message">{error}</span>}
    </div>
  )
}
export default FormField
