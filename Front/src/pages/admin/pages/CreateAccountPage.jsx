// src/pages/admin/pages/CreateAccountPage.jsx
import { useNavigate } from "react-router-dom"
import CreateAccount from "../../../components/forms/CreateAccount"
import userService from "../../../services/userService"
import { extractApiErrorMessage } from "../../../utils/frontendApiAdapters"

function CreateAccountPage() {
  const navigate = useNavigate()

  const handleBackToAccueil = () => {
    navigate("/admin/accueil")
  }

  const handleAccountCreated = async (newUser) => {
    try {
      await userService.createUser(newUser)
      handleBackToAccueil()
    } catch (error) {
      throw new Error(extractApiErrorMessage(error, "Impossible de cr\u00E9er le compte"))
    }
  }

  return (
    <div style={{
      background: "white",
      borderRadius: "16px",
      padding: "32px",
      boxShadow: "0 4px 12px rgba(0,0,0,0.05)"
    }}>
      <h1 style={{
        fontSize: "1.8rem",
        color: "#1a202c",
        margin: "0 0 32px 0",
        textAlign: "center"
      }}>
        {"Cr\u00E9ation de compte"}
      </h1>
      <CreateAccount
        onClose={handleBackToAccueil}
        onAccountCreated={handleAccountCreated}
        standalone={true}
        onCancel={handleBackToAccueil}
      />
    </div>
  )
}

export default CreateAccountPage
