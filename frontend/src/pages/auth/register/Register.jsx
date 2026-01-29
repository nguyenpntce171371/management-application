import { useEffect, useRef, useState } from "react";
import { User, ArrowLeft, Check, Shield, Mail, Lock, Eye, EyeOff, ArrowRight } from "lucide-react";
import styles from "../AuthForm.module.css";
import { Link, useNavigate } from "react-router-dom";
import axiosInstance from "../../../services/axiosInstance";
import { notify } from "../../../context/NotificationContext";

function Register() {
    const navigate = useNavigate();
    const [currentStep, setCurrentStep] = useState(1);
    const [formData, setFormData] = useState({
        fullName: "",
        email: "",
        password: "",
        confirmPassword: "",
    });
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [otp, setOtp] = useState(["", "", "", "", "", ""]);
    const cooldownRef = useRef(null);
    const [resendCooldown, setResendCooldown] = useState(0);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (resendCooldown > 0) {
            cooldownRef.current = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
        }
        return () => clearTimeout(cooldownRef.current);
    }, [resendCooldown]);

    const startCooldown = (seconds = 60) => {
        setResendCooldown(seconds);
    };

    const handleOtpChange = (index, value) => {
        if (value.length > 1) return;
        if (value && !/^\d+$/.test(value)) return;

        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);

        if (value && index < 5) {
            const nextInput = document.getElementById(`otp-${index + 1}`);
            nextInput?.focus();
        }
    };

    const handleOtpKeyDown = (index, e) => {
        if (e.key === "Backspace" && !otp[index] && index > 0) {
            const prevInput = document.getElementById(`otp-${index - 1}`);
            prevInput?.focus();
        }
    };

    const handlePasteOtp = (e) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData("text").trim();
        const digits = pasted.replace(/\D/g, "").slice(0, 6);
        if (!digits) return;
        const newOtp = digits.split("");
        while (newOtp.length < 6) newOtp.push("");
        setOtp(newOtp);
        const lastIndex = newOtp.findLastIndex((v) => v !== "");
        const next = document.getElementById(`otp-${lastIndex}`);
        next?.focus();
    };

    const handleChange = (field, value) => {
        setFormData({ ...formData, [field]: value });
    };

    const handleResendOTP = async (e) => {
        e.preventDefault();

        if (resendCooldown > 0) return;
        setIsLoading(true);
        try {
            await axiosInstance.post("/api/auth/send-otp-register", { email: formData.email });
            notify({
                type: "success",
                title: "Gửi OTP",
                message: "Đã gửi lại mã OTP.",
            });
            setOtp(["", "", "", "", "", ""]);
            startCooldown(60);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRegisterSubmit = async (e) => {
        e.preventDefault();

        if (!formData.fullName.trim() || !formData.email.trim() || !formData.password.trim() || !formData.confirmPassword.trim()) {
            notify({
                type: "error",
                title: "Thiếu thông tin",
                message: "Vui lòng điền đầy đủ thông tin.",
            });
            return;
        }

        const fullNameRegex = /^[A-Za-zÀ-ỹ]+(?:\s[A-Za-zÀ-ỹ]+)+$/;
        if (!fullNameRegex.test(formData.fullName.trim())) {
            notify({
                type: "error",
                title: "Tên không hợp lệ",
                message: "Họ và tên phải có ít nhất 2 từ, chỉ chứa chữ cái.",
            });
            return;
        }

        if (formData.password !== formData.confirmPassword) {
            notify({
                type: "error",
                title: "Sai thông tin",
                message: "Mật khẩu xác nhận không khớp.",
            });
            return;
        }

        setIsLoading(true);
        try {
            await axiosInstance.post("/api/auth/send-otp-register", { email: formData.email });
            setCurrentStep(2);
        } finally {
            setIsLoading(false);
        }
    };

    const handleOtpSubmit = async (e) => {
        e.preventDefault();
        if (otp.some((digit) => digit === "")) {
            notify({
                type: "error",
                title: "Thiếu OTP",
                message: "Vui lòng điền đầy đủ thông tin OTP.",
            });
            return;
        }

        setIsLoading(true);
        try {
            await axiosInstance.post("/api/auth/verify-otp-register", { email: formData.email, otp: otp.join("") });
            await axiosInstance.post("/api/auth/register", { fullName: formData.fullName, email: formData.email, password: formData.password });
            notify({
                type: "success",
                title: "Thành công",
                message: "Tài khoản đã được tạo thành công, mời bạn đăng nhập"
            });
            navigate("/login");
        } finally {
            setIsLoading(false);
        }
    };

    const handleBack = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
        }
    };

    return (
        <div className={`${styles.container} ${styles.registerPage}`}>
            <div className={styles.card}>
                <div className={styles.cardHeader}>
                    <div className={styles.logoSection}>
                        <div className={styles.logo}>
                            <div className={styles.logoInner}>
                                <div className={styles.logoIcon}>R</div>
                            </div>
                        </div>
                        <h1 className={styles.title}>Tạo Tài Khoản Mới</h1>
                        <p className={styles.subtitle}>
                            Tham gia hệ thống quản lý bất động sản
                        </p>
                    </div>

                    <div className={styles.stepIndicator}>
                        <div className={styles.stepWrapper}>
                            <div className={`${styles.stepItem} ${(currentStep === 1) ? styles.stepActive : ""} ${(currentStep > 1) ? styles.stepCompleted : ""}`}>
                                <div className={styles.stepIconWrapper}>
                                    {(currentStep > 1) ? (<Check className={styles.stepIcon} />) : (<User className={styles.stepIcon} />)}
                                </div>
                                <div className={styles.stepInfo}>
                                    <div className={styles.stepTitle}>Thông Tin Tài Khoản</div>
                                    <div className={styles.stepDescription}>Điền thông tin cá nhân</div>
                                </div>
                            </div>
                            <div className={`${styles.stepLine} ${(currentStep > 1) ? styles.stepLineCompleted : ""}`} />
                        </div>

                        <div className={styles.stepWrapper}>
                            <div className={`${styles.stepItem} ${(currentStep === 2) ? styles.stepActive : ""}`}>
                                <div className={styles.stepIconWrapper}>
                                    <Shield className={styles.stepIcon} />
                                </div>
                                <div className={styles.stepInfo}>
                                    <div className={styles.stepTitle}>Xác Thực Email</div>
                                    <div className={styles.stepDescription}>Nhập mã OTP đã gửi</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className={styles.cardBody}>
                    {currentStep === 1 && (
                        <form onSubmit={handleRegisterSubmit} className={styles.form}>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>
                                    <User className={styles.labelIcon} />
                                    Họ và Tên
                                </label>
                                <div className={styles.inputWrapper}>
                                    <input type="text" className={styles.input} placeholder="Họ và tên" value={formData.fullName} onChange={(e) => handleChange("fullName", e.target.value)} disabled={isLoading} />
                                    <User className={styles.inputIcon} />
                                </div>
                            </div>

                            <div className={styles.formGroup}>
                                <label className={styles.label}>
                                    <Mail className={styles.labelIcon} />
                                    Địa chỉ Email
                                </label>
                                <div className={styles.inputWrapper}>
                                    <input type="email" className={styles.input} placeholder="example@email.com" value={formData.email} onChange={(e) => handleChange("email", e.target.value)} disabled={isLoading} />
                                    <Mail className={styles.inputIcon} />
                                </div>
                            </div>

                            <div className={styles.formRow}>
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>
                                        <Lock className={styles.labelIcon} />
                                        Mật Khẩu
                                    </label>
                                    <div className={styles.inputWrapper}>
                                        <input type={showPassword ? "text" : "password"} className={styles.input} placeholder="••••••••" value={formData.password} onChange={(e) => handleChange("password", e.target.value)} disabled={isLoading} />
                                        <Lock className={styles.inputIcon} />
                                        <button type="button" className={styles.togglePassword} onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
                                            {showPassword ? (<EyeOff className={styles.eyeIcon} />) : (<Eye className={styles.eyeIcon} />)}
                                        </button>
                                    </div>
                                </div>

                                <div className={styles.formGroup}>
                                    <label className={styles.label}>
                                        <Lock className={styles.labelIcon} />
                                        Xác Nhận Mật Khẩu
                                    </label>
                                    <div className={styles.inputWrapper}>
                                        <input type={showConfirmPassword ? "text" : "password"} className={styles.input} placeholder="••••••••" value={formData.confirmPassword} onChange={(e) => handleChange("confirmPassword", e.target.value)} disabled={isLoading} />
                                        <Lock className={styles.inputIcon} />
                                        <button type="button" className={styles.togglePassword} onClick={() => setShowConfirmPassword(!showConfirmPassword)} tabIndex={-1} >
                                            {showConfirmPassword ? (<EyeOff className={styles.eyeIcon} />) : (<Eye className={styles.eyeIcon} />)}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <button type="submit" className={styles.primaryButton} disabled={isLoading}>
                                Tiếp tục
                                <ArrowRight className={styles.buttonIcon} />
                            </button>
                        </form>
                    )}
                    {currentStep === 2 && (
                        <form onSubmit={handleOtpSubmit} className={styles.form}>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>
                                    <Shield className={styles.labelIcon} />
                                    Mã Xác Thực OTP
                                </label>
                                <div className={styles.otpContainer}>
                                    {otp.map((digit, index) => (<input key={index} id={`otp-${index}`} type="text" maxLength={1} className={styles.otpInput} value={digit} onChange={(e) => handleOtpChange(index, e.target.value)} onKeyDown={(e) => handleOtpKeyDown(index, e)} onPaste={(e) => handlePasteOtp(e)} disabled={isLoading} />))}
                                </div>
                            </div>

                            <div className={styles.infoBox}>
                                <div className={styles.infoIcon}><Shield /></div>
                                <div className={styles.infoText}>
                                    Mã OTP đã được gửi đến <strong>{formData.email}</strong>. Vui
                                    lòng kiểm tra hộp thư đến hoặc thư spam. Mã có hiệu lực trong 5
                                    phút.
                                </div>
                            </div>

                            <div className={styles.resendSection}>
                                <span className={styles.resendText}>Không nhận được mã?</span>
                                <button type="button" className={styles.resendButton} onClick={handleResendOTP} disabled={resendCooldown > 0}>Gửi lại</button>
                            </div>

                            <div className={styles.buttonGroup}>
                                <button type="button" className={styles.secondaryButton} onClick={handleBack} disabled={isLoading}>
                                    <ArrowLeft className={styles.buttonIcon} />
                                    Quay lại
                                </button>
                                <button type="submit" className={styles.primaryButton} disabled={isLoading}>
                                    Xác thực
                                    <Check className={styles.buttonIcon} />
                                </button>
                            </div>
                        </form>
                    )}
                </div>

                <div className={styles.cardFooter}>
                    <p className={styles.footerText}>Đã có tài khoản?</p>
                    <Link to="/login" className={styles.backToLoginButton}>
                        <ArrowLeft className={styles.footerIcon} />
                        Đăng nhập ngay
                    </Link>
                </div>
            </div>
        </div>
    );
}

export default Register;