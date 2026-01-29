import { useEffect, useState } from "react";
import { Mail, ArrowLeft, Check, Shield, KeyRound, ArrowRight, Lock, EyeOff, Eye } from "lucide-react";
import styles from "../AuthForm.module.css";
import { Link, useNavigate } from "react-router-dom";
import axiosInstance from "../../../services/axiosInstance";
import { notify } from "../../../context/NotificationContext";

function ForgotPassword() {
    const [currentStep, setCurrentStep] = useState(1);
    const [email, setEmail] = useState("");
    const [otp, setOtp] = useState(["", "", "", "", "", ""]);
    const [resetToken, setResetToken] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [cooldown, setCooldown] = useState(60);
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        if (cooldown > 0) {
            const timer = setTimeout(() => {
                setCooldown(cooldown - 1);
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [cooldown]);

    const steps = [
        {
            number: 1,
            title: "Nhập Email",
            description: "Nhập email để nhận mã OTP",
            icon: Mail,
        },
        {
            number: 2,
            title: "Xác Thực OTP",
            description: "Nhập mã OTP đã gửi",
            icon: Shield,
        },
        {
            number: 3,
            title: "Đặt Lại Mật Khẩu",
            description: "Tạo mật khẩu mới",
            icon: KeyRound,
        },
    ];

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

    const handleEmailSubmit = async (e) => {
        e.preventDefault();
        if (!email) {
            notify({
                type: "error",
                title: "Thiếu thông tin",
                message: "Vui lòng điền đầy đủ thông tin.",
            });
            return;
        }

        setIsLoading(true);
        try {
            await axiosInstance.post("/api/password/send-otp-forgot", { email: email });
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
            const res = await axiosInstance.post("/api/password/verify-otp-forgot", { email: email, otp: otp.join("") });
            setResetToken(res.data.data);
            setCurrentStep(3);
        } finally {
            setIsLoading(false);
        }
    };

    const handleResend = async (e) => {
        e.preventDefault();

        if (cooldown > 0) return;
        setIsLoading(true);
        try {
            await axiosInstance.post("/api/password/send-otp-forgot", { email: email });
            notify({
                type: "success",
                title: "Gửi OTP",
                message: "Đã gửi lại mã OTP.",
            });
            setOtp(["", "", "", "", "", ""]);
            setCooldown(60);
        } finally {
            setIsLoading(false);
        }
    };

    const handlePasswordSubmit = async (e) => {
        e.preventDefault();
        if (!newPassword || !confirmPassword) {
            notify({
                type: "error",
                title: "Thiếu thông tin",
                message: "Vui lòng điền đầy đủ thông tin.",
            });
            return;
        }

        if (newPassword !== confirmPassword) {
            notify({
                type: "error",
                title: "Sai thông tin",
                message: "Mật khẩu xác nhận không khớp.",
            });
            return;
        }

        setIsLoading(true);
        try {
            await axiosInstance.post("/api/password/reset-password", { email: email, resetToken: resetToken, newPassword: newPassword, confirm: confirmPassword });
            notify({
                type: "success",
                title: "Đặt lại mật khẩu thành công",
                message: "Mật khẩu đã được đặt lại thành công.",
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
        <div className={`${styles.container} ${styles.forgotPasswordPage}`}>
            <div className={styles.card}>
                <div className={styles.cardHeader}>
                    <div className={styles.logoSection}>
                        <div className={styles.logo}>
                            <div className={styles.logoInner}>
                                <div className={styles.logoIcon}>F</div>
                            </div>
                        </div>
                        <h1 className={styles.title}>Quên Mật Khẩu</h1>
                        <p className={styles.subtitle}>
                            Đặt lại mật khẩu của bạn trong 3 bước đơn giản
                        </p>
                    </div>

                    <div className={styles.stepIndicator}>
                        {steps.map((step, index) => {
                            const StepIcon = step.icon;
                            const isActive = currentStep === step.number;
                            const isCompleted = currentStep > step.number;

                            return (
                                <div key={step.number} className={styles.stepWrapper}>
                                    <div className={`${styles.stepItem} ${isActive ? styles.stepActive : ""} ${isCompleted ? styles.stepCompleted : ""}`}>
                                        <div className={styles.stepIconWrapper}>
                                            {isCompleted ? (<Check className={styles.stepIcon} />) : (<StepIcon className={styles.stepIcon} />)}
                                        </div>
                                        <div className={styles.stepInfo}>
                                            <div className={styles.stepTitle}>{step.title}</div>
                                            <div className={styles.stepDescription}>
                                                {step.description}
                                            </div>
                                        </div>
                                    </div>
                                    {index < steps.length - 1 && (<div className={`${styles.stepLine} ${isCompleted ? styles.stepLineCompleted : ""}`} />)}
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className={styles.cardBody}>
                    {currentStep === 1 && (
                        <form onSubmit={handleEmailSubmit} className={styles.form}>
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

                            <div className={styles.infoBox}>
                                <div className={styles.infoIcon}>
                                    <Mail />
                                </div>
                                <div className={styles.infoText}>
                                    Chúng tôi sẽ gửi mã OTP đến email của bạn. Vui lòng kiểm tra hộp thư đến hoặc thư spam.
                                </div>
                            </div>

                            <button type="submit" className={styles.primaryButton} disabled={isLoading}>
                                Gửi mã OTP
                                <ArrowRight className={styles.buttonIcon} />
                            </button>
                        </form>
                    )}

                    {currentStep === 2 && (
                        <form onSubmit={handleOtpSubmit} className={styles.form}>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>
                                    <Shield className={styles.labelIcon} />
                                    Mã OTP
                                </label>
                                <div className={styles.otpContainer}>
                                    {otp.map((digit, index) => (<input key={index} id={`otp-${index}`} type="text" maxLength={1} className={styles.otpInput} value={digit} onChange={(e) => handleOtpChange(index, e.target.value)} onKeyDown={(e) => handleOtpKeyDown(index, e)} onPaste={(e) => handlePasteOtp(e)} disabled={isLoading} />))}
                                </div>
                            </div>

                            <div className={styles.infoBox}>
                                <div className={styles.infoIcon}>
                                    <Shield />
                                </div>
                                <div className={styles.infoText}>
                                    Mã OTP đã được gửi đến <strong>{email}</strong>. Mã có hiệu lực trong 5 phút.
                                </div>
                            </div>

                            <div className={styles.resendSection}>
                                <span className={styles.resendText}>Không nhận được mã?</span>
                                <button type="button" className={styles.resendButton} onClick={handleResend} disabled={cooldown > 0 || isLoading}>
                                    {cooldown > 0 ? (
                                        <span className={styles.resendCooldown}>
                                            Gửi lại ({cooldown}s)
                                        </span>
                                    ) : ("Gửi lại")}
                                </button>
                            </div>

                            <div className={styles.buttonGroup}>
                                <button type="button" className={styles.secondaryButton} onClick={handleBack} disabled={isLoading}>
                                    <ArrowLeft className={styles.buttonIcon} />
                                    Quay lại
                                </button>
                                <button type="submit" className={styles.primaryButton} disabled={isLoading}>
                                    Xác thực
                                    <ArrowRight className={styles.buttonIcon} />
                                </button>
                            </div>
                        </form>
                    )}

                    {currentStep === 3 && (
                        <form onSubmit={handlePasswordSubmit} className={styles.form}>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>
                                    <Lock className={styles.labelIcon} />
                                    Mật khẩu mới
                                </label>
                                <div className={styles.inputWrapper}>
                                    <input type={showPassword ? "text" : "password"} className={styles.input} placeholder="••••••••" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} disabled={isLoading} />
                                    <Lock className={styles.inputIcon} />
                                    <button type="button" className={styles.togglePassword} onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
                                        {showPassword ? (<EyeOff className={styles.eyeIcon} />) : (<Eye className={styles.eyeIcon} />)}
                                    </button>
                                </div>
                            </div>

                            <div className={styles.formGroup}>
                                <label className={styles.label}>
                                    <Lock className={styles.labelIcon} />
                                    Xác nhận mật khẩu
                                </label>
                                <div className={styles.inputWrapper}>
                                    <input type={showConfirmPassword ? "text" : "password"} className={styles.input} placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} disabled={isLoading} />
                                    <Lock className={styles.inputIcon} />
                                    <button type="button" className={styles.togglePassword} onClick={() => setShowConfirmPassword(!showConfirmPassword)} tabIndex={-1} >
                                        {showConfirmPassword ? (<EyeOff className={styles.eyeIcon} />) : (<Eye className={styles.eyeIcon} />)}
                                    </button>
                                </div>
                            </div>

                            <div className={styles.buttonGroup}>
                                <button type="button" className={styles.secondaryButton} onClick={handleBack} disabled={isLoading} >
                                    <ArrowLeft className={styles.buttonIcon} />
                                    Quay lại
                                </button>
                                <button type="submit" className={styles.primaryButton} disabled={isLoading} >
                                    Đặt lại mật khẩu
                                    <Check className={styles.buttonIcon} />
                                </button>
                            </div>
                        </form>
                    )}
                </div>

                <div className={styles.cardFooter}>
                    <Link to="/login" className={styles.backToLoginButton}>
                        <ArrowLeft className={styles.footerIcon} />
                        Quay lại đăng nhập
                    </Link>
                </div>
            </div>
        </div>
    );
}

export default ForgotPassword;