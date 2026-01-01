import { useState } from "react";
import { Mail, Lock, Eye, EyeOff, LogIn, UserPlus, ArrowRight } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import styles from "./AuthForm.module.css";
import { useNavigate, Link } from "react-router-dom";
import axiosInstance from "../../services/axiosInstance";
import { notify } from "../../context/NotificationContext";

function Login() {
    const navigate = useNavigate();
    const { setUser, lastPath, setLastPath } = useAuth();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [rememberMe, setRememberMe] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!email.trim() || !password.trim()) {
            notify({
                type: "error",
                title: "Thông tin không đầy đủ",
                message: "Vui lòng điền đầy đủ thông tin.",
            });
            return;
        }

        setIsLoading(true);

        axiosInstance.post("/api/auth/login", { email, password, remember: rememberMe })
            .then(async (res) => {
                const response = await axiosInstance.get("/api/user");
                if (response.data?.data) {
                    setUser(response.data.data);
                }

                if (lastPath) {
                    navigate(lastPath, { replace: true });
                    setLastPath(null);
                } else {
                    navigate("/", { replace: true });
                }
            })
            .finally(() => setIsLoading(false));
    };

    return (
        <div className={`${styles.container} ${styles.loginPage}`}>
            <div className={styles.card}>
                <div className={styles.cardHeader}>
                    <div className={styles.logoSection}>
                        <div className={styles.logo}>
                            <div className={styles.logoInner}>
                                <div className={styles.logoIcon}>L</div>
                            </div>
                        </div>
                        <h1 className={styles.title}>Chào Mừng Trở Lại</h1>
                        <p className={styles.subtitle}>
                            Đăng nhập để truy cập hệ thống quản lý bất động sản
                        </p>
                    </div>
                </div>

                <div className={styles.cardBody}>
                    <form onSubmit={handleSubmit} className={styles.form}>
                        <div className={styles.formGroup}>
                            <label className={styles.label}>
                                <Mail className={styles.labelIcon} />
                                Địa chỉ Email
                            </label>
                            <div className={styles.inputWrapper}>
                                <input type="email" className={styles.input} placeholder="example@email.com" value={email} onChange={(e) => setEmail(e.target.value)} disabled={isLoading} />
                                <Mail className={styles.inputIcon} />
                            </div>
                        </div>

                        <div className={styles.formGroup}>
                            <label className={styles.label}>
                                <Lock className={styles.labelIcon} />
                                Mật Khẩu
                            </label>
                            <div className={styles.inputWrapper}>
                                <input type={showPassword ? "text" : "password"} className={styles.input} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} disabled={isLoading} />
                                <Lock className={styles.inputIcon} />
                                <button type="button" className={styles.togglePassword} onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
                                    {showPassword ? (<EyeOff className={styles.eyeIcon} />) : (<Eye className={styles.eyeIcon} />)}
                                </button>
                            </div>
                        </div>

                        <div className={styles.formOptions}>
                            <label className={styles.checkboxLabel}>
                                <input type="checkbox" className={styles.checkbox} checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} disabled={isLoading} />
                                <span className={styles.checkboxCustom}>
                                    {rememberMe && (<svg viewBox="0 0 12 10" className={styles.checkboxIcon} ><polyline points="1.5 6 4.5 9 10.5 1" /></svg>)}
                                </span>
                                <span className={styles.checkboxText}>Ghi nhớ đăng nhập</span>
                            </label>
                            <Link to="/forgot-password" type="button" className={styles.forgotPassword}  >
                                Quên mật khẩu?
                            </Link>
                        </div>

                        <button type="submit" className={styles.loginButton} disabled={isLoading}  >
                            {isLoading ? (<><div className={styles.spinner} />Đang đăng nhập...</>) : (<><LogIn className={styles.buttonIcon} />Đăng Nhập</>)}
                        </button>

                        <div className={styles.divider}>
                            <div className={styles.dividerLine}></div>
                            <span className={styles.dividerText}>HOẶC</span>
                            <div className={styles.dividerLine}></div>
                        </div>

                        <button type="button" className={styles.socialButton} onClick={() => window.location.href = "/api/auth/google"} disabled={isLoading} >
                            <svg className={styles.socialIcon} viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                            Tiếp tục với Google
                        </button>
                    </form>
                </div>

                <div className={styles.cardFooter}>
                    <p className={styles.footerText}>Chưa có tài khoản?</p>
                    <Link to="/register" className={styles.signUpButton}>
                        <UserPlus className={styles.footerIcon} />
                        Đăng Ký Ngay
                        <ArrowRight className={styles.footerIcon} />
                    </Link>
                </div>
            </div>
        </div>
    );
}

export default Login;