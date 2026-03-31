import { useNavigate } from "react-router-dom";
import { clearAuth } from "../utils/auth";

export default function ModuleDisabledView({ accentColor, moduleLabel }) {
  const navigate = useNavigate();

  const handleSignOut = () => {
    clearAuth();
    navigate("/login");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%)",
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "520px",
          background: "#ffffff",
          borderRadius: "20px",
          boxShadow: "0 20px 50px rgba(15, 23, 42, 0.12)",
          padding: "40px 32px",
          borderTop: `6px solid ${accentColor}`,
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: "64px",
            height: "64px",
            borderRadius: "16px",
            background: accentColor,
            color: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "28px",
            fontWeight: 700,
            margin: "0 auto 20px",
          }}
        >
          !
        </div>
        <h1 style={{ margin: "0 0 12px", color: "#1a202c", fontSize: "1.9rem" }}>
          Module {moduleLabel}
        </h1>
        <p style={{ margin: "0 0 28px", color: "#4a5568", lineHeight: 1.6 }}>
          Please contact admin to reactivate this module.
        </p>
        <button
          type="button"
          onClick={handleSignOut}
          style={{
            background: accentColor,
            color: "#ffffff",
            border: "none",
            borderRadius: "12px",
            padding: "14px 24px",
            fontSize: "1rem",
            fontWeight: 600,
            cursor: "pointer",
            minWidth: "160px",
          }}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
