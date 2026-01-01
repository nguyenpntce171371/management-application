import { Mail, Lock, User, Eye, EyeOff, ArrowRight, Check } from "lucide-react";
import styles from "../../pages/auth/AuthForm.module.css";
import { useState } from "react";
import axiosInstance from "../../services/axiosInstance";

function RegisterStep1({ formData, setFormData, setCurrentStep }) {
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

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

        if (formData.password !== formData.confirmPassword) {
            notify({
                type: "error",
                title: "Sai thông tin",
                message: "Mật khẩu xác nhận không khớp.",
            });
            return;
        }

        setIsLoading(true);
        axiosInstance.post("/api/password/send-otp-register", { email: formData.email })
            .then(() => { setCurrentStep(2) })
            .finally(() => { setIsLoading(false) });
    };

    const handleChange = (field, value) => {
        setFormData({ ...formData, [field]: value });
    };

    return (
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

            <div className={styles.passwordRequirements}>
                <div className={styles.requirementTitle}>Độ mạnh mật khẩu:</div>
                <div className={styles.requirementList}>
                    <div className={`${styles.requirement} ${formData.password.length >= 8 ? styles.requirementMet : ""}`}>
                        <Check className={styles.requirementIcon} />
                        Ít nhất 8 ký tự
                    </div>
                    <div className={`${styles.requirement} ${/[A-Z]/.test(formData.password) ? styles.requirementMet : ""}`}>
                        <Check className={styles.requirementIcon} />
                        Có chữ hoa
                    </div>
                    <div className={`${styles.requirement} ${/[a-z]/.test(formData.password) ? styles.requirementMet : ""}`}>
                        <Check className={styles.requirementIcon} />
                        Có chữ thường
                    </div>
                    <div className={`${styles.requirement} ${/[0-9]/.test(formData.password) ? styles.requirementMet : ""}`}>
                        <Check className={styles.requirementIcon} />
                        Có số
                    </div>
                </div>
            </div>

            <button type="submit" className={styles.primaryButton} disabled={isLoading}>
                Tiếp tục
                <ArrowRight className={styles.buttonIcon} />
            </button>
        </form>
    )
}

export default RegisterStep1;