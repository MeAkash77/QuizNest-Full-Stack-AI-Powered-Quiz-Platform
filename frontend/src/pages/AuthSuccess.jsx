import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

const AuthSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = searchParams.get("token");
    console.log("🔐 AuthSuccess: Token received:", token ? "✅ Yes" : "❌ No");
    
    if (!token) {
      setError("No authentication token received");
      setLoading(false);
      setTimeout(() => navigate("/login?error=no_token"), 3000);
      return;
    }

    // Save token
    localStorage.setItem("token", token);
    console.log("💾 Token saved to localStorage");

    // Fetch user data
    const apiUrl = import.meta.env.VITE_API_URL || "https://quiznest-full-stack-ai-powered-quiz.onrender.com";
    
    fetch(`${apiUrl}/api/users/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        return res.json();
      })
      .then((user) => {
        console.log("👤 User logged in:", user.email);
        localStorage.setItem("user", JSON.stringify(user));
        setLoading(false);
        
        // Redirect based on role
        setTimeout(() => {
          if (user.role === "admin") {
            navigate("/admin");
          } else {
            navigate("/");
          }
        }, 1000);
      })
      .catch((err) => {
        console.error("❌ Error fetching user:", err);
        setError(err.message);
        setLoading(false);
        setTimeout(() => navigate("/login?error=auth_failed"), 3000);
      });
  }, [searchParams, navigate]);

  if (error) {
    return (
      <div style={{ 
        display: "flex", 
        justifyContent: "center", 
        alignItems: "center", 
        height: "100vh",
        flexDirection: "column",
        gap: "1rem",
        fontFamily: "sans-serif"
      }}>
        <div style={{ fontSize: "48px" }}>❌</div>
        <div style={{ fontSize: "20px", fontWeight: "bold" }}>Authentication Error</div>
        <div style={{ color: "#666" }}>{error}</div>
        <div style={{ fontSize: "14px", color: "#999" }}>Redirecting to login...</div>
      </div>
    );
  }

  return (
    <div style={{ 
      display: "flex", 
      justifyContent: "center", 
      alignItems: "center", 
      height: "100vh",
      flexDirection: "column",
      gap: "1rem",
      fontFamily: "sans-serif"
    }}>
      <div style={{ 
        width: "50px", 
        height: "50px", 
        border: "4px solid #f3f3f3",
        borderTop: "4px solid #3498db",
        borderRadius: "50%",
        animation: "spin 1s linear infinite"
      }} />
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
      <div style={{ fontSize: "18px" }}>🔄 Logging you in with Google...</div>
      <div style={{ fontSize: "14px", color: "#666" }}>Please wait while we redirect you</div>
    </div>
  );
};

export default AuthSuccess;
