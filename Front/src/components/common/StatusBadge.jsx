// src/components/common/StatusBadge.jsx
function StatusBadge({ status }) {
  const s = {
    "en stock":  { bg: "#c6f6d5", color: "#48bb78" },
    "stock faible": { bg: "#feebc8", color: "#ed8936" },
    "rupture":   { bg: "#fed7d7", color: "#f56565" },
  }[status] || { bg: "#e2e8f0", color: "#a0aec0" }
  return <span className="status-badge" style={{ background: s.bg, color: s.color }}>{status}</span>
}
export default StatusBadge
