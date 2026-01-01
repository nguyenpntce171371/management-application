import { useState } from "react";
import { Lock, ArrowLeft, Check, KeyRound, EyeOff, Eye } from "lucide-react";
import styles from "../../pages/auth/AuthForm.module.css";
import { useNavigate } from "react-router-dom";
import axiosInstance from "../../services/axiosInstance";
import { notify } from "../../context/NotificationContext";

function ForgotPasswordStep3({ email, otp, currentStep, setCurrentStep }) {
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

    const handleBack = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
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
        axiosInstance.post("/api/password/reset-password", { email: email, otp: otp.join(""), newPassword: newPassword, confirm: confirmPassword })
            .then(() => {
                notify({
                    type: "success",
                    title: "Đặt lại mật khẩu thành công",
                    message: "Mật khẩu đã được đặt lại thành công.",
                });
                navigate("/login");
            })
            .finally(() => {
                setIsLoading(false);
            });
    };

    return (
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

            <div className={styles.infoBox}>
                <div className={styles.infoIcon}>
                    <KeyRound />
                </div>
                <div className={styles.infoText}>
                    Mật khẩu phải có ít nhất 8 ký tự, bao gồm chữ hoa, chữ
                    thường, số và ký tự đặc biệt.
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
    )
}

export default ForgotPasswordStep3;