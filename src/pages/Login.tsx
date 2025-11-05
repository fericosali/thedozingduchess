import {
  Alert,
  Box,
  Button,
  Container,
  Fade,
  IconButton,
  InputAdornment,
  Paper,
  Slide,
  TextField,
  Typography,
} from "@mui/material";
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShirtIcon as Pajama,
  Sparkles,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const Login: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const { signIn, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (user) {
      const from = (location.state as any)?.from?.pathname || "/";
      navigate(from, { replace: true });
    }
  }, [user, navigate, location]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const { error } = await signIn(email, password);
      if (error) {
        setError(error.message);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)",
        position: "relative",
        overflow: "hidden",
        "&::before": {
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background:
            'url("data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%23ffffff" fill-opacity="0.05"%3E%3Ccircle cx="30" cy="30" r="4"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
          animation: "float 20s ease-in-out infinite",
        },
      }}
    >
      <Container 
        maxWidth="sm"
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          py: 4
        }}
      >
        <Fade in timeout={800}>
          <Paper
            elevation={24}
            sx={{
              p: { xs: 3, sm: 5 },
              borderRadius: 4,
              width: "100%",
              maxWidth: 450,
              margin: "0 auto",
              background: "rgba(255, 255, 255, 0.95)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              position: "relative",
              overflow: "hidden",
              "&::before": {
                content: '""',
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: "4px",
                background:
                  "linear-gradient(90deg, #e91e63, #9c27b0, #673ab7, #3f51b5)",
              },
            }}
          >
            <Slide direction="down" in timeout={1000}>
              <Box sx={{ textAlign: "center", mb: 4 }}>
                <Box
                  sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 80,
                    height: 80,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #e91e63, #9c27b0)",
                    mb: 3,
                    boxShadow: "0 10px 30px rgba(233, 30, 99, 0.3)",
                  }}
                >
                  <Pajama size={40} color="white" />
                </Box>
                <Typography
                  variant="h4"
                  component="h1"
                  sx={{
                    fontWeight: 700,
                    background: "linear-gradient(135deg, #e91e63, #9c27b0)",
                    backgroundClip: "text",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    mb: 1,
                    letterSpacing: "-0.5px",
                  }}
                >
                  The Dozing Duchess
                </Typography>
                <Typography
                  variant="body1"
                  color="text.secondary"
                  sx={{
                    fontWeight: 500,
                    opacity: 0.8,
                  }}
                >
                  Inventory Management
                </Typography>
              </Box>
            </Slide>

            <Slide direction="up" in timeout={1200}>
              <form onSubmit={handleSubmit}>
                <Box sx={{ mb: 3 }}>
                  <TextField
                    fullWidth
                    label="Email Address"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    variant="outlined"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Mail size={20} color="#666" />
                        </InputAdornment>
                      ),
                    }}
                    sx={{
                      "& .MuiOutlinedInput-root": {
                        borderRadius: 2,
                        transition: "all 0.3s ease",
                        "&:hover": {
                          boxShadow: "0 4px 12px rgba(233, 30, 99, 0.15)",
                        },
                        "&.Mui-focused": {
                          boxShadow: "0 4px 20px rgba(233, 30, 99, 0.25)",
                          "& fieldset": {
                            borderColor: "#e91e63",
                            borderWidth: "2px",
                          },
                        },
                      },
                      "& .MuiInputLabel-root.Mui-focused": {
                        color: "#e91e63",
                        fontWeight: 600,
                      },
                    }}
                  />
                </Box>

                <Box sx={{ mb: 4 }}>
                  <TextField
                    fullWidth
                    label="Password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    variant="outlined"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Lock size={20} color="#666" />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            aria-label="toggle password visibility"
                            onClick={handleTogglePasswordVisibility}
                            edge="end"
                            size="small"
                          >
                            {showPassword ? (
                              <EyeOff size={20} />
                            ) : (
                              <Eye size={20} />
                            )}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                    sx={{
                      "& .MuiOutlinedInput-root": {
                        borderRadius: 2,
                        transition: "all 0.3s ease",
                        "&:hover": {
                          boxShadow: "0 4px 12px rgba(233, 30, 99, 0.15)",
                        },
                        "&.Mui-focused": {
                          boxShadow: "0 4px 20px rgba(233, 30, 99, 0.25)",
                          "& fieldset": {
                            borderColor: "#e91e63",
                            borderWidth: "2px",
                          },
                        },
                      },
                      "& .MuiInputLabel-root.Mui-focused": {
                        color: "#e91e63",
                        fontWeight: 600,
                      },
                    }}
                  />
                </Box>

                {error && (
                  <Fade in>
                    <Alert
                      severity="error"
                      sx={{
                        mb: 3,
                        borderRadius: 2,
                        "& .MuiAlert-icon": {
                          fontSize: "1.2rem",
                        },
                      }}
                    >
                      {error}
                    </Alert>
                  </Fade>
                )}

                {successMessage && (
                  <Fade in>
                    <Alert
                      severity="success"
                      sx={{
                        mb: 3,
                        borderRadius: 2,
                        "& .MuiAlert-icon": {
                          fontSize: "1.2rem",
                        },
                      }}
                    >
                      {successMessage}
                    </Alert>
                  </Fade>
                )}

                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  disabled={loading}
                  sx={{
                    py: 1.8,
                    background: "linear-gradient(135deg, #e91e63, #9c27b0)",
                    borderRadius: 2,
                    textTransform: "none",
                    fontSize: "1.1rem",
                    fontWeight: 600,
                    letterSpacing: "0.5px",
                    boxShadow: "0 8px 25px rgba(233, 30, 99, 0.4)",
                    transition: "all 0.3s ease",
                    "&:hover": {
                      background: "linear-gradient(135deg, #d81b60, #8e24aa)",
                      transform: "translateY(-2px)",
                      boxShadow: "0 12px 35px rgba(233, 30, 99, 0.5)",
                    },
                    "&:active": {
                      transform: "translateY(0)",
                    },
                    "&:disabled": {
                      background: "linear-gradient(135deg, #e91e63, #9c27b0)",
                      opacity: 0.7,
                    },
                  }}
                >
                  {loading ? (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Box
                        sx={{
                          width: 20,
                          height: 20,
                          border: "2px solid rgba(255,255,255,0.3)",
                          borderTop: "2px solid white",
                          borderRadius: "50%",
                          animation: "spin 1s linear infinite",
                        }}
                      />
                      Signing In...
                    </Box>
                  ) : (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Sparkles size={18} />
                      Sign In to Dashboard
                    </Box>
                  )}
                </Button>
              </form>
            </Slide>

            <Fade in timeout={1500}>
              <Box sx={{ mt: 4, textAlign: "center" }}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    display: "block",
                    p: 2,
                    bgcolor: "rgba(233, 30, 99, 0.05)",
                    borderRadius: 2,
                    border: "1px solid rgba(233, 30, 99, 0.1)",
                    fontWeight: 500,
                  }}
                >
                  🔑 Default credentials: <strong>admin@admin.com</strong> /{" "}
                  <strong>admin</strong>
                </Typography>
              </Box>
            </Fade>
          </Paper>
        </Fade>
      </Container>

      <style>
        {`
          @keyframes float {
            0%, 100% { transform: translateY(0px) rotate(0deg); }
            50% { transform: translateY(-20px) rotate(180deg); }
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </Box>
  );
};

export default Login;
